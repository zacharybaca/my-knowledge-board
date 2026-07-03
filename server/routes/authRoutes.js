import express from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  forgotPassword,
  resetPassword,
  verifyWorkspace,
} from "../controllers/authController.js";
import { upload } from "../middleware/cloudinary.js";
import { authRateLimiter } from "../middleware/rateLimitMiddleware.js";
import {
  validateForgotPassword,
  validateLogin,
  validateRegistration,
  validateResetPassword,
} from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post(
  "/register",
  authRateLimiter,
  upload.single("avatar"),
  validateRegistration,
  registerUser,
);
router.post("/login", authRateLimiter, validateLogin, loginUser);
router.post("/logout", logoutUser);
router.post(
  "/forgotpassword",
  authRateLimiter,
  validateForgotPassword,
  forgotPassword,
);
router.put(
  "/resetpassword/:token",
  authRateLimiter,
  validateResetPassword,
  resetPassword,
);
router.get("/verify/:token", verifyWorkspace);

export default router;
