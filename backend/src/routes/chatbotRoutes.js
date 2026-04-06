// src/routes/chatbotRoutes.js
import express from 'express';
import { chat, health } from '../controllers/chatbotController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/chatbot/chat  — send message to chatbot
router.post('/chat', authenticateToken, chat);

// GET /api/chatbot/health — check if ML model is running
router.get('/health', health);

export default router;