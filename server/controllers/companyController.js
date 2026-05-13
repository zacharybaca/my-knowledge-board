import Company from "../models/Company.js";
import User from "../models/User.js";
import asyncHandler from "express-async-handler";
import sendEmail from "../utils/sendEmail.js";

// @desc    Register a new company and initial Admin user
// @route   POST /api/companies/register
const registerCompany = asyncHandler(async (req, res) => {
  const { companyName, emailDomain, firstName, lastName, email, password } =
    req.body;

  // 1. Organization Name Verification (Blocklist)
  const reservedNames = [
    "admin",
    "system",
    "support",
    "billing",
    "knowledgebase",
    "root",
  ];
  if (reservedNames.includes(companyName.toLowerCase().trim())) {
    res.status(400);
    throw new Error("This organization name is reserved and cannot be used.");
  }

  const companyExists = await Company.findOne({
    $or: [{ name: companyName }, { emailDomain }],
  });

  if (companyExists) {
    res.status(400);
    throw new Error("Company name or domain is already registered");
  }

  // 2. Admin Email Verification (Domain Match)
  const providedEmailDomain = email.split("@")[1];
  if (providedEmailDomain !== emailDomain) {
    res.status(400);
    throw new Error(
      `Admin email must match the registered domain: ${emailDomain}`,
    );
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("Admin email is already in use");
  }

  // 3. Create Pending Company
  const company = await Company.create({
    name: companyName,
    emailDomain,
    status: "Pending",
    isActive: false,
  });

  // 4. Create Pending Admin User
  const adminUser = await User.create({
    firstName,
    lastName,
    email,
    password,
    companyId: company._id,
    role: "Admin",
    isAdmin: true,
    isVerified: false,
  });

  company.createdBy = adminUser._id;
  await company.save();

  // 5. The Token Loop: Generate and Send Email
  const verifyToken = adminUser.getVerificationToken();
  await adminUser.save({ validateBeforeSave: false });

  // Create verification URL (pointing to your React frontend)
  const verifyUrl = `${process.env.CLIENT_URL}/verify-workspace/${verifyToken}`;

  try {
    await sendEmail({
      email: adminUser.email,
      templateId: "d-50a1f9504c1444b09b0211bf7189b254",
      dynamicTemplateData: {
        url: verifyUrl,
        workspaceName: company.name,
      },
    });

    // NOTE: We do NOT generate a JWT login token here anymore.
    res.status(201).json({
      success: true,
      message:
        "Registration received. Please check your email to activate your workspace.",
    });
  } catch (error) {
    // Rollback if email fails
    await User.findByIdAndDelete(adminUser._id);
    await Company.findByIdAndDelete(company._id);
    res.status(500);
    throw new Error("Email could not be sent. Registration cancelled.");
  }
});

// @desc    Get all companies (for registration dropdown)
// @route   GET /api/companies
const getCompanies = asyncHandler(async (req, res) => {
  const companies = await Company.find({ isActive: true }).select("name _id");
  res.status(200).json(companies);
});

export { registerCompany, getCompanies };
