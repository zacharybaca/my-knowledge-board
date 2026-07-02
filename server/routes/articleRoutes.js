import express from "express";
import {
  createArticle,
  getArticles,
  getArticleAutocomplete,
  getArticleById,
  updateArticle,
  subscribeToArticle,
  approveRejectArticle,
  getUserArticles,
  getPendingArticles,
  getFavoriteArticles,
  getTopArticles,
  voteArticle,
  submitArticleFeedback,
  getReviewQueue,
  certifyArticle,
  checkDuplicateArticle,
  deleteArticle,
  bulkUpdateArticleStatus,
  getArticleAnalytics,
  getArticleRevisions,
  rollbackArticleRevision,
  addArticleComment,
  getRelatedArticles,
  getArticleMetrics,
} from "../controllers/articleController.js";
import { protect } from "../middleware/authMiddleware.js"; // Ensure your auth middleware is imported
import {
  validateArticlePayload,
  validateArticleStatus,
  validateBulkArticleStatus,
  validateComment,
  validateSearchQuery,
} from "../middleware/validationMiddleware.js";

const router = express.Router();

// 1. Static Routes (Must come first)
router
  .route("/")
  .post(protect, validateArticlePayload, createArticle)
  .get(protect, validateSearchQuery, getArticles);
router.get("/my-articles", protect, getUserArticles);
router.get("/pending", protect, getPendingArticles);
router.get("/top", protect, getTopArticles);
router.get("/autocomplete", protect, getArticleAutocomplete);
router.route("/review-queue").get(protect, getReviewQueue);
router.route("/analytics").get(protect, getArticleAnalytics);
router
  .route("/bulk-status")
  .patch(protect, validateBulkArticleStatus, bulkUpdateArticleStatus);

// CRITICAL: /favorites must be defined before /:id
router.get("/favorites", protect, getFavoriteArticles);

// 2. Dynamic Routes (/:id catches everything else)
router.post("/check-duplicate", protect, checkDuplicateArticle);
router
  .route("/:id")
  .get(protect, getArticleById)
  .put(protect, validateArticlePayload, updateArticle)
  .delete(protect, deleteArticle);
router.route("/:id/feedback").post(protect, submitArticleFeedback);
router.route("/:id/certify").patch(protect, certifyArticle);
router.route("/:id/comments").post(protect, validateComment, addArticleComment);
router.route("/:id/revisions").get(protect, getArticleRevisions);
router.route("/:id/rollback").patch(protect, rollbackArticleRevision);
router.route("/:id/related").get(protect, getRelatedArticles);
router.route("/:id/metrics").get(protect, getArticleMetrics);
router.route("/:id/subscribe").post(protect, subscribeToArticle);

router.patch(
  "/:id/status",
  protect,
  validateArticleStatus,
  approveRejectArticle,
);
router.patch("/:id/vote", protect, voteArticle);

export default router;
