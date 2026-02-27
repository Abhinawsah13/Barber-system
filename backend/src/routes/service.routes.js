// routes/service.routes.js
import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {
    createService,
    getServices,
    getServiceById,
    updateService,
    deleteService,
} from '../controllers/service.controller.js';

const router = express.Router();

// Public
router.get('/', getServices);
router.get('/:id', getServiceById);

// Barber or Admin protected
router.post('/', authenticateToken, requireRole('barber', 'admin'), createService);
router.put('/:id', authenticateToken, requireRole('barber', 'admin'), updateService);
router.delete('/:id', authenticateToken, requireRole('barber', 'admin'), deleteService);

export default router;
