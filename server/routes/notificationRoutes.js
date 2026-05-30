import express from "express";
import {
  getUserNotifications,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js"; // Ensure path matches your project structure

const router = express.Router();

router.route("/").get(protect, getUserNotifications);
router.route("/:id/read").patch(protect, markNotificationRead);

export default router;
