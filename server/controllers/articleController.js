import asyncHandler from "express-async-handler";
import Article from "../models/Article.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { generateEmbedding } from "./aiController.js";
import sendEmail from "../utils/sendEmail.js";
import { sanitizeRichText } from "../utils/sanitizeHtml.js";

const isElevatedUser = (user) =>
  user?.role?.includes("Admin") || user?.role?.includes("Manager");

const hasCompanyAccess = (user, companyId) =>
  user.companyId.some((id) => id.toString() === companyId.toString());

const normalizeDepartments = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

// @desc    Create new article
// @route   POST /api/articles
// @access  Private
const createArticle = asyncHandler(async (req, res) => {
  const { title, content, tags, departments, summary } = req.body;

  // Assign article to the user's first active workspace
  const activeCompanyId = req.body.companyId || req.user.companyId[0];

  // 1. Generate the vector embedding for duplicate detection
  const textToEmbed = `Title: ${title}\nContent: ${content}`;
  let embedding = [];
  try {
    embedding = await generateEmbedding(textToEmbed);
  } catch (error) {
    console.error(
      "Failed to generate embedding during article creation:",
      error,
    );
    // We continue creating the article even if embedding fails, it just won't be searchable by vector
  }

  const article = await Article.create({
    title,
    content: sanitizeRichText(content),
    summary: summary || "",
    tags,
    department: normalizeDepartments(departments),
    authorId: req.user._id,
    companyId: activeCompanyId,
    contentEmbedding: embedding, // Save the generated vector
    status: "Pending", // Requires Manager/Admin approval
  });

  res.status(201).json(article);
});

// @desc    Check if drafted article is a duplicate
// @route   POST /api/articles/check-duplicate
// @access  Private
const checkDuplicateArticle = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  const activeCompanyId = req.body.companyId || req.user.companyId[0];

  const textToEmbed = `Title: ${title}\nContent: ${content}`;

  let queryEmbedding;
  try {
    queryEmbedding = await generateEmbedding(textToEmbed);
  } catch (error) {
    res.status(500);
    throw new Error("Failed to generate embedding for duplicate check");
  }

  // Use MongoDB Atlas Vector Search Aggregation Pipeline
  const duplicates = await Article.aggregate([
    {
      $vectorSearch: {
        index: "vector_index", // IMPORTANT: You must create an Atlas Vector Search index named "vector_index"
        path: "contentEmbedding",
        queryVector: queryEmbedding,
        numCandidates: 10,
        limit: 3,
        filter: { companyId: activeCompanyId }, // Only check within their company
      },
    },
    {
      $project: {
        title: 1,
        status: 1,
        score: { $meta: "vectorSearchScore" }, // Get the similarity score
      },
    },
  ]);

  // If the score is higher than a certain threshold (e.g., 0.85 out of 1.0), it's a likely duplicate
  const strongMatches = duplicates.filter((doc) => doc.score > 0.85);

  res.json({
    success: true,
    isLikelyDuplicate: strongMatches.length > 0,
    similarArticles: strongMatches,
  });
});

// @desc    Get all articles for a company
// @route   GET /api/articles
// @access  Private
const getArticles = asyncHandler(async (req, res) => {
  const keyword = req.query.keyword?.trim();
  const tag = req.query.tag?.trim();
  const page = Number.parseInt(req.query.page || "1", 10);
  const limit = Number.parseInt(req.query.limit || "10", 10);
  const shouldPaginate = req.query.paginate === "true";

  const filter = {
    companyId: { $in: req.user.companyId },
    status: "Approved",
  };

  if (keyword) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: escapedKeyword, $options: "i" } },
      { content: { $regex: escapedKeyword, $options: "i" } },
      { tags: { $regex: escapedKeyword, $options: "i" } },
    ];
  }

  if (tag) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.tags = { $in: [new RegExp(`^${escapedTag}$`, "i")] };
  }

  const query = Article.find(filter)
    .populate("authorId", "firstName lastName avatar")
    .sort("-createdAt");

  if (!shouldPaginate) {
    const articles = await query;
    return res.json(articles);
  }

  const skip = (page - 1) * limit;
  const [articles, total] = await Promise.all([
    query.skip(skip).limit(limit),
    Article.countDocuments(filter),
  ]);

  res.json({
    articles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

// @desc    Get single article by ID
// @route   GET /api/articles/:id
// @access  Private
const getArticleById = asyncHandler(async (req, res) => {
  let article = await Article.findById(req.params.id).populate(
    "authorId",
    "firstName lastName avatar",
  );

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  // Check if the user's company array contains the article's companyId
  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to view this article");
  }

  if (typeof article.populate === "function") {
    article = await article.populate(
      "comments.userId",
      "firstName lastName avatar",
    );
  }

  if (typeof article.viewCount === "number") {
    article.viewCount += 1;
    await article.save();
  }

  res.json(article);
});

/**
 * @desc    Update article (Author only)
 * @route   PUT /api/articles/:id
 * @access  Private
 */
const updateArticle = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to edit this article");
  }

  if (
    article.authorId.toString() !== req.user._id.toString() &&
    !isElevatedUser(req.user)
  ) {
    res.status(403);
    throw new Error("Not authorized to edit this article");
  }

  article.revisions.push({
    title: article.title,
    content: article.content,
    summary: article.summary || "",
    tags: article.tags || [],
    department: article.department || [],
    updatedBy: req.user._id,
  });

  if (article.revisions.length > 25) {
    article.revisions = article.revisions.slice(-25);
  }

  if (isElevatedUser(req.user)) {
    article.status = "Approved";
  } else if (article.status === "Rejected") {
    article.status = "Pending";
  }

  article.title = req.body.title || article.title;
  article.content = req.body.content
    ? sanitizeRichText(req.body.content)
    : article.content;
  article.summary = req.body.summary ?? article.summary;
  article.tags = req.body.tags || article.tags;
  article.department = req.body.departments
    ? normalizeDepartments(req.body.departments)
    : article.department;

  // Re-generate embedding if title or content changed
  if (req.body.title || req.body.content) {
    try {
      const textToEmbed = `Title: ${article.title}\nContent: ${article.content}`;
      const newEmbedding = await generateEmbedding(textToEmbed);
      article.contentEmbedding = newEmbedding;
    } catch (error) {
      console.error("Failed to update embedding:", error);
    }
  }

  const updatedArticle = await article.save();
  res.json(updatedArticle);
});

// @desc    Approve or Reject an article
// @route   PATCH /api/articles/:id/status
// @access  Private (Manager/Admin Only)
const approveRejectArticle = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;
  const article = await Article.findById(req.params.id);

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  // Array verification for security
  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to modify this article");
  }

  article.status = status;
  article.approverId = req.user._id;

  if (status === "Rejected") {
    article.rejectionReason = rejectionReason;
  } else {
    article.rejectionReason = null;
  }

  const reviewedArticle = await article.save();

  if (typeof Notification.create === "function") {
    await Notification.create({
      recipientId: article.authorId,
      type: "Status_Update",
      message: `Your article "${article.title}" was ${status.toLowerCase()}.`,
      referenceId: article._id,
    });
  }

  const io = req.app.get("io");
  if (io) {
    io.to(article.authorId.toString()).emit("article_status_update", {
      status,
      articleId: article._id,
      message: `Your article "${article.title}" was ${status.toLowerCase()}.`,
    });
    io.to(article.authorId.toString()).emit("refresh_notifications");
  }

  try {
    const author = await User.findById(article.authorId).select("email");
    if (author?.email) {
      await sendEmail({
        email: author.email,
        subject: `Article ${status}: ${article.title}`,
        message:
          status === "Rejected" && rejectionReason
            ? `Your article "${article.title}" was rejected.\nReason: ${rejectionReason}`
            : `Your article "${article.title}" was approved and published.`,
      });
    }
  } catch (error) {
    console.error("Failed to send article status email:", error);
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
  const userDepartments = Array.isArray(req.user.department)
    ? req.user.department
    : [req.user.department];

  const articles = await Article.find({
    companyId: { $in: req.user.companyId },
    department: { $in: userDepartments },
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
  const articles = await Article.find({
    companyId: { $in: req.user.companyId },
    status: "Approved",
  })
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

  if (!hasCompanyAccess(req.user, article.companyId)) {
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
      comment: sanitizeRichText(comment || ""),
      submittedAt: Date.now(),
    };
  } else {
    article.feedback.push({
      userId: req.user._id,
      isHelpful,
      comment: sanitizeRichText(comment || ""),
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
    companyId: { $in: req.user.companyId },
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

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to modify this article");
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

/**
 * @desc    Delete an article
 * @route   DELETE /api/articles/:id
 * @access  Private
 */
const deleteArticle = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);
  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to delete this article");
  }

  const isAuthor = article.authorId.toString() === req.user._id.toString();
  if (!isAuthor && !isElevatedUser(req.user)) {
    res.status(403);
    throw new Error("Not authorized to delete this article");
  }

  await article.deleteOne();
  res.json({ message: "Article deleted successfully" });
});

/**
 * @desc    Bulk approve/reject pending articles
 * @route   PATCH /api/articles/bulk-status
 * @access  Private (Manager/Admin)
 */
const bulkUpdateArticleStatus = asyncHandler(async (req, res) => {
  if (!isElevatedUser(req.user)) {
    res.status(403);
    throw new Error("Not authorized");
  }

  const { articleIds, status, rejectionReason } = req.body;
  const articles = await Article.find({
    _id: { $in: articleIds },
    companyId: { $in: req.user.companyId },
    status: "Pending",
  });

  for (const article of articles) {
    article.status = status;
    article.approverId = req.user._id;
    article.rejectionReason =
      status === "Rejected" ? rejectionReason || null : null;
    await article.save();

    if (typeof Notification.create === "function") {
      await Notification.create({
        recipientId: article.authorId,
        type: "Status_Update",
        message: `Your article "${article.title}" was ${status.toLowerCase()}.`,
        referenceId: article._id,
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(article.authorId.toString()).emit("article_status_update", {
        status,
        articleId: article._id,
        message: `Your article "${article.title}" was ${status.toLowerCase()}.`,
      });
      io.to(article.authorId.toString()).emit("refresh_notifications");
    }

    try {
      const author = await User.findById(article.authorId).select("email");
      if (author?.email) {
        await sendEmail({
          email: author.email,
          subject: `Article ${status}: ${article.title}`,
          message:
            status === "Rejected" && rejectionReason
              ? `Your article "${article.title}" was rejected.\nReason: ${rejectionReason}`
              : `Your article "${article.title}" was approved and published.`,
        });
      }
    } catch (error) {
      console.error("Failed to send bulk article status email:", error);
    }
  }

  res.json({
    message: `${articles.length} article(s) updated successfully`,
    count: articles.length,
  });
});

/**
 * @desc    Add article comment
 * @route   POST /api/articles/:id/comments
 * @access  Private
 */
const addArticleComment = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);
  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to comment on this article");
  }

  article.comments.push({
    userId: req.user._id,
    message: sanitizeRichText(req.body.message),
  });
  await article.save();
  await article.populate("comments.userId", "firstName lastName avatar");

  res.status(201).json(article.comments[article.comments.length - 1]);
});

/**
 * @desc    Get article revision history
 * @route   GET /api/articles/:id/revisions
 * @access  Private
 */
const getArticleRevisions = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id)
    .populate("revisions.updatedBy", "firstName lastName")
    .select("title revisions companyId");

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to view revision history");
  }

  res.json({
    title: article.title,
    revisions: article.revisions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    ),
  });
});

/**
 * @desc    Rollback article to a previous revision
 * @route   PATCH /api/articles/:id/rollback
 * @access  Private (Manager/Admin)
 */
const rollbackArticleRevision = asyncHandler(async (req, res) => {
  const { revisionId } = req.body;
  const article = await Article.findById(req.params.id);

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (
    !hasCompanyAccess(req.user, article.companyId) ||
    !isElevatedUser(req.user)
  ) {
    res.status(403);
    throw new Error("Not authorized to rollback this article");
  }

  const revision = article.revisions.id(revisionId);
  if (!revision) {
    res.status(404);
    throw new Error("Revision not found");
  }

  article.revisions.push({
    title: article.title,
    content: article.content,
    summary: article.summary || "",
    tags: article.tags || [],
    department: article.department || [],
    updatedBy: req.user._id,
  });

  article.title = revision.title;
  article.content = revision.content;
  article.summary = revision.summary || "";
  article.tags = revision.tags || [];
  article.department = revision.department || [];
  article.status = "Approved";
  await article.save();

  res.json({ message: "Article rolled back successfully", article });
});

/**
 * @desc    Get article analytics
 * @route   GET /api/articles/analytics
 * @access  Private (Manager/Admin)
 */
const getArticleAnalytics = asyncHandler(async (req, res) => {
  if (!isElevatedUser(req.user)) {
    res.status(403);
    throw new Error("Not authorized to access analytics");
  }

  const companyFilter = {
    companyId: { $in: req.user.companyId },
    status: "Approved",
  };
  const [totals, topViewed, votedCandidates] = await Promise.all([
    Article.countDocuments(companyFilter),
    Article.find(companyFilter)
      .sort({ viewCount: -1 })
      .limit(5)
      .select("title viewCount upvotes downvotes"),
    Article.find(companyFilter)
      .limit(100)
      .select("title upvotes downvotes viewCount"),
  ]);

  const topVoted = votedCandidates
    .map((article) => ({
      _id: article._id,
      title: article.title,
      views: article.viewCount,
      upvotes: article.upvotes.length,
      downvotes: article.downvotes.length,
      score: article.upvotes.length - article.downvotes.length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  res.json({
    totals,
    topViewed: topViewed.map((article) => ({
      _id: article._id,
      title: article.title,
      views: article.viewCount,
      upvotes: article.upvotes.length,
      downvotes: article.downvotes.length,
    })),
    topVoted,
  });
});

export {
  createArticle,
  checkDuplicateArticle,
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
  deleteArticle,
  bulkUpdateArticleStatus,
  getArticleAnalytics,
  getArticleRevisions,
  rollbackArticleRevision,
  addArticleComment,
};
