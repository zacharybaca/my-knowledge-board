import express from "express";
import {
  loginUser,
  registerUser,
  forgotPassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgotpassword", forgotPassword);

export default router;
