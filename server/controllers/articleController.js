import asyncHandler from "express-async-handler";
import Article from "../models/Article.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { generateEmbedding } from "./aiController.js";

// @desc    Create new article
// @route   POST /api/articles
// @access  Private
const createArticle = asyncHandler(async (req, res) => {
  const { title, content, tags, department } = req.body;

  // Assign article to the user's first active workspace
  const activeCompanyId = req.body.companyId || req.user.companyId[0];

  // 1. Generate the vector embedding for duplicate detection
  const textToEmbed = `Title: ${title}\nContent: ${content}`;
  let embedding = [];
  try {
    embedding = await generateEmbedding(textToEmbed);
  } catch (error) {
    console.error("Failed to generate embedding during article creation:", error);
    // We continue creating the article even if embedding fails, it just won't be searchable by vector
  }

  const article = await Article.create({
    title,
    content,
    tags,
    department,
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
        filter: { companyId: activeCompanyId } // Only check within their company
      }
    },
    {
      $project: {
        title: 1,
        status: 1,
        score: { $meta: "vectorSearchScore" } // Get the similarity score
      }
    }
  ]);

  // If the score is higher than a certain threshold (e.g., 0.85 out of 1.0), it's a likely duplicate
  const strongMatches = duplicates.filter(doc => doc.score > 0.85);

  res.json({
    success: true,
    isLikelyDuplicate: strongMatches.length > 0,
    similarArticles: strongMatches
  });
});

// @desc    Get all articles for a company
// @route   GET /api/articles
// @access  Private
const getArticles = asyncHandler(async (req, res) => {
  // Find articles where companyId is IN the user's company array
  const articles = await Article.find({
    companyId: { $in: req.user.companyId },
    status: "Approved",
  })
    .populate("authorId", "firstName lastName avatar")
    .sort("-createdAt");

  res.json(articles);
});

// @desc    Get single article by ID
// @route   GET /api/articles/:id
// @access  Private
const getArticleById = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id).populate(
    "authorId",
    "firstName lastName avatar",
  );

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  // Check if the user's company array contains the article's companyId
  const hasCompanyAccess = req.user.companyId.some(
    (id) => id.toString() === article.companyId.toString(),
  );

  if (!hasCompanyAccess) {
    res.status(403);
    throw new Error("Not authorized to view this article");
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
  const hasCompanyAccess = req.user.companyId.some(
    (id) => id.toString() === article.companyId.toString(),
  );

  if (!hasCompanyAccess) {
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
    companyId: { $in: req.user.companyId },
    department: { $in: req.user.department },
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
    status: "Approved" 
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

  const hasCompanyAccess = req.user.companyId.some(
    (id) => id.toString() === article.companyId.toString(),
  );

  if (!hasCompanyAccess) {
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

  const hasCompanyAccess = req.user.companyId.some(
    (id) => id.toString() === article.companyId.toString(),
  );

  if (!hasCompanyAccess) {
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
};
