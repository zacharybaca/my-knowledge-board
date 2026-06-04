import Company from "../models/Company.js";
import User from "../models/User.js";
import asyncHandler from "express-async-handler";
import sendEmail from "../utils/sendEmail.js";

// @desc    Register a new company and initial Admin user
// @route   POST /api/companies/register
const registerCompany = asyncHandler(async (req, res) => {
  const {
    companyName,
    emailDomain,
    firstName,
    lastName,
    email,
    password,
    department,
  } = req.body;

  if (!department) {
    res.status(400);
    throw new Error("Please select a department for the admin user.");
  }

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

  let imageUrl = "";
  let imagePublicId = "";

  if (req.file) {
    imageUrl = req.file.path;
    imagePublicId = req.file.filename;
  }

  const company = await Company.create({
    name: companyName,
    emailDomain,
    imageUrl,
    imagePublicId,
    status: "Pending",
    isActive: false,
  });

  const adminUser = await User.create({
    firstName,
    lastName,
    email,
    password,
    department,
    companyId: [company._id], // UPDATED: Wrapped in array
    role: ["Admin"], // UPDATED: Wrapped in array to match schema
    isAdmin: true,
    isVerified: false,
  });

  company.createdBy = adminUser._id;
  await company.save();

  const verifyToken = adminUser.getVerificationToken();
  await adminUser.save({ validateBeforeSave: false });

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

    res.status(201).json({
      success: true,
      message:
        "Registration received. Please check your email to activate your workspace.",
    });
  } catch (error) {
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

// @desc    Delete a company workspace and all associated data
// @route   DELETE /api/companies/:id
// @access  Private/Admin
const deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);

  if (!company) {
    res.status(404);
    throw new Error("Workspace not found");
  }

  // Double check authorization
  if (!req.user.role.includes("Admin")) {
    res.status(403);
    throw new Error("Not authorized to delete workspaces.");
  }

  // Trigger the pre('deleteOne') cascade hook
  await company.deleteOne();

  res.status(200).json({
    success: true,
    message: "Workspace and all associated data successfully deleted.",
  });
});

export { registerCompany, getCompanies, deleteCompany };
