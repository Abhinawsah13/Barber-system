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
    markBarberOnTheWay,
} from '../controllers/booking.controller.js';

const router = express.Router();

// Anyone can check available slots before booking
router.get('/available-slots', getAvailableSlotsForBooking);

// Create a new booking (customers only)
router.post('/', authenticateToken, requireRole('customer'), createBooking);

// Get all bookings for the logged-in user (works for both customers and barbers)
router.get('/my-bookings', authenticateToken, getMyBookings);

// General status update (used by barbers to confirm/complete/cancel bookings)
router.put('/:id/status', authenticateToken, updateBookingStatus);

// Customer cancels a specific booking (optional body: { cancellationReason })
router.put('/:id/cancel', authenticateToken, requireRole('customer'), cancelBooking);

// Customer pays for a booking (simulated — no real gateway)
router.put('/:id/pay', authenticateToken, requireRole('customer'), payBooking);

// Barber marks themselves as "on the way" (home service only)
// After this, if customer cancels → only 30% refund on service charge
router.put('/:id/on-the-way', authenticateToken, requireRole('barber'), markBarberOnTheWay);

export default router;
