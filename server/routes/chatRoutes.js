import express from "express";
import { generateChatResponse } from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateChatQuestion } from "../middleware/validationMiddleware.js";

const router = express.Router();
router.post("/ask", protect, validateChatQuestion, generateChatResponse);
export default router;
