// routes/payment.routes.js
import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {
    initiateKhalti,
    verifyKhalti,
    khaltiCallback,
    initiateEsewa,
    verifyEsewa,
    esewaCallback,
    esewaFailure,
} from '../controllers/payment.controller.js';

const router = express.Router();

// ─── Khalti ──────────────────────────────────────────────────────────────────
router.post('/khalti/initiate', authenticateToken, requireRole('customer'), initiateKhalti);
router.post('/khalti/verify', authenticateToken, verifyKhalti);
router.get('/khalti/callback', khaltiCallback); // No auth — Khalti redirects here

// ─── eSewa ───────────────────────────────────────────────────────────────────
router.post('/esewa/initiate', authenticateToken, requireRole('customer'), initiateEsewa);
router.post('/esewa/verify', authenticateToken, verifyEsewa);
router.get('/esewa/callback', esewaCallback);   // No auth — eSewa redirects here
router.get('/esewa/failure', esewaFailure);      // No auth — eSewa redirects here

export default router;
