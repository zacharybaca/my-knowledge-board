import express from "express";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteReadNotifications,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js"; // Ensure path matches your project structure

const router = express.Router();

router.route("/").get(protect, getUserNotifications);
router.route("/read").delete(protect, deleteReadNotifications);
router.route("/read-all").patch(protect, markAllNotificationsRead);
router.route("/:id/read").patch(protect, markNotificationRead);

export default router;
