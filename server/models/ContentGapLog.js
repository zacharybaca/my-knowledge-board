import mongoose from "mongoose";

const contentGapLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    type: {
      type: String,
      enum: ["unanswered_chat", "failed_search"],
      default: "unanswered_chat",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

const ContentGapLog = mongoose.model("ContentGapLog", contentGapLogSchema);

export default ContentGapLog;
