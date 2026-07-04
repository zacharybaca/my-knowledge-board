import mongoose from "mongoose";

const sessionLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    loginTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    logoutTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

sessionLogSchema.index({ userId: 1, loginTime: -1 });

export default mongoose.model("SessionLog", sessionLogSchema);
