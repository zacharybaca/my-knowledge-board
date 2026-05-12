import Company from "../models/Company.js";
import asyncHandler from "express-async-handler";

// @desc    Register a new company
// @route   POST /api/companies/register
const registerCompany = asyncHandler(async (req, res) => {
  const { name, emailDomain } = req.body;

  const companyExists = await Company.findOne({
    $or: [{ name }, { emailDomain }]
  });

  if (companyExists) {
    res.status(400);
    throw new Error("Company or domain already registered");
  }

  const company = await Company.create({ name, emailDomain });
  res.status(201).json(company);
});

// @desc    Get all companies (for registration dropdown)
// @route   GET /api/companies
const getCompanies = asyncHandler(async (req, res) => {
  const companies = await Company.find({ isActive: true }).select('name _id');
  res.status(200).json(companies);
});

export { registerCompany, getCompanies };
