// controllers/booking.controller.js
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import BarberProfile from '../models/BarberProfile.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import PlatformEarning from '../models/PlatformEarning.js';
import { getAvailableSlots, timeStringToMinutes } from '../services/availability.service.js';
import {
    sendBookingConfirmationNotifications,
    sendBookingCancellationNotifications,
    sendRefundNotification,
    sendNewBookingNotification
} from '../services/notification.service.js';

// ─── Conflict detection (used inside transaction) ─────────────────────────────
/**
 * Returns true if a time slot conflict exists for a barber.
 * Called within a MongoDB session for atomicity.
 */
const hasConflict = async (barberId, dateStr, timeSlot, durationMinutes, session, excludeBookingId = null) => {
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const newStart = timeStringToMinutes(timeSlot);
    const newEnd = newStart + durationMinutes;

    const existingBookings = await Booking.find({
        barber: barberId,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['cancelled_by_customer', 'cancelled_by_barber'] },
        ...(excludeBookingId && { _id: { $ne: excludeBookingId } }),
    })
        .populate('service', 'duration_minutes')
        .session(session)
        .lean();

    // Check each existing booking to see if it overlaps with the new one
    for (let i = 0; i < existingBookings.length; i++) {
        const existStart = timeStringToMinutes(existingBookings[i].time_slot);
        const existDuration = existingBookings[i].service
            ? existingBookings[i].service.duration_minutes
            : durationMinutes;
        const existEnd = existStart + existDuration;

        // Two bookings overlap if one starts before the other ends
        if (newStart < existEnd && newEnd > existStart) {
            return true;
        }
    }
    return false;
};

// ─── POST /bookings — Create booking with atomic conflict detection ───────────
export const createBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { barberId, serviceId, date, time_slot, serviceType = 'salon', customerAddress, customerLat, customerLng } = req.body;

        // ── Input validation ──────────────────────────────────────────────────
        if (!barberId || !serviceId || !date || !time_slot) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'barberId, serviceId, date, and time_slot are required' });
        }

        // Validate date is not in the past
        const bookingDate = new Date(date);
        if (isNaN(bookingDate.getTime()) || bookingDate < new Date(new Date().toDateString())) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Booking date must be today or in the future' });
        }

        const dateStr = bookingDate.toISOString().split('T')[0];

        // ── Fetch service ─────────────────────────────────────────────────────
        const service = await Service.findById(serviceId).session(session).lean();
        if (!service || !service.is_active) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Service not found or inactive' });
        }

        // ── Verify barber has a profile and is available this day ─────────────
        const barberProfile = await BarberProfile.findOne({ user: barberId }).session(session).lean();
        if (!barberProfile) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Barber not found' });
        }

        // ── Validate time_slot against barber's working hours (if configured) ──
        // Only block the booking if the barber has actually set up their schedule.
        // If no availability is set, allow any reasonable time slot to go through.
        const availableSlots = await getAvailableSlots(barberId, service.duration_minutes, dateStr, serviceType);

        if (availableSlots.length > 0) {
            // Barber has working hours configured — check the slot fits
            const isValidSlot = availableSlots.some(s => s.time === time_slot);
            if (!isValidSlot) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: `Time slot ${time_slot} is not available. Available: ${availableSlots.map(s => s.time).join(', ')}`,
                    availableSlots,
                });
            }
        }
        // If availableSlots is empty (barber hasn't set availability), skip slot check

        // ── Atomic conflict check ─────────────────────────────────────────────
        const conflict = await hasConflict(barberId, dateStr, time_slot, service.duration_minutes, session);
        if (conflict) {
            await session.abortTransaction();
            return res.status(409).json({ success: false, message: 'This time slot was just booked. Please choose another.' });
        }

        // ── Create booking atomically ─────────────────────────────────────────
        const [booking] = await Booking.create(
            [{
                customer: req.user._id,
                barber: barberId,
                service: serviceId,
                date: bookingDate,
                time_slot,
                service_type: serviceType,
                customer_address: customerAddress,
                customer_location: {
                    type: 'Point',
                    coordinates: [parseFloat(customerLng) || 85.3240, parseFloat(customerLat) || 27.7172],
                },
                total_price: service.price,
                payment_status: 'pending',
                status: 'pending',
            }],
            { session }
        );

        await session.commitTransaction();

        // Populate for response + socket event
        const populated = await Booking.findById(booking._id)
            .populate('customer', 'username phone')
            .populate('barber', 'username')
            .populate('service', 'name price duration_minutes');

        // ── DATABASE & REAL-TIME NOTIFICATION ───────────────────────────────
        await sendNewBookingNotification(populated, io);

        return res.status(201).json({ success: true, message: 'Booking created successfully', data: populated });

    } catch (error) {
        await session.abortTransaction();
        // Log the full error on the server for debugging
        console.error('[createBooking] ERROR:', error.message);
        console.error('[createBooking] STACK:', error.stack);
        // Send back the real error message so the frontend can display it
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error',
        });
    } finally {
        session.endSession();
    }
};

// ─── GET /bookings/available-slots?barberId=&serviceId=&date= ────────────────
export const getAvailableSlotsForBooking = async (req, res) => {
    try {
        const { barberId, serviceId, date, serviceType = 'salon' } = req.query;

        if (!barberId || !serviceId || !date) {
            return res.status(400).json({ success: false, message: 'barberId, serviceId, and date are required' });
        }

        const service = await Service.findById(serviceId).lean();
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

        const slots = await getAvailableSlots(barberId, service.duration_minutes, date, serviceType);

        return res.json({
            success: true,
            date,
            serviceDuration: service.duration_minutes,
            slots,
        });
    } catch (error) {
        console.error('[getAvailableSlots]', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

// ─── GET /bookings/my-bookings ────────────────────────────────────────────────
export const getMyBookings = async (req, res) => {
    try {
        const userId = req.user._id;
        const userType = req.user.user_type;

        const query = userType === 'customer'
            ? { customer: userId }
            : userType === 'barber'
                ? { barber: userId }
                : {}; // admin sees all

        const bookings = await Booking.find(query)
            .populate('customer', 'username email phone')
            .populate('barber', 'username email')
            .populate('service', 'name duration_minutes price')
            .sort({ date: -1 })
            .lean();

        return res.json({ success: true, count: bookings.length, data: bookings });
    } catch (error) {
        console.error('[getMyBookings]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── PUT /bookings/:id/status ─────────────────────────────────────────────────
export const updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.user._id;
        const userType = req.user.user_type;

        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled_by_customer', 'cancelled_by_barber'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        // Role-based permission
        if (userType === 'customer') {
            if (booking.customer.toString() !== userId.toString())
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            if (status !== 'cancelled_by_customer')
                return res.status(400).json({ success: false, message: 'Customers can only cancel bookings' });
        } else if (userType === 'barber') {
            if (booking.barber.toString() !== userId.toString())
                return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (booking.status === status) {
            return res.status(400).json({ success: false, message: `Booking is already ${status}` });
        }

        const oldStatus = booking.status;
        booking.status = status;

        // ── LOYALTY POINTS (On Completion) ───────────────────────────────────
        if (status === 'completed' && oldStatus !== 'completed') {
            await User.findByIdAndUpdate(booking.customer, {
                $inc: { loyalty_points: 10 }
            });
        }

        // ── REFUND PROCESSING (On Cancellation) ──────────────────────────────
        if ((status === 'cancelled_by_customer' || status === 'cancelled_by_barber') &&
            booking.payment_status === 'paid') {

            const customer = await User.findById(booking.customer);
            if (customer) {
                customer.wallet_balance += booking.total_price;
                await customer.save();

                // Record refund transaction
                await Transaction.create({
                    user: customer._id,
                    type: 'credit',
                    amount: booking.total_price,
                    title: 'Refund for Booking Cancellation',
                    description: `Refund for booking #${booking._id}`,
                    status: 'completed',
                    reference_id: booking._id.toString()
                });

                booking.payment_status = 'refunded';
            }
        }

        // ── PLATFORM COMMISSION & BARBER EARNINGS (On Completion) ────────────
        if (status === 'completed' && oldStatus !== 'completed' && booking.payment_status === 'paid') {
            const barberProfile = await BarberProfile.findOne({ user: booking.barber });
            if (barberProfile) {
                // Subscription logic
                const commissionRate = barberProfile.subscription_plan === 'premium' ? 0.05 : 0.10; // 5% vs 10%
                const commissionAmount = booking.total_price * commissionRate;
                const barberNetEarnings = booking.total_price - commissionAmount;

                // Update barber balance
                barberProfile.earnings.balance += barberNetEarnings;
                barberProfile.earnings.total_earned += barberNetEarnings;
                await barberProfile.save();

                // Store platform earnings
                await PlatformEarning.create({
                    booking: booking._id,
                    amount: commissionAmount,
                    commission_rate: commissionRate * 100,
                    barber: booking.barber
                });
            }
        }

        await booking.save();

        // ── NOTIFICATIONS & REAL-TIME ───────────────────────────────────────
        const io = req.app.get('io');
        const populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'username phone')
            .populate('barber', 'username')
            .populate('service', 'name price');

        if (populatedBooking) {
            // Confirmation
            if (status === 'confirmed' && oldStatus !== 'confirmed') {
                await sendBookingConfirmationNotifications(populatedBooking, io);
            }

            // Completed (trigger rate screen popup for customer)
            if (status === 'completed' && oldStatus !== 'completed') {
                io.to(`user-${booking.customer}`).emit('booking-completed', populatedBooking);
            }

            // Cancellation
            if ((status === 'cancelled_by_customer' || status === 'cancelled_by_barber') &&
                (oldStatus !== 'cancelled_by_customer' && oldStatus !== 'cancelled_by_barber')) {
                const cancelledBy = status === 'cancelled_by_customer' ? 'customer' : 'barber';
                await sendBookingCancellationNotifications(populatedBooking, cancelledBy, io);
            }

            // Refund
            if (booking.payment_status === 'refunded' && populatedBooking.payment_status === 'refunded') {
                await sendRefundNotification(populatedBooking, io);
            }
        }

        return res.json({ success: true, message: `Booking ${status}`, data: booking });
    } catch (error) {
        console.error('Error in updateBookingStatus:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};

// PUT /bookings/:id/cancel
// Customer cancels their own booking
// Only allowed if booking is still pending or confirmed (not completed or already cancelled)
export const cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const customerId = req.user._id;

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Make sure the booking belongs to the logged-in customer
        if (booking.customer.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: 'You can only cancel your own bookings' });
        }

        // Can only cancel if the booking hasn't already been completed or cancelled
        const cancellableStatuses = ['pending', 'confirmed'];
        if (!cancellableStatuses.includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: 'This booking cannot be cancelled anymore',
            });
        }

        booking.status = 'cancelled_by_customer';
        await booking.save();

        // ── NOTIFICATIONS ───────────────────────────────────────────────
        const populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'username phone')
            .populate('barber', 'username')
            .populate('service', 'name price');

        const io = req.app.get('io');
        if (populatedBooking) {
            await sendBookingCancellationNotifications(populatedBooking, 'customer', io);
        }

        return res.json({
            success: true,
            message: 'Booking cancelled successfully',
            data: booking,
        });

    } catch (error) {
        console.error('Error in cancelBooking:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};

// PUT /bookings/:id/pay
// Simulates payment — marks a booking's payment_status to "paid"
// No real payment gateway; this is just for FYP demonstration purposes
export const payBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const customerId = req.user._id;

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Only the customer who made the booking can pay for it
        if (booking.customer.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Don't allow paying again if it's already paid
        if (booking.payment_status === 'paid') {
            return res.status(400).json({ success: false, message: 'This booking is already paid' });
        }

        booking.payment_status = 'paid';
        await booking.save();

        return res.json({
            success: true,
            message: 'Payment successful!',
            data: booking,
        });

    } catch (error) {
        console.error('Error in payBooking:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};
