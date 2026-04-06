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
    sendNewBookingNotification,
    sendBookingCompletedNotification,
    createNotification,
} from '../services/notification.service.js';
import SystemSettings from '../models/SystemSettings.js';


// ─── Conflict detection ───────────────────────────────────────────────────────
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

    for (let i = 0; i < existingBookings.length; i++) {
        const existStart = timeStringToMinutes(existingBookings[i].time_slot);
        const existDuration = existingBookings[i].service
            ? existingBookings[i].service.duration_minutes
            : durationMinutes;
        const existEnd = existStart + existDuration;

        if (newStart < existEnd && newEnd > existStart) {
            return true;
        }
    }
    return false;
};

// ✅ FIX 1 + 2: Helper — validate booking time is in the future
const isBookingTimeInFuture = (dateStr, timeSlot) => {
    const now = new Date();
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const bookingDateTime = new Date(dateStr);
    bookingDateTime.setHours(hours, minutes, 0, 0);
    return bookingDateTime > now;
};

// ✅ FIX 2: Calculate travel charge — Rs 100 per 5km
const calculateTravelCharge = (distanceKm) => {
    if (!distanceKm || distanceKm <= 0) return 0;
    return Math.ceil(distanceKm / 5) * 100;
};

// ✅ FIX 2: Haversine distance formula
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// ─── POST /bookings ───────────────────────────────────────────────────────────
export const createBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    try {
        const {
            barberId, date, time_slot,
            serviceType = 'salon', customerAddress,
            customerLat, customerLng,
            // ✅ MULTI-SERVICE: accept either serviceIds[] OR legacy serviceId/serviceId
            serviceIds,
            serviceId, // legacy single-service fallback
        } = req.body;

        // ── Normalise to array ────────────────────────────────────────────────
        const resolvedServiceIds = Array.isArray(serviceIds) && serviceIds.length > 0
            ? serviceIds
            : serviceId
                ? [serviceId]
                : [];

        // Input validation
        if (!barberId || resolvedServiceIds.length === 0 || !date || !time_slot) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'barberId, at least one serviceId, date, and time_slot are required'
            });
        }

        // Validate date is not in the past
        const bookingDate = new Date(date);
        if (isNaN(bookingDate.getTime()) || bookingDate < new Date(new Date().toDateString())) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Booking date must be today or in the future' });
        }

        const dateStr = bookingDate.toISOString().split('T')[0];

        // ✅ FIX 1: Validate time is in the future (not past time today)
        if (!isBookingTimeInFuture(dateStr, time_slot)) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Time slot ${time_slot} has already passed. Please select a future time.`
            });
        }

        // ── Fetch all selected services ───────────────────────────────────────
        const fetchedServices = await Service.find({
            _id: { $in: resolvedServiceIds },
            is_active: true,
        }).session(session).lean();

        if (fetchedServices.length !== resolvedServiceIds.length) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'One or more selected services were not found or are inactive'
            });
        }

        // ── Compute totals ────────────────────────────────────────────────────
        // Use the LONGEST service duration for slot-conflict checking (most conservative)
        const totalDuration = fetchedServices.reduce((sum, s) => sum + (s.duration_minutes || 30), 0);
        const longestService = fetchedServices.reduce(
            (max, s) => (s.duration_minutes > max.duration_minutes ? s : max),
            fetchedServices[0]
        );
        const servicesBasePrice = fetchedServices.reduce((sum, s) => sum + (s.price || 0), 0);
        const serviceNames = fetchedServices.map(s => s.name);

        // Verify barber profile
        const barberProfile = await BarberProfile.findOne({ user: barberId }).session(session).lean();
        if (!barberProfile) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Barber not found' });
        }

        // Validate slot — use longest service duration so it blocks enough time
        const availableSlots = await getAvailableSlots(barberId, longestService.duration_minutes, dateStr, serviceType);
        const isValidSlot = availableSlots.some(s => s.time === time_slot);
        if (!isValidSlot) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Time slot ${time_slot} is not available.`,
                availableSlots,
            });
        }

        // ✅ Explicit duplicate slot check (barber + date + time_slot)
        const duplicateSlot = await Booking.findOne({
            barber: barberId,
            date: bookingDate,
            time_slot,
            status: { $in: ['pending', 'confirmed', 'completed'] },
        }).session(session).lean();

        if (duplicateSlot) {
            await session.abortTransaction();
            return res.status(409).json({
                success: false,
                message: 'This time slot is already booked. Please select another time.'
            });
        }

        // Conflict check (overlapping duration)
        const conflict = await hasConflict(barberId, dateStr, time_slot, longestService.duration_minutes, session);
        if (conflict) {
            await session.abortTransaction();
            return res.status(409).json({ success: false, message: 'This time slot was just booked. Please choose another.' });
        }

        // ✅ FIX 2: Calculate travel charge for home service
        let travelCharge = 0;
        let distanceKm = 0;

        if (serviceType === 'home' && customerLat && customerLng) {
            const barberCoords = barberProfile?.location?.coordinates;
            if (barberCoords && barberCoords.length === 2) {
                const barberLng = barberCoords[0];
                const barberLat = barberCoords[1];
                distanceKm = calculateDistance(
                    parseFloat(customerLat), parseFloat(customerLng),
                    barberLat, barberLng
                );
                travelCharge = calculateTravelCharge(distanceKm);
            }
        }

        // ✅ Total = sum of all service prices + travel charge
        const totalPrice = servicesBasePrice + travelCharge;

        // Create booking — store both legacy `service` (first) and full `services` array
        const [booking] = await Booking.create(
            [{
                customer: req.user._id,
                barber: barberId,
                service: resolvedServiceIds[0],   // legacy compat: primary service
                services: resolvedServiceIds,      // all selected services
                service_names: serviceNames,       // human-readable snapshot
                total_duration: totalDuration,
                date: bookingDate,
                time_slot,
                service_type: serviceType,
                customer_address: customerAddress,
                customer_location: {
                    type: 'Point',
                    coordinates: [parseFloat(customerLng) || 85.3240, parseFloat(customerLat) || 27.7172],
                },
                barber_location: {
                    type: 'Point',
                    coordinates: barberProfile?.location?.coordinates || [85.3240, 27.7172],
                },
                travel_charge: travelCharge,
                distance_km: distanceKm,
                total_price: totalPrice,
                payment_status: 'pending',
                status: 'pending',
            }],
            { session }
        );

        await session.commitTransaction();
        committed = true;

    } catch (error) {
        if (!committed) {
            await session.abortTransaction();
        }
        console.error('[createBooking] ERROR:', error.message);

        // Check for MongoDB unique constraint error (code 11000)
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'This time slot was just booked by someone else. Please choose another.'
            });
        }

        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    } finally {
        session.endSession();
    }

    // Post-commit: populate and notify
    try {
        const populated = await Booking.findOne({
            barber: req.body.barberId,
            customer: req.user._id,
            date: new Date(req.body.date),
            time_slot: req.body.time_slot,
        })
            .populate('customer', 'username phone email')
            .populate('barber', 'username profile_image address email')
            .populate('service', 'name price duration_minutes')
            .populate('services', 'name price duration_minutes')
            .sort({ createdAt: -1 });

        const io = req.app.get('io');
        if (populated && io) {
            await sendNewBookingNotification(populated, io);
        }

        return res.status(201).json({ success: true, message: 'Booking created successfully', data: populated });
    } catch (postError) {
        console.error('[createBooking] Post-commit error:', postError.message);
        return res.status(201).json({ success: true, message: 'Booking created successfully' });
    }
};

// ─── GET /bookings/available-slots ───────────────────────────────────────────
export const getAvailableSlotsForBooking = async (req, res) => {
    try {
        const { barberId, serviceId, date, serviceType = 'salon' } = req.query;

        if (!barberId || !serviceId || !date) {
            return res.status(400).json({ success: false, message: 'barberId, serviceId, and date are required' });
        }

        const service = await Service.findById(serviceId).lean();
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

        let slots = await getAvailableSlots(barberId, service.duration_minutes, date, serviceType);

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
                : {};

        const bookings = await Booking.find(query)
            .populate('customer', 'username email phone')
            .populate('barber', 'username email profile_image address')
            .populate('service', 'name duration_minutes price')
            .populate('services', 'name duration_minutes price')
            .sort({ date: -1 })
            .lean();

        // ✅ Attach barber's location from BarberProfile
        const enriched = await Promise.all(
            bookings.map(async (booking) => {
                if (booking.barber?._id) {
                    const barberProfile = await BarberProfile.findOne(
                        { user: booking.barber._id },
                        'location'
                    ).lean();
                    return {
                        ...booking,
                        barber: {
                            ...booking.barber,
                            location: barberProfile?.location || null,
                        },
                    };
                }
                return booking;
            })
        );

        return res.json({ success: true, count: enriched.length, data: enriched });
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

        // Loyalty points on completion — Awarded to BOTH Barber & Customer
        if (status === 'completed' && oldStatus !== 'completed') {
            // Customer gets points
            await User.findByIdAndUpdate(booking.customer, {
                $inc: { loyalty_points: 10 }
            });
            // Barber gets points
            await User.findByIdAndUpdate(booking.barber, {
                $inc: { loyalty_points: 10 }
            });
        }

        // ✅ REFUND SYSTEM: 4-Tier time-based refund on cancellation
        if ((status === 'cancelled_by_customer' || status === 'cancelled_by_barber') &&
            booking.payment_status === 'paid') {

            const now = new Date();
            const bookingDate = new Date(booking.date);
            const [bHours, bMinutes] = booking.time_slot.split(':').map(Number);
            const serviceStartTime = new Date(bookingDate);
            serviceStartTime.setHours(bHours, bMinutes, 0, 0);
            const hoursUntilService = (serviceStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

            const travelCharge = booking.travel_charge || 0;
            const serviceCharge = booking.total_price - travelCharge;

            let refundPercentage = 0;
            let refundAmount = 0;

            const settings = await SystemSettings.findOne().lean() || {
                refund_2h_more: 100,
                refund_1h_to_2h: 70,
                refund_less_than_1h: 50,
                refund_barber_on_way: 30
            };

            if (status === 'cancelled_by_barber') {
                // Barber cancelled → always FULL refund (not customer's fault)
                refundPercentage = 100;
                refundAmount = booking.total_price;
            } else {
                // Customer cancelled via status update → 4-tier logic
                if (booking.barber_on_the_way) {
                    refundPercentage = settings.refund_barber_on_way || 30;
                    refundAmount = Math.round(serviceCharge * (refundPercentage / 100));
                } else if (hoursUntilService >= 2) {
                    refundPercentage = settings.refund_2h_more || 100;
                    refundAmount = Math.round(booking.total_price * (refundPercentage / 100));
                } else if (hoursUntilService >= 1) {
                    refundPercentage = settings.refund_1h_to_2h || 70;
                    refundAmount = Math.round(serviceCharge * (refundPercentage / 100)) + travelCharge;
                } else if (hoursUntilService > 0) {
                    refundPercentage = settings.refund_less_than_1h || 50;
                    refundAmount = Math.round(serviceCharge * (refundPercentage / 100));
                } else {
                    refundPercentage = 0;
                    refundAmount = 0;
                }
            }

            refundAmount = Math.max(0, refundAmount);

            if (refundAmount > 0) {
                await User.findByIdAndUpdate(booking.customer, { $inc: { wallet_balance: refundAmount } });

                await Transaction.create({
                    user: booking.customer,
                    type: 'credit',
                    amount: refundAmount,
                    title: status === 'cancelled_by_barber'
                        ? 'Full Refund — Barber Cancelled'
                        : refundPercentage === 100
                            ? 'Full Refund — Cancelled 2h+ Early'
                            : refundPercentage === 70
                                ? '70% Refund — Cancelled 1–2h Early'
                                : refundPercentage === 30
                                    ? '30% Refund — Barber Was On The Way'
                                    : '50% Refund — Late Cancellation (<1h)',
                    description: `${refundPercentage}% refund for booking #${booking._id.toString().substring(0, 8)}`,
                    status: 'completed',
                    reference_id: booking._id.toString()
                });

                booking.payment_status = 'refunded';
            }

            booking.cancelled_at = now;
            booking.refund_amount = refundAmount;
            booking.refund_percentage = refundPercentage;
        }


        // Platform commission on completion
        if (status === 'completed' && oldStatus !== 'completed') {
            // Automatically mark as paid if completed (assumes cash/completed service)
            if (booking.payment_status !== 'paid' && booking.payment_status !== 'refunded') {
                booking.payment_status = 'paid';
            }

            const barberProfile = await BarberProfile.findOne({ user: booking.barber });
            if (barberProfile) {
                const settings = await mongoose.model('SystemSettings').findOne() || { basic_commission: 10, premium_commission: 5 };
                const bas_rate = (settings.basic_commission || 10) / 100;
                const prem_rate = (settings.premium_commission !== undefined ? settings.premium_commission : 5) / 100;
                
                const commissionRate = barberProfile.subscription_plan === 'premium' ? prem_rate : bas_rate;
                const commissionAmount = (booking.total_price || 0) * commissionRate;
                const barberNetEarnings = (booking.total_price || 0) - commissionAmount;

                barberProfile.earnings.balance += barberNetEarnings;
                barberProfile.earnings.total_earned += barberNetEarnings;
                await barberProfile.save();

                // ✅ Add earnings directly to the global user wallet balance
                const barberUser = await User.findById(booking.barber);
                if (barberUser) {
                    barberUser.wallet_balance = (barberUser.wallet_balance || 0) + barberNetEarnings;
                    await barberUser.save();

                    // ✅ Create a wallet transaction for the Barber
                    await Transaction.create({
                        user: booking.barber,
                        type: 'credit',
                        amount: barberNetEarnings,
                        title: 'Booking Earnings',
                        description: `Earnings for booking #${booking._id.toString().substring(0, 8)}`,
                        status: 'completed',
                        reference_id: booking._id.toString()
                    });
                }

                // Check if commission already exists for this booking to prevent duplicates
                const existingEarning = await PlatformEarning.findOne({ booking: booking._id });
                if (!existingEarning) {
                    await PlatformEarning.create({
                        booking: booking._id,
                        amount: commissionAmount,
                        commission_rate: commissionRate * 100,
                        barber: booking.barber
                    });
                }
            }
        }

        await booking.save();

        const io = req.app.get('io');
        const populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'username phone email')
            .populate('barber', 'username profile_image address email')
            .populate('service', 'name price');

        if (populatedBooking) {
            if (status === 'confirmed' && oldStatus !== 'confirmed') {
                await sendBookingConfirmationNotifications(populatedBooking, io);
            }

            // ✅ FIX 4: Emit completed event — triggers Rate Your Barber on customer side
            if (status === 'completed' && oldStatus !== 'completed') {
                await sendBookingCompletedNotification(populatedBooking, io);
                io.to(`user-${booking.customer._id || booking.customer}`).emit('booking-completed', populatedBooking);
            }

            if ((status === 'cancelled_by_customer' || status === 'cancelled_by_barber') &&
                (oldStatus !== 'cancelled_by_customer' && oldStatus !== 'cancelled_by_barber')) {
                const cancelledBy = status === 'cancelled_by_customer' ? 'customer' : 'barber';
                await sendBookingCancellationNotifications(populatedBooking, cancelledBy, io);
            }

            if (booking.payment_status === 'refunded') {
                await sendRefundNotification(populatedBooking, io);
            }
        }

        return res.json({ success: true, message: `Booking ${status}`, data: booking });
    } catch (error) {
        console.error('Error in updateBookingStatus:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};

// ─── PUT /bookings/:id/cancel ─────────────────────────────────────────────────
// ✅ FULL REFUND SYSTEM: 4-Tier smart refund + travel charge logic + race-condition safe
export const cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const customerId = req.user._id;

        const booking = await Booking.findById(bookingId)
            .populate('service', 'name price duration_minutes');
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        // Security: Only the customer who booked can cancel
        if (booking.customer.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: 'You can only cancel your own bookings' });
        }

        // Atomic lock: prevent double-cancellation or race conditions
        const locked = await Booking.findOneAndUpdate(
            { _id: bookingId, status: { $in: ['pending', 'confirmed'] } },
            { $set: { status: 'cancelled_by_customer' } },
            { new: false }
        );
        if (!locked) {
            return res.status(400).json({ success: false, message: 'This booking cannot be cancelled anymore' });
        }

        // ─── Refund Calculation ────────────────────────────────────────────
        const now = new Date();
        const bookingDate = new Date(booking.date);
        const [bHrs, bMins] = booking.time_slot.split(':').map(Number);
        const serviceStartTime = new Date(bookingDate);
        serviceStartTime.setHours(bHrs, bMins, 0, 0);

        const hoursUntilService = (serviceStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        const travelCharge = booking.travel_charge || 0;
        const serviceCharge = booking.total_price - travelCharge;

        let refundPercentage = 0;
        let serviceRefund = 0;
        let travelRefund = 0;
        let refundMessage = '';

        if (booking.payment_status === 'paid') {
            const settings = await SystemSettings.findOne().lean() || {
                refund_2h_more: 100,
                refund_1h_to_2h: 70,
                refund_less_than_1h: 50,
                refund_barber_on_way: 30
            };

            if (booking.barber_on_the_way === true) {
                // Barber on the way → % of service charge; travel NOT refunded
                refundPercentage = settings.refund_barber_on_way || 30;
                serviceRefund = Math.round(serviceCharge * (refundPercentage / 100));
                travelRefund = 0;
                refundMessage = `${refundPercentage}% refund (Rs ${serviceRefund}) — barber is already on the way. Travel charge (Rs ${travelCharge}) is non-refundable.`;
            } else if (hoursUntilService >= 2) {
                // Cancelled ≥ 2 hours early → % of full refund (service + travel)
                refundPercentage = settings.refund_2h_more || 100;
                const totalRefund = Math.round((serviceCharge + travelCharge) * (refundPercentage / 100));
                serviceRefund = serviceCharge * (refundPercentage / 100);
                travelRefund = travelCharge * (refundPercentage / 100);
                refundMessage = `${refundPercentage}% refund (Rs ${totalRefund}) — cancelled 2+ hours before service.`;
            } else if (hoursUntilService >= 1) {
                // Cancelled 1–2 hours early → % of service charge; travel refunded
                refundPercentage = settings.refund_1h_to_2h || 70;
                serviceRefund = Math.round(serviceCharge * (refundPercentage / 100));
                travelRefund = travelCharge;
                refundMessage = `${refundPercentage}% refund (Rs ${serviceRefund + travelRefund}) — cancelled 1–2 hours before service.`;
            } else if (hoursUntilService > 0) {
                // Cancelled < 1 hour → % of service charge; travel NOT refunded
                refundPercentage = settings.refund_less_than_1h || 50;
                serviceRefund = Math.round(serviceCharge * (refundPercentage / 100));
                travelRefund = 0;
                refundMessage = `${refundPercentage}% refund (Rs ${serviceRefund}) — cancelled less than 1 hour before service.`;
            } else {
                // Service already started → NO refund
                refundPercentage = 0;
                serviceRefund = 0;
                travelRefund = 0;
                refundMessage = 'No refund — service time has already started.';
            }
        } else {
            refundMessage = 'No payment was made — no refund needed.';
        }

        // Clamp: never negative
        const refundAmount = Math.max(0, serviceRefund + travelRefund);

        // ─── Credit Wallet (atomic increment) ─────────────────────────────
        let newWalletBalance;
        if (refundAmount > 0) {
            const updatedUser = await User.findByIdAndUpdate(
                booking.customer,
                { $inc: { wallet_balance: refundAmount } },
                { new: true }
            );
            newWalletBalance = updatedUser?.wallet_balance;

            let txTitle = '';
            if (booking.barber_on_the_way) txTitle = '30% Refund — Barber Was On The Way';
            else if (refundPercentage === 100) txTitle = 'Full Refund — Cancelled 2h+ Early';
            else if (refundPercentage === 70) txTitle = '70% Refund — Cancelled 1–2h Early';
            else txTitle = '50% Refund — Late Cancellation (<1h)';

            await Transaction.create({
                user: booking.customer,
                type: 'credit',
                amount: refundAmount,
                title: txTitle,
                description: `${refundPercentage}% refund for booking #${booking._id.toString().substring(0, 8)} (${booking.service?.name || 'Service'})`,
                status: 'completed',
                reference_id: booking._id.toString()
            });
        }

        // ─── Persist final booking state ──────────────────────────────────
        await Booking.findByIdAndUpdate(bookingId, {
            cancelled_at: now,
            refund_amount: refundAmount,
            refund_percentage: refundPercentage,
            cancellation_reason: req.body?.cancellationReason || '',
            ...(refundAmount > 0 && { payment_status: 'refunded' }),
        });

        // ─── Notifications + Real-time Socket ────────────────────────────
        const populatedBooking = await Booking.findById(bookingId)
            .populate('customer', 'username phone email')
            .populate('barber', 'username profile_image address email')
            .populate('service', 'name price')
            .populate('services', 'name price');

        const io = req.app.get('io');
        if (populatedBooking) {
            populatedBooking.refund_amount = refundAmount;
            populatedBooking.refund_percentage = refundPercentage;

            await sendBookingCancellationNotifications(populatedBooking, 'customer', io);
            if (refundAmount > 0) await sendRefundNotification(populatedBooking, io);

            // Real-time: push cancellation event to barber's room
            if (io) {
                const barberId = (populatedBooking.barber?._id || booking.barber).toString();
                io.to(`user-${barberId}`).emit('booking-cancelled-by-customer', {
                    bookingId: booking._id,
                    customerName: populatedBooking.customer?.username || 'Customer',
                    serviceName: populatedBooking.service?.name || 'Service',
                    timeSlot: booking.time_slot,
                });
                // Also send to barber-specific room
                io.to(`barber-${barberId}`).emit('booking-cancelled-by-customer', {
                    bookingId: booking._id,
                    customerName: populatedBooking.customer?.username || 'Customer',
                    serviceName: populatedBooking.service?.name || 'Service',
                    timeSlot: booking.time_slot,
                });
            }
        }

        return res.json({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
                bookingId: booking._id,
                status: 'cancelled_by_customer',
                refund_amount: refundAmount,
                refund_percentage: refundPercentage,
                refund_message: refundMessage,
                service_refund: serviceRefund,
                travel_refund: travelRefund,
                new_wallet_balance: newWalletBalance,
            }
        });
    } catch (error) {
        console.error('Error in cancelBooking:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};

// ─── PUT /bookings/:id/on-the-way ─────────────────────────────────────────────
// ✅ Barber marks themselves as on the way (home service only)
// This triggers the 30%-refund tier if the customer cancels after this point
export const markBarberOnTheWay = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const barberId = req.user._id;

        const booking = await Booking.findById(bookingId).populate('service', 'name');
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        if (booking.barber.toString() !== barberId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (booking.service_type !== 'home') {
            return res.status(400).json({ success: false, message: 'Only home service bookings support on-the-way status' });
        }

        if (booking.status !== 'confirmed') {
            return res.status(400).json({ success: false, message: 'Booking must be confirmed before marking on-the-way' });
        }

        await Booking.findByIdAndUpdate(bookingId, {
            barber_on_the_way: true,
            barber_started_journey_at: new Date(),
        });

        // ─── Notify Customer ─────────────────────────────────────────────
        const io = req.app.get('io');

        await createNotification({
            recipientId: booking.customer,
            barberId: barberId,
            customerId: booking.customer,
            message: `Your barber is on the way for ${booking.service?.name || 'your service'}. Please be ready!`,
            type: 'booking_status',
            metadata: { bookingId: booking._id.toString(), action: 'barber_on_the_way' },
            io,
        });

        // Real-time event to customer
        if (io) {
            io.to(`user-${booking.customer.toString()}`).emit('barber-on-the-way', {
                bookingId: booking._id,
                message: 'Your barber is on the way!',
            });
        }


        return res.json({ success: true, message: 'Marked as on the way. Customer has been notified.' });
    } catch (error) {
        console.error('Error in markBarberOnTheWay:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};



// ─── PUT /bookings/:id/pay ────────────────────────────────────────────────────
export const payBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const customerId = req.user._id;

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        if (booking.customer.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (booking.payment_status === 'paid') {
            return res.status(400).json({ success: false, message: 'This booking is already paid' });
        }

        booking.payment_status = 'paid';
        await booking.save();

        return res.json({ success: true, message: 'Payment successful!', data: booking });
    } catch (error) {
        console.error('Error in payBooking:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};

// ─── PUT /bookings/:id (Update Details) ──────────────────────────────────────
export const updateBooking = async (req, res) => {
    try {
        const { date, time_slot } = req.body;
        const bookingId = req.params.id;
        const userId = req.user._id;

        const booking = await Booking.findById(bookingId).populate('service');
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

        if (booking.customer.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (booking.status !== 'pending' && booking.status !== 'confirmed') {
            return res.status(400).json({ success: false, message: 'Cannot update details for this booking status' });
        }

        // Validate new slot
        if (date && time_slot) {
            const dateStr = new Date(date).toISOString().split('T')[0];
            const conflict = await hasConflict(booking.barber, dateStr, time_slot, booking.service.duration_minutes, null, bookingId);
            if (conflict) {
                return res.status(409).json({ success: false, message: 'The new time slot is already booked' });
            }
            booking.date = new Date(date);
            booking.time_slot = time_slot;
        }

        await booking.save();

        const io = req.app.get('io');
        const populated = await Booking.findById(bookingId)
            .populate('customer', 'username phone email')
            .populate('barber', 'username')
            .populate('service', 'name');

        if (populated && io) {
            // Trigger "updated" notification
            await createNotification({
                barberId: populated.barber._id,
                customerId: populated.customer._id,
                message: `Updated: ${populated.customer.username} updated the booking for ${populated.service.name} to ${new Date(populated.date).toLocaleDateString()} at ${populated.time_slot}.`,
                type: 'updated',
                metadata: {
                    bookingId: populated._id.toString(),
                    action: 'updated_by_customer'
                },
                io
            });
        }

        return res.json({ success: true, message: 'Booking updated successfully', data: populated });
    } catch (error) {
        console.error('[updateBooking] ERROR:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

