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
    imageUrl: {
      type: String,
    },
    // Essential for Cloudinary cleanup
    imagePublicId: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Pending", "Active", "Suspended"],
      default: "Pending",
    },
    // Update isActive to derive from status or keep it as a secondary toggle
    isActive: {
      type: Boolean,
      default: false, // Changed from true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

companySchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      const companyId = this._id;

      // 1. Cleanup Cloudinary Image
      if (this.imagePublicId) {
        await cloudinary.uploader.destroy(this.imagePublicId);
        console.log(`✅ Cloudinary image removed: ${this.imagePublicId}`);
      }

      // 2. Delete Associated Users
      await mongoose.model("User").deleteMany({ company: companyId });
      console.log(`✅ Associated users deleted for company ID: ${companyId}`);

      next();
    } catch (error) {
      console.error("❌ Middleware Cleanup Error:", error);
      // We call next() anyway so the primary record is still deleted
      next();
    }
  },
);

const Company = mongoose.model("Company", companySchema);

export default Company;
