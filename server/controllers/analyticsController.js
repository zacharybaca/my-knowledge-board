import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import ContentGapLog from "../models/ContentGapLog.js";

const isElevatedUser = (user) =>
  user?.role?.includes("Admin") || user?.role?.includes("Manager");

const cosineSimilarity = (a, b) => {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
};

const GAP_RESOLUTION_THRESHOLD = 0.7;

/**
 * Deletes ContentGapLog entries whose questionEmbedding is semantically
 * similar to the provided article embedding (similarity >= threshold).
 * Non-fatal — errors are logged but never bubble up to the caller.
 */
const resolveContentGapsForArticle = async (articleEmbedding, companyId) => {
  if (!Array.isArray(articleEmbedding) || articleEmbedding.length === 0) return;
  try {
    const companyIds = Array.isArray(companyId) ? companyId : [companyId];
    const logs = await ContentGapLog.find(
      { companyId: { $in: companyIds } },
    ).select("+questionEmbedding");

    const toDelete = logs
      .filter(
        (log) =>
          Array.isArray(log.questionEmbedding) &&
          log.questionEmbedding.length > 0 &&
          cosineSimilarity(articleEmbedding, log.questionEmbedding) >=
            GAP_RESOLUTION_THRESHOLD,
      )
      .map((log) => log._id);

    if (toDelete.length > 0) {
      await ContentGapLog.deleteMany({ _id: { $in: toDelete } });
    }
  } catch (err) {
    console.error("Failed to resolve content gaps for article:", err);
  }
};

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

  const department = req.query.department?.trim();

  const filter = { companyId: { $in: companyIds } };
  const matchStage = { companyId: { $in: companyIds } };

  if (department) {
    filter.department = department;
    matchStage.department = department;
  }

  const [logs, topGaps, total] = await Promise.all([
    ContentGapLog.find(filter)
      .populate("userId", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(100),
    ContentGapLog.aggregate([
      { $match: matchStage },
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

export { getContentGaps, resolveContentGapsForArticle };
