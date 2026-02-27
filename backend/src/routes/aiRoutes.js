import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getAiSuggestions } from '../controllers/ai.controller.js';

const router = express.Router();

router.post('/chat', authenticateToken, getAiSuggestions);

export default router;
