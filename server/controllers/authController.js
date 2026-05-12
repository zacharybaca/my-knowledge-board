import User from "../models/User.js";
import Company from "../models/Company.js"; // Needed for domain validation
import generateToken from "../utils/generateToken.js";
import asyncHandler from "express-async-handler";
import crypto from "crypto";

const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, companyId } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Optional: Validate that the email domain matches the company's registered domain
  const company = await Company.findById(companyId);
  if (!company) {
    res.status(400);
    throw new Error("Selected company does not exist");
  }

  const emailDomain = email.split('@')[1];
  if (company.emailDomain !== emailDomain) {
    res.status(400);
    throw new Error(`Email must belong to the domain: ${company.emailDomain}`);
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    companyId
  });

  if (user) {
    generateToken(res, user._id);
    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body; // Removed username
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    generateToken(res, user._id);
    res.status(200).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

// Update forgotPassword message to be more generic since the app name is TBD
const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    res.status(404);
    throw new Error("There is no user registered with that email address.");
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

  const message = `
    You are receiving this email because a password reset was requested for your account.
    Please click the link below to reset your password. This link will expire in 10 minutes:
    \n\n ${resetUrl}
    \n\nIf you did not request this, ignore this email.
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset Request",
      message: message,
    });
    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(500);
    throw new Error("Email could not be sent.");
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  isUserAdmin,
  forgotPassword,
  resetPassword,
};
