import express from "express";
import { generateArticleMetadata } from "../controllers/aiController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/analyze", protect, generateArticleMetadata);
export default router;
