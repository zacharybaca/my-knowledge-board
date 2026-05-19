import mongoose from "mongoose";

const articleSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    title: { type: String, required: true },
    content: { type: String, required: true }, // HTML or Markdown string
    tags: [{ type: String }],
    status: {
      type: String,
      enum: ["Draft", "Pending", "Approved", "Rejected"],
      default: "Draft",
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    }, // Manager who approved/rejected
    rejectionReason: { type: String, default: null },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Indexing for text search across title and content
articleSchema.index({ title: "text", content: "text", tags: "text" });

const Article = mongoose.model("Article", articleSchema);

export default Article;
