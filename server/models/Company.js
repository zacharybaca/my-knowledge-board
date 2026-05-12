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
      unique: true, // Automatically creates the necessary index
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please add a valid email domain",
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Company = mongoose.model("Company", companySchema);

export default Company;
