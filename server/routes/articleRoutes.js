import express from "express";
import {
  createArticle,
  getArticles,
  getArticleById,
  updateArticle,
  approveRejectArticle,
  getUserArticles,
  getPendingArticles,
  getFavoriteArticles,
  getTopArticles,
  voteArticle,
  submitArticleFeedback,
  getReviewQueue,
  certifyArticle,
} from "../controllers/articleController.js";
import { protect } from "../middleware/authMiddleware.js"; // Ensure your auth middleware is imported

const router = express.Router();

// 1. Static Routes (Must come first)
router.route("/").post(protect, createArticle).get(protect, getArticles);
router.get("/my-articles", protect, getUserArticles);
router.get("/pending", protect, getPendingArticles);
router.get("/top", protect, getTopArticles);
router.route('/review-queue').get(protect, getReviewQueue);

// CRITICAL: /favorites must be defined before /:id
router.get("/favorites", protect, getFavoriteArticles);

// 2. Dynamic Routes (/:id catches everything else)
router.route("/:id").get(protect, getArticleById).put(protect, updateArticle);
router.route('/:id/feedback').post(protect, submitArticleFeedback);
router.route('/:id/certify').patch(protect, certifyArticle);

router.patch("/:id/status", protect, approveRejectArticle);
router.patch("/:id/vote", protect, voteArticle);

export default router;
