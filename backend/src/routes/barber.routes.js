// routes/barber.routes.js
import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {
    createOrUpdateProfile,
    getBarbers,
    getBarberById,
    getServiceCategories,
} from '../controllers/barber.controller.js';

const router = express.Router();

// Public
router.get('/', getBarbers);                      // ?services=Haircut,Shave&isOnline=true
router.get('/services-list', getServiceCategories); // Returns valid category list
router.get('/:id', getBarberById);

// Barber-only
router.post('/profile', authenticateToken, requireRole('barber'), createOrUpdateProfile);
router.put('/profile', authenticateToken, requireRole('barber'), createOrUpdateProfile);

export default router;
