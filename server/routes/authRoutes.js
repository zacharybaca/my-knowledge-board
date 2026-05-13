import express from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  forgotPassword,
  verifyWorkspace,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.post("/forgotpassword", forgotPassword);
router.get("/verify/:token", verifyWorkspace);

export default router;
