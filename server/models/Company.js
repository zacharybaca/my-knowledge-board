import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

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

      // 1. Cleanup Cloudinary Company Logo
      if (this.imagePublicId) {
        await cloudinary.uploader.destroy(this.imagePublicId);
        console.log(`✅ Cloudinary image removed: ${this.imagePublicId}`);
      }

      // 2. Cascade Delete Articles
      // We loop and call .deleteOne() on each document so Article pre-delete hooks fire
      const articles = await mongoose.model("Article").find({ companyId });
      for (const article of articles) {
        await article.deleteOne();
      }
      console.log(
        `✅ Deleted ${articles.length} articles for company: ${companyId}`,
      );

      // 3. Cascade Delete or Update Users
      // Finds any user that has this companyId (works for both String and Array types)
      const users = await mongoose.model("User").find({ companyId: companyId });

      for (const user of users) {
        // If your User schema supports multiple workspaces (companyId is an Array)
        if (Array.isArray(user.companyId)) {
          // Remove this specific company from their array
          user.companyId = user.companyId.filter(
            (id) => id.toString() !== companyId.toString(),
          );

          // If they belong to NO other companies, delete the user entirely
          if (user.companyId.length === 0) {
            await user.deleteOne();
          } else {
            // Otherwise, save the user with the updated array
            await user.save();
          }
        } else {
          // If the schema is 1-to-1 (companyId is a single ObjectId), delete the user
          await user.deleteOne();
        }
      }
      console.log(
        `✅ Processed ${users.length} users for company: ${companyId}`,
      );

      next();
    } catch (error) {
      console.error("❌ Middleware Cleanup Error:", error);
      next(error); // Pass the error to stop the deletion if something critically fails
    }
  },
);

const Company = mongoose.model("Company", companySchema);

export default Company;
