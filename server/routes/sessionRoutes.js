import express from "express";
import { startSession, endSession, getAllSessions } from "../controllers/sessionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/start").post(protect, startSession);
router.route("/end").patch(protect, endSession);
router.route("/").get(protect, getAllSessions);

export default router;
