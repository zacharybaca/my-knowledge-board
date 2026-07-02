import asyncHandler from "express-async-handler";
import SessionLog from "../models/SessionLog.js";
import User from "../models/User.js";

const getUserRoles = (user) =>
  Array.isArray(user?.role) ? user.role : [user?.role].filter(Boolean);

const canManageSessions = (user) => {
  const roles = getUserRoles(user);
  return roles.includes("Admin") || roles.includes("Manager");
};

const getManagedUserIds = async (companyIds = []) => {
  const users = await User.find({ companyId: { $in: companyIds } }).select("_id");
  return users.map((user) => user._id);
};

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
  if (!canManageSessions(req.user)) {
    res.status(403);
    throw new Error("Not authorized to view session logs");
  }

  const managedUserIds = await getManagedUserIds(req.user.companyId || []);
  const logs = await SessionLog.find({ userId: { $in: managedUserIds } })
    .populate("userId", "firstName lastName email department")
    .sort({ loginTime: -1 })
    .limit(100);

  res.json(logs);
});

/**
 * @desc    Clear all session logs for caller's company workspaces
 * @route   DELETE /api/sessions
 * @access  Private (Manager/Admin Only)
 */
export const clearSessions = asyncHandler(async (req, res) => {
  if (!canManageSessions(req.user)) {
    res.status(403);
    throw new Error("Not authorized to clear session logs");
  }

  const managedUserIds = await getManagedUserIds(req.user.companyId || []);
  const result = await SessionLog.deleteMany({ userId: { $in: managedUserIds } });

  res.json({
    message: "Access logs cleared successfully",
    deletedCount: result.deletedCount || 0,
  });
});
