import express from "express";
import {
  getUserProfile,
  updateUserProfile,
  getCompanyDirectory,
  getCompanyManagers,
  toggleFavoriteArticle,
  deleteUser,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Profile Routes
 * GET: Retrieve logged-in user data
 * PUT: Update user data (including avatar)
 * DELETE: Remove account and cleanup Cloudinary/Submissions
 */
router
  .route("/profile")
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile)
  .delete(protect, deleteUser);

/**
 * Directory & Assignment Routes
 */
router.get("/directory", protect, getCompanyDirectory);
router.get("/managers", protect, getCompanyManagers);

/**
 * Article Interaction Routes
 */
router.patch("/favorites/:articleId", protect, toggleFavoriteArticle);

export default router;
