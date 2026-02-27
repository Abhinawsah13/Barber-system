// routes/booking.routes.js
import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {
    createBooking,
    getAvailableSlotsForBooking,
    getMyBookings,
    updateBookingStatus,
    cancelBooking,
    payBooking,
} from '../controllers/booking.controller.js';

const router = express.Router();

// Anyone can check available slots before booking
router.get('/available-slots', getAvailableSlotsForBooking);

// Create a new booking (customers only)
router.post('/', authenticateToken, requireRole('customer'), createBooking);

// Get all bookings for the logged-in user (works for both customers and barbers)
router.get('/my-bookings', authenticateToken, getMyBookings);

// General status update (used by barbers to confirm/complete bookings)
router.put('/:id/status', authenticateToken, updateBookingStatus);

// Customer cancels a specific booking
router.put('/:id/cancel', authenticateToken, requireRole('customer'), cancelBooking);

// Customer pays for a booking (simulated — no real gateway)
router.put('/:id/pay', authenticateToken, requireRole('customer'), payBooking);

export default router;
