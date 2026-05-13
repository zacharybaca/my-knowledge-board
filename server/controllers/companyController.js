import Company from "../models/Company.js";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import asyncHandler from "express-async-handler";

// @desc    Register a new company and initial Admin user
// @route   POST /api/companies/register
const registerCompany = asyncHandler(async (req, res) => {
  const { companyName, emailDomain, firstName, lastName, email, password } = req.body;

  // 1. Verify Domain and Company Name availability
  const companyExists = await Company.findOne({
    $or: [{ name: companyName }, { emailDomain }]
  });

  if (companyExists) {
    res.status(400);
    throw new Error("Company name or domain is already registered");
  }

  // 2. Verify Admin Email availability
  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error("Admin email is already in use");
  }

  // 3. Domain match validation for the Admin
  const providedEmailDomain = email.split('@')[1];
  if (providedEmailDomain !== emailDomain) {
    res.status(400);
    throw new Error(`Admin email must match the registered domain: ${emailDomain}`);
  }

  // 4. Create Company
  const company = await Company.create({
    name: companyName,
    emailDomain
  });

  // 5. Create Admin User tied to the new Company
  if (company) {
    const adminUser = await User.create({
      firstName,
      lastName,
      email,
      password,
      companyId: company._id,
      role: 'Admin', // Elevate initial user
      isAdmin: true
    });

    if (adminUser) {
      // Set createdBy on the company now that the user exists
      company.createdBy = adminUser._id;
      await company.save();

      generateToken(res, adminUser._id);

      res.status(201).json({
        _id: adminUser._id,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        email: adminUser.email,
        role: adminUser.role,
        companyId: company._id,
        companyName: company.name
      });
    } else {
      // Rollback company creation if user creation fails
      await Company.findByIdAndDelete(company._id);
      res.status(400);
      throw new Error("Failed to create admin user account");
    }
  } else {
    res.status(400);
    throw new Error("Failed to create company workspace");
  }
});

// @desc    Get all companies (for registration dropdown)
// @route   GET /api/companies
const getCompanies = asyncHandler(async (req, res) => {
  const companies = await Company.find({ isActive: true }).select('name _id');
  res.status(200).json(companies);
});

export { registerCompany, getCompanies };
