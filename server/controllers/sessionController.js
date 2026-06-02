import asyncHandler from "express-async-handler";
import SessionLog from "../models/SessionLog.js";

/**
 * @desc    Start a new user session
 * @route   POST /api/sessions/start
 * @access  Private
 */
export const startSession = asyncHandler(async (req, res) => {
  const session = await SessionLog.create({
    userId: req.user._id,
    loginTime: Date.now(),
  });

  res.status(201).json({ sessionId: session._id });
});

/**
 * @desc    End an active user session and calculate duration
 * @route   PATCH /api/sessions/end
 * @access  Private
 */
export const endSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    res.status(400);
    throw new Error("Session ID is required");
  }

  const session = await SessionLog.findById(sessionId);

  if (!session || session.userId.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error("Session not found");
  }

  session.logoutTime = Date.now();

  const durationMs = session.logoutTime.getTime() - session.loginTime.getTime();
  session.durationMinutes = Math.round(durationMs / 60000);

  await session.save();

  res.json({ message: "Session ended", duration: session.durationMinutes });
});

/**
 * @desc    Get all session logs
 * @route   GET /api/sessions
 * @access  Private (Manager/Admin Only)
 */
export const getAllSessions = asyncHandler(async (req, res) => {
  // 1. Force the role into an array regardless of how it was cached in the JWT
  const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];

  if (!userRoles.includes("Admin") && !userRoles.includes("Manager")) {
    res.status(403);
    throw new Error("Not authorized to view session logs");
  }

  const logs = await SessionLog.find()
    .populate("userId", "firstName lastName email department")
    .sort({ loginTime: -1 })
    .limit(100);

  res.json(logs);
});
