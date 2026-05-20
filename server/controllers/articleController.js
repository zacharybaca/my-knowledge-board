import asyncHandler from "express-async-handler";
import Article from "../models/Article.js";
import User from "../models/User.js";

/**
 * @desc    Create a new article
 * @route   POST /api/articles
 * @access  Private
 */
const createArticle = asyncHandler(async (req, res) => {
  const { title, content, tags, status } = req.body;

  let finalStatus = status || "Pending";

  if (req.user.role === "Admin" || req.user.role === "Manager") {
    finalStatus = "Approved";
  }

  const article = await Article.create({
    companyId: req.user.companyId,
    authorId: req.user._id,
    department: req.user.department,
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
    article.department === req.user.department
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

  if (req.user.role === "Admin" || req.user.role === "Manager") {
    article.status = "Approved";
  } else if (article.status === "Rejected") {
    article.status = "Pending";
  } else if (req.body.status) {
    article.status = req.body.status;
  }

  article.title = req.body.title || article.title;
  article.content = req.body.content || article.content;
  article.tags = req.body.tags || article.tags;

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
    article.department !== req.user.department
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
  // 1. Looks up the User (this is why we needed the import)
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // 2. Uses the Article model to find all articles that match the IDs in the user's array
  const articles = await Article.find({ _id: { $in: user.favoriteArticles } })
    .populate("authorId", "firstName lastName")
    .sort({ createdAt: -1 });

  res.json(articles);
});

export {
  createArticle,
  getArticles,
  getArticleById,
  updateArticle,
  approveRejectArticle,
  getUserArticles,
  getPendingArticles,
  getFavoriteArticles,
};
