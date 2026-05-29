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
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    },
    lastReviewedAt: {
      type: Date,
      default: Date.now,
    },
    lastReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    department: {
      type: [String],
      required: true,
      enum: [
        "Customer Service",
        "Tech Support",
        "Human Resources",
        "Sales",
        "Marketing",
        "Engineering",
        "Product",
        "Finance",
        "Legal",
        "Operations",
        "Other",
      ],
    },
    feedback: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "User",
        },
        isHelpful: {
          type: Boolean,
          required: true,
        },
        comment: {
          type: String,
        },
        submittedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    title: { type: String, required: true },
    content: { type: String, required: true },
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
    },
    rejectionReason: { type: String, default: null },
    viewCount: { type: Number, default: 0 },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    downvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

// Assign weights explicitly to scale search matching relevance dynamically
articleSchema.index(
  { title: "text", tags: "text", content: "text" },
  { weights: { title: 10, tags: 5, content: 1 } }
);

const Article = mongoose.model("Article", articleSchema);

export default Article;
