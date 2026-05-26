import express from 'express';
import { generateChatResponse } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.post('/ask', protect, generateChatResponse);
export default router;
