import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import { v2 as cloudinary } from "cloudinary";

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("companyId", "name")
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

    // Handle Cloudinary Avatar Upload via multer middleware
    if (req.file) {
      // Delete old asset from Cloudinary if it exists
      if (user.avatarPublicId) {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      }

      // Assign new Cloudinary data from the req.file object
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
  const users = await User.find({ companyId: req.user.companyId })
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
  const managers = await User.find({
    companyId: req.user.companyId,
    role: "Manager",
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
    // Triggers the pre('deleteOne') hook for Cloudinary/Cascade cleanup
    await user.deleteOne();
    res.json({ message: "Account deleted successfully" });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

export {
  getUserProfile,
  updateUserProfile,
  getCompanyDirectory,
  getCompanyManagers,
  toggleFavoriteArticle,
  deleteUser,
};
