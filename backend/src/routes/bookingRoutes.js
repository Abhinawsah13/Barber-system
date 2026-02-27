import express from 'express';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js'; // Added here
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a booking (Customer)
router.post('/', authenticateToken, requireRole('customer'), async (req, res) => {
    try {
        const {
            barberId,
            serviceId,
            date,
            time_slot,
            serviceType = 'salon',
            customerAddress,  // 🔥 NEW: Home service address
            customerLat,
            customerLng
        } = req.body;

        // Basic validation
        if (!barberId || !serviceId || !date || !time_slot) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Get service details for price
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        const booking = new Booking({
            customer: req.user._id,
            barber: barberId,
            service: serviceId,
            date,
            time_slot,
            service_type: serviceType,
            customer_address: customerAddress,
            notes: req.body.notes || '',
            customer_location: {
                type: 'Point',
                coordinates: [customerLng || 85.3240, customerLat || 27.7172]
            },
            total_price: service.price,
            status: 'pending'
        });

        await booking.save();

        // Populate for socket emission
        const populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'username phone')
            .populate('service', 'name price duration_minutes');

        // 🔥 Emit socket event to barber
        if (req.app.get('io')) {
            req.app.get('io').emit('new-booking', populatedBooking);
        }

        res.status(201).json({ success: true, data: populatedBooking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get my bookings (Customer or Barber)
router.get('/my-bookings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;
        const userType = req.user.user_type;

        let query = {};
        if (userType === 'customer') {
            query.customer = userId;
        } else if (userType === 'barber') {
            query.barber = userId;
        } else {
            // Admin sees all?
            query = {};
        }

        const bookings = await Booking.find(query)
            .populate('customer', 'username email phone')
            .populate('barber', 'username email')
            .populate('service', 'name duration_minutes price')
            .sort({ date: -1, time_slot: -1 });

        res.json({
            success: true,
            count: bookings.length,
            data: bookings
        });

    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update booking status (Barber or Admin)
// Also Customer can cancel
router.put('/:id/status', authenticateToken, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { status } = req.body;
        const userId = req.user._id;
        const userType = req.user.user_type;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Authorization logic
        if (userType === 'customer') {
            // Customer can only cancel their own booking if it's pending or confirmed
            if (booking.customer.toString() !== userId.toString()) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }
            if (status !== 'cancelled_by_customer') {
                return res.status(400).json({ success: false, message: 'Customers can only cancel bookings' });
            }
        } else if (userType === 'barber') {
            // Barber can only update their own bookings
            if (booking.barber.toString() !== userId.toString()) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }
            // Barber can confirm, complete, cancel, etc.
        }

        booking.status = status;
        await booking.save();

        res.json({
            success: true,
            message: `Booking ${status}`,
            data: booking
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

export default router;
