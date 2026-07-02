import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import { v2 as cloudinary } from "cloudinary";

const hasManagerAccess = (user) => {
  const roles = Array.isArray(user?.role) ? user.role : [user?.role];
  return roles.includes("Admin") || roles.includes("Manager");
};

const hasSharedCompanyWorkspace = (requestUser, targetUser) =>
  targetUser?.companyId.some((id) =>
    requestUser.companyId.some((reqId) => reqId.toString() === id.toString()),
  );

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
  // Mongoose handles populating arrays of ObjectIds natively
  const user = await User.findById(req.user._id)
    .populate("companyId", "name imageUrl")
    .populate("managerId", "firstName lastName email")
    .select("-password");

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      user.password = req.body.password;
    }

    if (req.file) {
      if (user.avatarPublicId) {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      }
      user.avatar = req.file.path;
      user.avatarPublicId = req.file.filename;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      department: updatedUser.department,
      companyId: updatedUser.companyId,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

/**
 * @desc    Get all employees within the same company
 * @route   GET /api/users/directory
 * @access  Private
 */
const getCompanyDirectory = asyncHandler(async (req, res) => {
  const activeCompanyId = req.query.companyId || req.user.companyId[0];

  // Use $in to find users whose companyId array contains the active workspace
  const users = await User.find({ companyId: { $in: [activeCompanyId] } })
    .select("firstName lastName email role avatar")
    .sort({ lastName: 1 });

  res.json(users);
});

/**
 * @desc    Get list of Managers for assignment
 * @route   GET /api/users/managers
 * @access  Private
 */
const getCompanyManagers = asyncHandler(async (req, res) => {
  const activeCompanyId = req.query.companyId || req.user.companyId[0];

  // UPDATED: Array search for companyId
  const managers = await User.find({
    companyId: { $in: [activeCompanyId] },
    role: { $in: ["Manager"] },
  }).select("firstName lastName _id");

  res.json(managers);
});

/**
 * @desc    Toggle article in favorites list
 * @route   PATCH /api/users/favorites/:articleId
 * @access  Private
 */
const toggleFavoriteArticle = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { articleId } = req.params;

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const index = user.favoriteArticles.indexOf(articleId);

  if (index === -1) {
    user.favoriteArticles.push(articleId);
  } else {
    user.favoriteArticles.splice(index, 1);
  }

  await user.save();
  res.json({
    message: index === -1 ? "Added to favorites" : "Removed from favorites",
    favoriteArticles: user.favoriteArticles,
  });
});

/**
 * @desc    Delete user account
 * @route   DELETE /api/users/profile
 * @access  Private
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    await user.deleteOne();
    res.json({ message: "Account deleted successfully" });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

/**
 * @desc    Create a new Admin or Manager account
 * @route   POST /api/users/elevated
 * @access  Private (Admin/Manager Only)
 */
const createElevatedUser = asyncHandler(async (req, res) => {
  if (!req.user.role.includes("Admin") && !req.user.role.includes("Manager")) {
    res.status(403);
    throw new Error("Not authorized to create accounts");
  }

  const { firstName, lastName, email, password, department, role } = req.body;

  const rolesArray = Array.isArray(role) ? role : [role || "Employee"];
  const validRoles = ["Employee", "Manager", "Admin"];

  if (!rolesArray.every((r) => validRoles.includes(r))) {
    res.status(400);
    throw new Error("Invalid role selection");
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("An account with this email already exists");
  }

  const activeCompanyId = req.body.companyId || req.user.companyId[0];

  // UPDATED: Assign the new user to the active company inside an array
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    companyId: [activeCompanyId],
    department,
    role: rolesArray,
    isVerified: true,
  });

  if (user) {
    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

/**
 * @desc    Update user suspension status
 * @route   PATCH /api/users/:id/status
 * @access  Private (Manager/Admin Only)
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  if (!hasManagerAccess(req.user)) {
    res.status(403);
    throw new Error("Not authorized to modify user status");
  }

  const user = await User.findById(req.params.id);

  const hasSharedCompany = hasSharedCompanyWorkspace(req.user, user);

  if (!user || !hasSharedCompany) {
    res.status(404);
    throw new Error("User not found or access denied");
  }

  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error("Cannot suspend your own account");
  }

  user.isSuspended = req.body.isSuspended;
  user.suspensionReason = req.body.suspensionReason || "";

  await user.save();
  res.json({
    message: `User account ${user.isSuspended ? "suspended" : "restored"}`,
  });
});

/**
 * @desc    Delete user by ID (Manager/Admin action)
 * @route   DELETE /api/users/:id
 * @access  Private (Manager/Admin Only)
 */
const deleteUserById = asyncHandler(async (req, res) => {
  if (!hasManagerAccess(req.user)) {
    res.status(403);
    throw new Error("Not authorized to delete accounts");
  }

  const user = await User.findById(req.params.id);

  const hasSharedCompany = hasSharedCompanyWorkspace(req.user, user);

  if (!user || !hasSharedCompany) {
    res.status(404);
    throw new Error("User not found or access denied");
  }

  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error("Use the profile settings to delete your own account");
  }

  await user.deleteOne();
  res.json({ message: "User permanently deleted" });
});

/**
 * @desc    Update an existing user's role
 * @route   PATCH /api/users/:id/role
 * @access  Private (Manager/Admin Only)
 */
const updateUserRole = asyncHandler(async (req, res) => {
  if (!hasManagerAccess(req.user)) {
    res.status(403);
    throw new Error("Not authorized to modify user role");
  }

  const user = await User.findById(req.params.id);
  const hasSharedCompany = hasSharedCompanyWorkspace(req.user, user);

  if (!user || !hasSharedCompany) {
    res.status(404);
    throw new Error("User not found or access denied");
  }

  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error("Cannot update your own role");
  }

  const normalizedRoles = Array.isArray(req.body.role)
    ? req.body.role
    : [req.body.role].filter(Boolean);
  const validRoles = ["Employee", "Manager", "Admin"];

  if (
    normalizedRoles.length === 0 ||
    !normalizedRoles.every((role) => validRoles.includes(role))
  ) {
    res.status(400);
    throw new Error("Invalid role selection");
  }

  user.role = normalizedRoles;
  user.isAdmin = normalizedRoles.includes("Admin");
  await user.save();

  res.json({
    message: "User role updated successfully",
    data: {
      _id: user._id,
      role: user.role,
    },
  });
});

export {
  getUserProfile,
  updateUserProfile,
  getCompanyDirectory,
  getCompanyManagers,
  toggleFavoriteArticle,
  deleteUser,
  createElevatedUser,
  updateUserStatus,
  deleteUserById,
  updateUserRole,
};
