import asyncHandler from "express-async-handler";
import Article from "../models/Article.js";
import User from "../models/User.js";

/**
 * @desc    Create a new article
 * @route   POST /api/articles
 * @access  Private
 */
const createArticle = asyncHandler(async (req, res) => {
  const { title, content, tags, status, departments } = req.body;

  let finalStatus = status || "Pending";

  if (req.user.role.includes("Admin") || req.user.role.includes("Manager")) {
    finalStatus = "Approved";
  }

  const targetDepartments =
    departments && departments.length > 0 ? departments : [req.user.department];

  const article = await Article.create({
    companyId: req.user.companyId,
    authorId: req.user._id,
    department: targetDepartments,
    title,
    content,
    tags,
    status: finalStatus,
  });

  res.status(201).json(article);
});

/**
 * @desc    Search/Get all approved articles in company and department
 * @route   GET /api/articles
 * @access  Private
 */
const getArticles = asyncHandler(async (req, res) => {
  const { keyword, tag } = req.query;

  let query = {
    companyId: req.user.companyId,
    department: req.user.department,
    status: "Approved",
  };

  if (keyword) {
    query.$text = { $search: keyword };
  }

  if (tag) {
    query.tags = tag;
  }

  const articles = await Article.find(query)
    .populate("authorId", "firstName lastName")
    .sort(keyword ? { score: { $meta: "textScore" } } : { createdAt: -1 });

  res.json(articles);
});

/**
 * @desc    Get article by ID
 * @route   GET /api/articles/:id
 * @access  Private
 */
const getArticleById = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id)
    .populate("authorId", "firstName lastName email")
    .populate("approverId", "firstName lastName");

  if (
    article &&
    article.companyId.toString() === req.user.companyId.toString() &&
    article.department.includes(req.user.department)
  ) {
    article.viewCount += 1;
    await article.save();

    res.json(article);
  } else {
    res.status(404);
    throw new Error("Article not found or access denied");
  }
});

/**
 * @desc    Update article (Author only)
 * @route   PUT /api/articles/:id
 * @access  Private
 */
const updateArticle = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article || article.authorId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to edit this article");
  }

  if (req.user.role.includes("Admin") || req.user.role.includes("Manager")) {
    article.status = "Approved";
  } else if (article.status === "Rejected") {
    article.status = "Pending";
  } else if (req.body.status) {
    article.status = req.body.status;
  }

  article.title = req.body.title || article.title;
  article.content = req.body.content || article.content;
  article.tags = req.body.tags || article.tags;
  article.department = req.body.departments || article.department;

  const updatedArticle = await article.save();
  res.json(updatedArticle);
});

/**
 * @desc    Approve or Reject an article
 * @route   PATCH /api/articles/:id/status
 * @access  Private (Manager/Admin Only)
 */
const approveRejectArticle = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;
  const article = await Article.findById(req.params.id);

  if (
    !article ||
    article.companyId.toString() !== req.user.companyId.toString() ||
    !article.department.includes(req.user.department)
  ) {
    res.status(404);
    throw new Error("Article not found or out of scope");
  }

  article.status = status;
  article.approverId = req.user._id;

  if (status === "Rejected") {
    article.rejectionReason = rejectionReason;
  } else {
    article.rejectionReason = null;
  }

  const reviewedArticle = await article.save();

  const io = req.app.get("io");
  if (io) {
    io.to(article.authorId.toString()).emit("article_status_update", {
      articleId: article._id,
      title: article.title,
      status: article.status,
      message: `Your article "${article.title}" has been ${article.status.toLowerCase()}.`,
    });
  }

  res.json(reviewedArticle);
});

/**
 * @desc    Get user's own articles (Dashboard)
 * @route   GET /api/articles/my-articles
 * @access  Private
 */
const getUserArticles = asyncHandler(async (req, res) => {
  const articles = await Article.find({ authorId: req.user._id }).sort({
    updatedAt: -1,
  });
  res.json(articles);
});

/**
 * @desc    Get pending articles for approval queue
 * @route   GET /api/articles/pending
 * @access  Private (Manager/Admin Only)
 */
const getPendingArticles = asyncHandler(async (req, res) => {
  const articles = await Article.find({
    companyId: req.user.companyId,
    department: req.user.department,
    status: "Pending",
  }).populate("authorId", "firstName lastName");

  res.json(articles);
});

/**
 * @desc    Get user's favorite/pinned articles
 * @route   GET /api/articles/favorites
 * @access  Private
 */
const getFavoriteArticles = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const articles = await Article.find({ _id: { $in: user.favoriteArticles } })
    .populate("authorId", "firstName lastName")
    .sort({ createdAt: -1 });

  res.json(articles);
});

/**
 * @desc    Get top viewed articles
 * @route   GET /api/articles/top
 * @access  Private
 */
const getTopArticles = asyncHandler(async (req, res) => {
  const articles = await Article.find({ status: "Approved" })
    .sort({ viewCount: -1 })
    .limit(5)
    .populate("authorId", "firstName lastName")
    .select("title department viewCount status");

  res.json(articles);
});

/**
 * @desc    Vote on an article (Thumbs Up / Down)
 * @route   PATCH /api/articles/:id/vote
 * @access  Private
 */
const voteArticle = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);
  const { voteType } = req.body;
  const userId = req.user._id;

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  const hasUpvoted = article.upvotes.includes(userId);
  const hasDownvoted = article.downvotes.includes(userId);

  if (voteType === "up") {
    if (hasUpvoted) {
      article.upvotes.pull(userId);
    } else {
      article.upvotes.push(userId);
      article.downvotes.pull(userId);
    }
  } else if (voteType === "down") {
    if (hasDownvoted) {
      article.downvotes.pull(userId);
    } else {
      article.downvotes.push(userId);
      article.upvotes.pull(userId);
    }
  }

  await article.save();

  res.json({
    upvotes: article.upvotes,
    downvotes: article.downvotes,
  });
});

/**
 * @desc    Submit feedback on an article
 * @route   POST /api/articles/:id/feedback
 * @access  Private
 */
const submitArticleFeedback = asyncHandler(async (req, res) => {
  const { isHelpful, comment } = req.body;
  const article = await Article.findById(req.params.id);

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (article.companyId.toString() !== req.user.companyId.toString()) {
    res.status(403);
    throw new Error("Access denied");
  }

  const existingFeedbackIndex = article.feedback.findIndex(
    (f) => f.userId.toString() === req.user._id.toString(),
  );

  if (existingFeedbackIndex !== -1) {
    article.feedback[existingFeedbackIndex] = {
      userId: req.user._id,
      isHelpful,
      comment,
      submittedAt: Date.now(),
    };
  } else {
    article.feedback.push({
      userId: req.user._id,
      isHelpful,
      comment,
      submittedAt: Date.now(),
    });
  }

  await article.save();
  res.status(200).json({ message: "Feedback recorded" });
});

/**
 * @desc    Get articles nearing expiration or expired
 * @route   GET /api/articles/review-queue
 * @access  Private (Manager/Admin Only)
 */
const getReviewQueue = asyncHandler(async (req, res) => {
  if (!req.user.role.includes("Admin") && !req.user.role.includes("Manager")) {
    res.status(403);
    throw new Error("Not authorized to access review queue");
  }

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const articles = await Article.find({
    companyId: req.user.companyId,
    status: "Approved",
    expiresAt: { $lte: thirtyDaysFromNow },
  })
    .select("title expiresAt lastReviewedAt authorId")
    .populate("authorId", "firstName lastName")
    .sort({ expiresAt: 1 });

  res.json(articles);
});

/**
 * @desc    Certify article accuracy and extend expiration
 * @route   PATCH /api/articles/:id/certify
 * @access  Private (Manager/Admin Only)
 */
const certifyArticle = asyncHandler(async (req, res) => {
  if (!req.user.role.includes("Admin") && !req.user.role.includes("Manager")) {
    res.status(403);
    throw new Error("Not authorized to certify articles");
  }

  const article = await Article.findById(req.params.id);

  if (
    !article ||
    article.companyId.toString() !== req.user.companyId.toString()
  ) {
    res.status(404);
    throw new Error("Article not found");
  }

  article.expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  article.lastReviewedAt = Date.now();
  article.lastReviewedBy = req.user._id;

  await article.save();
  res.json({
    message: "Article certified successfully",
    expiresAt: article.expiresAt,
  });
});

export {
  createArticle,
  getArticles,
  getArticleById,
  updateArticle,
  approveRejectArticle,
  getUserArticles,
  getTopArticles,
  voteArticle,
  getPendingArticles,
  getFavoriteArticles,
  submitArticleFeedback,
  getReviewQueue,
  certifyArticle,
};
