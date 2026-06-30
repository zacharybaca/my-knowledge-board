import express from "express";
import { getContentGaps } from "../controllers/analyticsController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/content-gaps", protect, getContentGaps);

export default router;
