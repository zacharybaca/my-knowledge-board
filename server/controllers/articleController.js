import asyncHandler from "express-async-handler";
import Article from "../models/Article.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { generateEmbedding } from "./aiController.js";
import sendEmail from "../utils/sendEmail.js";
import { sanitizeRichText, stripHtml } from "../utils/sanitizeHtml.js";
import { resolveContentGapsForArticle } from "./analyticsController.js";

const isElevatedUser = (user) =>
  user?.role?.includes("Admin") || user?.role?.includes("Manager");

const hasCompanyAccess = (user, companyId) =>
  user.companyId.some((id) => id.toString() === companyId.toString());

const normalizeDepartments = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const SEARCH_RESULT_FIELDS =
  "title summary department tags status viewCount createdAt authorId";
const DASHBOARD_ARTICLE_FIELDS =
  "title department tags status createdAt authorId viewCount";
const FAVORITE_ARTICLE_FIELDS =
  "title department authorId createdAt status viewCount";

const runDeferredTask = async (task, label) => {
  const runner = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`Deferred task failed (${label}):`, error);
    }
  };

  if (process.env.NODE_ENV === "test") {
    await runner();
    return;
  }

  setImmediate(() => {
    void runner();
  });
};

const queueArticleStatusSideEffects = async ({
  articles,
  status,
  rejectionReason,
  io,
}) => {
  if (articles.length === 0) return;

  await runDeferredTask(async () => {
    const messageByArticleId = new Map(
      articles.map((article) => [
        article._id.toString(),
        `Your article "${article.title}" was ${status.toLowerCase()}.`,
      ]),
    );

    if (status === "Approved") {
      await Promise.allSettled(
        articles.map((article) =>
          resolveContentGapsForArticle(
            article.contentEmbedding,
            article.companyId,
          ),
        ),
      );
    }

    if (typeof Notification.create === "function") {
      await Promise.allSettled(
        articles.map((article) =>
          Notification.create({
            recipientId: article.authorId,
            type: "Status_Update",
            message: messageByArticleId.get(article._id.toString()),
            referenceId: article._id,
          }),
        ),
      );
    }

    if (io) {
      articles.forEach((article) => {
        const message = messageByArticleId.get(article._id.toString());
        io.to(article.authorId.toString()).emit("article_status_update", {
          status,
          articleId: article._id,
          message,
        });
        io.to(article.authorId.toString()).emit("refresh_notifications");
      });
    }

    const authorIds = [
      ...new Set(articles.map((article) => article.authorId.toString())),
    ];
    const authors = await User.find({ _id: { $in: authorIds } })
      .select("_id email")
      .lean();
    const authorEmailById = new Map(
      authors.map((author) => [author._id.toString(), author.email]),
    );

    await Promise.allSettled(
      articles.map((article) => {
        const email = authorEmailById.get(article.authorId.toString());
        if (!email) return Promise.resolve();

        return sendEmail({
          email,
          subject: `Article ${status}: ${article.title}`,
          message:
            status === "Rejected" && rejectionReason
              ? `Your article "${article.title}" was rejected.\nReason: ${rejectionReason}`
              : `Your article "${article.title}" was approved and published.`,
        });
      }),
    );
  }, "article status side effects");
};

// @desc    Create new article
// @route   POST /api/articles
// @access  Private
const createArticle = asyncHandler(async (req, res) => {
  const { title, content, tags, departments, summary } = req.body;

  // Assign article to the user's first active workspace
  const activeCompanyId = req.body.companyId || req.user.companyId[0];

  // 1. Generate the vector embedding for duplicate detection
  const plainContent = stripHtml(content);
  const textToEmbed = `Title: ${title}\nContent: ${plainContent}`;
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

  if (req.user.onboarding && !req.user.onboarding.submittedArticle) {
    await User.findByIdAndUpdate(req.user._id, {
      "onboarding.submittedArticle": true,
    });
  }

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

// @desc    Get article title suggestions for autocomplete
// @route   GET /api/articles/autocomplete
// @access  Private
const getArticleAutocomplete = asyncHandler(async (req, res) => {
  const keyword = req.query.q?.trim();

  if (!keyword) {
    return res.json([]);
  }

  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const articles = await Article.find({
    companyId: { $in: req.user.companyId },
    status: "Approved",
    title: { $regex: escapedKeyword, $options: "i" },
  })
    .select("title")
    .sort({ updatedAt: -1 })
    .limit(8)
    .lean();

  res.json(articles.map((article) => article.title));
});

// @desc    Get search metadata
// @route   GET /api/articles/search-metadata
// @access  Private
const getArticleSearchMetadata = asyncHandler(async (req, res) => {
  const tags = await Article.distinct("tags", {
    companyId: { $in: req.user.companyId },
    status: "Approved",
  });

  res.json({
    tags: tags
      .filter((tag) => typeof tag === "string" && tag.trim())
      .sort((a, b) => a.localeCompare(b)),
  });
});

// @desc    Get all articles for a company
// @route   GET /api/articles
// @access  Private
const getArticles = asyncHandler(async (req, res) => {
  const keyword = req.query.keyword?.trim();
  const tag = req.query.tag?.trim();
  const department = req.query.department?.trim();
  const dateFrom = req.query.dateFrom;
  const dateTo = req.query.dateTo;
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

  if (department) {
    filter.department = { $in: [department] };
  }

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const query = Article.find(filter)
    .populate("authorId", "firstName lastName avatar")
    .sort("-createdAt");

  if (!shouldPaginate) {
    const articles = await query.lean();
    return res.json(articles);
  }

  const skip = (page - 1) * limit;
  const [articles, total] = await Promise.all([
    query.select(SEARCH_RESULT_FIELDS).skip(skip).limit(limit).lean(),
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

  if (req.user.onboarding && !req.user.onboarding.readArticle) {
    await User.findByIdAndUpdate(req.user._id, {
      "onboarding.readArticle": true,
    });
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
      const updatedPlainContent = stripHtml(article.content);
      const textToEmbed = `Title: ${article.title}\nContent: ${updatedPlainContent}`;
      const newEmbedding = await generateEmbedding(textToEmbed);
      article.contentEmbedding = newEmbedding;
    } catch (error) {
      console.error("Failed to update embedding:", error);
    }
  }

  const updatedArticle = await article.save();

  if (updatedArticle.subscribers && updatedArticle.subscribers.length > 0) {
    const io = req.app?.get?.("io");
    const recipientIds = updatedArticle.subscribers.filter(
      (subscriberId) => subscriberId.toString() !== req.user._id.toString(),
    );

    for (const recipientId of recipientIds) {
      const notification = await Notification.create({
        recipientId,
        type: "Article_Updated",
        message: `"${updatedArticle.title}" was updated.`,
        referenceId: updatedArticle._id,
      });

      if (io) {
        io.to(recipientId.toString()).emit("new_notification", notification);
        io.to(recipientId.toString()).emit("refresh_notifications");
      }
    }
  }

  res.json(updatedArticle);
});

/**
 * @desc    Toggle subscription to article change notifications
 * @route   POST /api/articles/:id/subscribe
 * @access  Private
 */
const subscribeToArticle = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to subscribe to this article");
  }

  const userId = req.user._id;
  const isSubscribed = article.subscribers.some(
    (subscriberId) => subscriberId.toString() === userId.toString(),
  );

  if (isSubscribed) {
    article.subscribers.pull(userId);
  } else {
    article.subscribers.push(userId);
  }

  await article.save();

  res.json({ subscribed: !isSubscribed });
});
const approveRejectArticle = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;
  const article = await Article.findById(req.params.id).select(
    "+contentEmbedding",
  );

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
  const io = req.app?.get?.("io");
  await queueArticleStatusSideEffects({
    articles: [article],
    status,
    rejectionReason,
    io,
  });

  res.json(reviewedArticle);
});

/**
 * @desc    Get user's own articles (Dashboard)
 * @route   GET /api/articles/my-articles
 * @access  Private
 */
const getUserArticles = asyncHandler(async (req, res) => {
  const limit = Number.parseInt(req.query.limit || "0", 10);

  const query = Article.find({ authorId: req.user._id })
    .sort({
      updatedAt: -1,
    })
    .select(DASHBOARD_ARTICLE_FIELDS)
    .lean();

  if (limit > 0) {
    query.limit(limit);
  }

  const articles = await query;
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
  })
    .populate("authorId", "firstName lastName")
    .select(DASHBOARD_ARTICLE_FIELDS)
    .lean();

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
    .sort({ createdAt: -1 })
    .select(FAVORITE_ARTICLE_FIELDS)
    .lean();

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
    .select("title department viewCount status")
    .lean();

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
  const department = req.query.department?.trim();

  const filter = {
    companyId: { $in: req.user.companyId },
    status: "Approved",
    expiresAt: { $lte: thirtyDaysFromNow },
  };

  if (department) {
    filter.department = { $in: [department] };
  }

  const articles = await Article.find(filter)
    .select("title expiresAt lastReviewedAt authorId")
    .populate("authorId", "firstName lastName")
    .sort({ expiresAt: 1 })
    .lean();

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
  })
    .select("title authorId companyId +contentEmbedding")
    .lean();

  for (const article of articles) {
    article.status = status;
    article.approverId = req.user._id;
    article.rejectionReason =
      status === "Rejected" ? rejectionReason || null : null;
  }

  if (articles.length > 0) {
    await Article.bulkWrite(
      articles.map((article) => ({
        updateOne: {
          filter: { _id: article._id },
          update: {
            $set: {
              status,
              approverId: req.user._id,
              rejectionReason:
                status === "Rejected" ? rejectionReason || null : null,
            },
          },
        },
      })),
    );
  }

  const io = req.app?.get?.("io");
  await queueArticleStatusSideEffects({
    articles,
    status,
    rejectionReason,
    io,
  });

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

  const mentionMatches = [...req.body.message.matchAll(/\B@(\w+)/g)];
  const mentionedNames = [...new Set(mentionMatches.map((match) => match[1]))];

  if (mentionedNames.length > 0) {
    const mentionedUsers = await User.find({
      companyId: { $in: req.user.companyId },
      firstName: {
        $in: mentionedNames.map((name) => new RegExp(`^${name}$`, "i")),
      },
    }).select("_id");

    const io = req.app.get("io");
    for (const mentionedUser of mentionedUsers) {
      if (mentionedUser._id.toString() === req.user._id.toString()) continue;

      const notification = await Notification.create({
        recipientId: mentionedUser._id,
        type: "Mention",
        message: `${req.user.firstName} mentioned you in a comment on "${article.title}".`,
        referenceId: article._id,
      });

      if (io) {
        io.to(mentionedUser._id.toString()).emit(
          "new_notification",
          notification,
        );
        io.to(mentionedUser._id.toString()).emit("refresh_notifications");
      }
    }
  }

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

  const [analytics] = await Article.aggregate([
    {
      $match: {
        companyId: { $in: req.user.companyId },
        status: "Approved",
      },
    },
    {
      $facet: {
        totals: [{ $count: "count" }],
        topViewed: [
          { $sort: { viewCount: -1, createdAt: -1 } },
          { $limit: 5 },
          {
            $project: {
              title: 1,
              views: "$viewCount",
              upvotes: { $size: "$upvotes" },
              downvotes: { $size: "$downvotes" },
            },
          },
        ],
        topVoted: [
          {
            $project: {
              title: 1,
              views: "$viewCount",
              upvotes: { $size: "$upvotes" },
              downvotes: { $size: "$downvotes" },
              score: {
                $subtract: [{ $size: "$upvotes" }, { $size: "$downvotes" }],
              },
            },
          },
          { $sort: { score: -1, views: -1, createdAt: -1 } },
          { $limit: 5 },
        ],
      },
    },
  ]);

  res.json({
    totals: analytics?.totals?.[0]?.count || 0,
    topViewed: analytics?.topViewed || [],
    topVoted: analytics?.topVoted || [],
  });
});

/**
 * @desc    Get semantically related articles
 * @route   GET /api/articles/:id/related
 * @access  Private
 */
const getRelatedArticles = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id).select(
    "+contentEmbedding",
  );

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to view this article");
  }

  if (
    !Array.isArray(article.contentEmbedding) ||
    article.contentEmbedding.length === 0
  ) {
    return res.json([]);
  }

  let relatedArticles = [];
  try {
    relatedArticles = await Article.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "contentEmbedding",
          queryVector: article.contentEmbedding,
          numCandidates: 20,
          limit: 5,
          filter: {
            companyId: article.companyId,
            status: "Approved",
          },
        },
      },
      {
        $match: { _id: { $ne: article._id } },
      },
      {
        $limit: 4,
      },
      {
        $project: {
          title: 1,
          summary: 1,
          authorId: 1,
        },
      },
    ]);
  } catch (error) {
    console.error("Failed to fetch related articles:", error);
  }

  res.json(relatedArticles);
});

/**
 * @desc    Get engagement metrics for an article
 * @route   GET /api/articles/:id/metrics
 * @access  Private (Author or Manager/Admin)
 */
const getArticleMetrics = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);

  if (!article) {
    res.status(404);
    throw new Error("Article not found");
  }

  if (!hasCompanyAccess(req.user, article.companyId)) {
    res.status(403);
    throw new Error("Not authorized to view metrics for this article");
  }

  const isAuthor = article.authorId.toString() === req.user._id.toString();
  if (!isAuthor && !isElevatedUser(req.user)) {
    res.status(403);
    throw new Error("Not authorized to view metrics for this article");
  }

  const helpfulCount = article.feedback.filter((f) => f.isHelpful).length;
  const notHelpfulCount = article.feedback.filter((f) => !f.isHelpful).length;

  res.json({
    viewCount: article.viewCount,
    upvoteCount: article.upvotes.length,
    downvoteCount: article.downvotes.length,
    helpfulCount,
    notHelpfulCount,
    feedbackCount: article.feedback.length,
    commentCount: article.comments.length,
  });
});

export {
  createArticle,
  checkDuplicateArticle,
  getArticles,
  getArticleAutocomplete,
  getArticleSearchMetadata,
  getArticleById,
  updateArticle,
  subscribeToArticle,
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
  getRelatedArticles,
  getArticleMetrics,
};
