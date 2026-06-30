import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import ContentGapLog from "../models/ContentGapLog.js";

const isElevatedUser = (user) =>
  user?.role?.includes("Admin") || user?.role?.includes("Manager");

// @desc    Get content gap analytics (unanswered questions)
// @route   GET /api/analytics/content-gaps
// @access  Private (Manager/Admin)
const getContentGaps = asyncHandler(async (req, res) => {
  if (!isElevatedUser(req.user)) {
    res.status(403);
    throw new Error("Not authorized to access analytics");
  }

  const companyIds = req.user.companyId.map((id) =>
    typeof id === "string" ? new mongoose.Types.ObjectId(id) : id,
  );

  const filter = { companyId: { $in: companyIds } };

  const [logs, topGaps, total] = await Promise.all([
    ContentGapLog.find(filter)
      .populate("userId", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(100),
    ContentGapLog.aggregate([
      { $match: { companyId: { $in: companyIds } } },
      {
        $group: {
          _id: "$question",
          count: { $sum: 1 },
          lastAsked: { $max: "$createdAt" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    ContentGapLog.countDocuments(filter),
  ]);

  res.json({ logs, topGaps, total });
});

export { getContentGaps };
