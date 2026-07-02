import User from "../models/User.js";
import Company from "../models/Company.js";
import generateToken from "../utils/generateToken.js";
import asyncHandler from "express-async-handler";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // no-op
    }

    return [trimmed];
  }

  return [];
};

// @desc    Register a new employee/user
// @route   POST /api/auth/register
const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, department, companyId } =
    req.body;
  const normalizedDepartments = normalizeStringArray(department);
  const normalizedCompanyIds = normalizeStringArray(companyId);

  if (normalizedDepartments.length === 0) {
    res.status(400);
    throw new Error("At least one department is required");
  }

  if (normalizedCompanyIds.length === 0) {
    res.status(400);
    throw new Error("At least one company workspace is required");
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // UPDATED: companyId is initialized as an array containing the provided ID
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    department: normalizedDepartments,
    companyId: normalizedCompanyIds,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Chain populate to embed the company object
  const user = await User.findOne({ email }).populate(
    "companyId",
    "name imageUrl",
  );

  if (user && (await user.matchPassword(password))) {
    if (user.isSuspended) {
      res.status(403);
      throw new Error(
        `Account Suspended: ${user.suspensionReason || "Please contact your manager."}`,
      );
    }

    generateToken(res, user._id);

    if (
      user.companyId?.length > 0 &&
      user.onboarding &&
      !user.onboarding.joinedWorkspace
    ) {
      user.onboarding.joinedWorkspace = true;
      await user.save({ validateBeforeSave: false });
    }

    res.status(200).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      companyId: user.companyId, // Transmits populated object
      department: user.department,
      avatar: user.avatar,
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

/**
 * @desc    Logout user / clear cookie
 * @route   POST /api/auth/logout
 * @access  Public
 */
const logoutUser = asyncHandler(async (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
  });

  res.status(200).json({ message: "User logged out" });
});

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

// @desc    Verify user email and activate workspace
// @route   GET /api/auth/verify/:token
// @access  Public
const verifyWorkspace = asyncHandler(async (req, res) => {
  const verifyTokenHash = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  // Chain populate to embed the company object
  const user = await User.findOne({
    verificationToken: verifyTokenHash,
    verificationExpire: { $gt: Date.now() },
  }).populate("companyId", "name imageUrl");

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired verification token");
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationExpire = undefined;
  await user.save();

  // Handle Mongoose populate object reference for findById
  const companyRef = Array.isArray(user.companyId)
    ? user.companyId[0]
    : user.companyId;
  const companyId = companyRef?._id || companyRef;

  if (companyId) {
    const company = await Company.findById(companyId);
    if (company) {
      company.status = "Active";
      company.isActive = true;
      await company.save();
    }
  }

  generateToken(res, user._id);

  res.status(200).json({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    companyId: user.companyId, // Transmits populated object
    department: user.department,
    avatar: user.avatar,
    message: "Workspace activated successfully!",
  });
});

export { registerUser, loginUser, logoutUser, forgotPassword, verifyWorkspace };
