import express from "express";
import {
  generateArticleMetadata,
  enhanceArticleText,
} from "../controllers/aiController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/analyze", protect, generateArticleMetadata);
router.post("/enhance-text", protect, enhanceArticleText);
export default router;
