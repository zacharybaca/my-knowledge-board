import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a company name"],
      unique: true,
      trim: true,
    },
    emailDomain: {
      type: String,
      required: [true, "Please add an authorized email domain"],
      unique: true,
      lowercase: true,
      trim: true,
      // Ensures the domain format (e.g., company.com)
      match: [
        /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please add a valid email domain",
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Optional: track which user initially registered the company
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Index for performance on domain lookups during registration
companySchema.index({ emailDomain: 1 });

const Company = mongoose.model("Company", companySchema);

export default Company;
