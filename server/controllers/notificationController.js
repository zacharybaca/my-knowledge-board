import asyncHandler from "express-async-handler";
import Notification from "../models/Notification.js";

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
export const getUserNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipientId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(notifications);
});

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: req.user._id },
    { isRead: true },
    { new: true }
  );

  if (notification) {
    res.json(notification);
  } else {
    res.status(404);
    throw new Error("Notification not found");
  }
});