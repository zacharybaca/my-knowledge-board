/**
 * seedUsers.js
 *
 * Creates a fixed set of Employee accounts in MongoDB.
 * Passwords are hashed automatically via the User pre-save hook.
 * Each user is assigned to the first active Company found in the DB
 * unless --company-id=<id> is provided.
 *
 * Usage (run from the server/ directory):
 *   node -r dotenv/config scripts/seedUsers.js
 *   node -r dotenv/config scripts/seedUsers.js --company-id=<ObjectId>
 *   node -r dotenv/config scripts/seedUsers.js --clear
 *
 * Options:
 *   --company-id=<id>   Target a specific Company ObjectId
 *   --clear             Remove the seeded users (by email) before re-inserting
 */

import mongoose from "mongoose";
import User from "../models/User.js";
import Company from "../models/Company.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const GIVEN_COMPANY_ID = args["company-id"] ?? null;
const CLEAR = args["clear"] === true || args["clear"] === "true";

// ---------------------------------------------------------------------------
// User definitions
// ---------------------------------------------------------------------------
const DOMAIN = "fullstackbyzach.tech";
const PASSWORD = "testing";

const USERS = [
  { firstName: "Efrain", lastName: "Chavez" },
  { firstName: "Melissa", lastName: "Bowerson" },
  { firstName: "Avery", lastName: "Schoof" },
  { firstName: "Isabelle", lastName: "Voltz" },
  { firstName: "Daniel", lastName: "Cigan" },
  { firstName: "Cody", lastName: "Davis" },
  { firstName: "Renee", lastName: "Blackburn" },
  { firstName: "Trent", lastName: "Saulsgiver" },
  { firstName: "Luis", lastName: "Garces" },
  { firstName: "Ezekiel", lastName: "Jennings" },
  { firstName: "Nikki", lastName: "Edwards" },
  { firstName: "Emma", lastName: "Searing" },
].map((u) => ({
  ...u,
  email: `${u.firstName[0].toLowerCase()}${u.lastName.toLowerCase()}@${DOMAIN}`,
  password: PASSWORD,
  role: ["Employee"],
  department: "Other",
  isVerified: true,
}));

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Resolve company
  let companyId;
  if (GIVEN_COMPANY_ID) {
    companyId = new mongoose.Types.ObjectId(GIVEN_COMPANY_ID);
  } else {
    const company = await Company.findOne({ isActive: true }).lean();
    if (!company) {
      console.warn(
        "⚠️  No active company found — users will be created without a companyId.",
      );
    } else {
      companyId = company._id;
      console.log(`ℹ️  Using company: ${company.name} (${companyId})`);
    }
  }

  const emails = USERS.map((u) => u.email);

  if (CLEAR) {
    const { deletedCount } = await User.deleteMany({ email: { $in: emails } });
    console.log(`🗑️  Removed ${deletedCount} existing seeded user(s)`);
  }

  let created = 0;
  let skipped = 0;

  for (const userData of USERS) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      console.log(`⏭️  Skipping ${userData.email} — already exists`);
      skipped++;
      continue;
    }

    const user = new User({
      ...userData,
      companyId: companyId ? [companyId] : [],
    });

    await user.save();
    console.log(`✅ Created ${user.firstName} ${user.lastName} <${user.email}>`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
