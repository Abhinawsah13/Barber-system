// routes/payment.routes.js
import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {
    initiateKhalti,
    verifyKhalti,
    khaltiCallback,
    khaltiWidget,
    initiateKhaltiTopUp,
    verifyKhaltiTopUp,
    requestWithdrawal,
} from '../controllers/payment.controller.js';

const router = express.Router();

// ─── Khalti ──────────────────────────────────────────────────────────────────
router.post('/khalti/initiate', authenticateToken, requireRole('customer'), initiateKhalti);
router.post('/khalti/verify', authenticateToken, verifyKhalti);
router.get('/khalti/callback', khaltiCallback); // Khalti redirects here after payment

// Wallet
router.post('/khalti/topup/initiate', authenticateToken, initiateKhaltiTopUp);
router.post('/khalti/topup/verify', authenticateToken, verifyKhaltiTopUp);
router.post('/withdraw', authenticateToken, requestWithdrawal);

export default router;
