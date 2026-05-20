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
} from "../controllers/articleController.js";
import { protect, manager } from "../middleware/authMiddleware.js";

const router = express.Router();

// NOTE: Static routes (/my-articles, /pending) must be declared before dynamic routes (/:id) to prevent interception.

router.get("/my-articles", protect, getUserArticles);
router.get("/pending", protect, manager, getPendingArticles);
router.get("/favorites", protect, getFavoriteArticles);

router.route("/").get(protect, getArticles).post(protect, createArticle);

router.route("/:id").get(protect, getArticleById).put(protect, updateArticle);

router.patch("/:id/status", protect, manager, approveRejectArticle);

export default router;
