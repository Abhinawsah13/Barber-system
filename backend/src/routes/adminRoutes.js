import express from 'express';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';
import {
    getDashboardStats,
    getAllUsers,
    getAllBookings,
    getPlatformEarnings,
    manualRefund
} from '../controllers/admin.controller.js';

const router = express.Router();

// All admin routes are protected by authentication and admin role check
router.use(authenticateToken);
router.use(isAdmin);

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/bookings', getAllBookings);
router.get('/earnings', getPlatformEarnings);
router.post('/refund', manualRefund);

export default router;
