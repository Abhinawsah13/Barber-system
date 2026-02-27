import Notification from '../models/Notification.js';

/**
 * Helper to emit real-time notifications via Socket.io
 */
const emitRealTime = (io, userId, event, data) => {
    if (io) {
        // Emit to the specific user's room
        io.to(`user-${userId.toString()}`).emit(event, data);
        // Also emit to barber room if applicable (redundant if userId is already in the right room, 
        // but barber rooms exist for dashboard specific pushes)
        io.to(`barber-${userId.toString()}`).emit(event, data);
    }
};

/**
 * Creates a notification for a user
 */
export const createNotification = async ({ user, title, message, type, metadata, io }) => {
    try {
        const notification = new Notification({
            user,
            title,
            message,
            type,
            metadata
        });
        await notification.save();

        // Emit real-time event
        emitRealTime(io, user, 'notification_received', notification);

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

/**
 * Specifically handles booking confirmation notifications
 * Ensures they are only created once per booking
 */
export const sendNewBookingNotification = async (booking, io) => {
    try {
        const dateStr = new Date(booking.date).toLocaleDateString();

        // Notify Barber
        await createNotification({
            user: booking.barber._id || booking.barber,
            title: 'New Booking Request! 📅',
            message: `You have a new booking from ${booking.customer.username}.\n\n✂️ Service: ${booking.service.name}\n📅 Date: ${dateStr}\n⏰ Time: ${booking.time_slot}`,
            type: 'booking_status',
            metadata: {
                bookingId: booking._id.toString(),
                action: 'new_booking'
            },
            io
        });
    } catch (error) {
        console.error('Error sending new booking notification:', error);
    }
};

export const sendBookingConfirmationNotifications = async (booking, io) => {
    try {
        // Check if confirmation notification already exists for this booking
        const existing = await Notification.findOne({
            'metadata.bookingId': booking._id.toString(),
            'metadata.action': 'confirmation'
        });

        if (existing) {
            console.log(`Notification already exists for booking ${booking._id}`);
            return;
        }

        const dateStr = new Date(booking.date).toLocaleDateString();
        const addressInfo = booking.service_type === 'home' ? `\n📍 Address: ${booking.customer_address}` : '';
        const modeEmoji = booking.service_type === 'home' ? '🏠' : '💈';
        const modeText = booking.service_type === 'home' ? 'HOME VISIT' : 'AT SALON';

        // 1. Notify Customer
        await createNotification({
            user: booking.customer._id || booking.customer,
            title: 'Booking Confirmed! ✅',
            message: `Your appointment for ${booking.service.name} is confirmed.\n\n📅 Date: ${dateStr}\n⏰ Time: ${booking.time_slot}\n${modeEmoji} Type: ${modeText}\n💰 Price: Rs. ${booking.total_price}${addressInfo}`,
            type: 'booking_status',
            metadata: {
                bookingId: booking._id.toString(),
                action: 'confirmation'
            },
            io
        });

        // 2. Notify Barber
        await createNotification({
            user: booking.barber._id || booking.barber,
            title: 'New Confirmed Booking! ✂️',
            message: `You have a confirmed booking with ${booking.customer.username || 'a customer'}.\n\n📅 Date: ${dateStr}\n⏰ Time: ${booking.time_slot}\n${modeEmoji} Type: ${modeText}\n💰 Price: Rs. ${booking.total_price}${addressInfo}`,
            type: 'booking_status',
            metadata: {
                bookingId: booking._id.toString(),
                action: 'confirmation'
            },
            io
        });

    } catch (error) {
        console.error('Error sending booking confirmation notifications:', error);
    }
};

/**
 * Handles booking cancellation notifications
 */
export const sendBookingCancellationNotifications = async (booking, cancelledBy, io) => {
    try {
        const dateStr = new Date(booking.date).toLocaleDateString();
        const roleText = cancelledBy === 'barber' ? 'the barber' : 'the customer';

        // 1. Notify Customer
        await createNotification({
            user: booking.customer._id || booking.customer,
            title: 'Booking Cancelled ❌',
            message: `The booking for ${booking.service.name} on ${dateStr} at ${booking.time_slot} has been cancelled by ${roleText}.`,
            type: 'booking_status',
            metadata: {
                bookingId: booking._id.toString(),
                action: 'cancellation'
            },
            io
        });

        // 2. Notify Barber
        await createNotification({
            user: booking.barber._id || booking.barber,
            title: 'Booking Cancelled ❌',
            message: `The booking for ${booking.service.name} on ${dateStr} at ${booking.time_slot} has been cancelled by ${roleText}.`,
            type: 'booking_status',
            metadata: {
                bookingId: booking._id.toString(),
                action: 'cancellation'
            },
            io
        });
    } catch (error) {
        console.error('Error sending cancellation notifications:', error);
    }
};

/**
 * Handles refund notifications
 */
export const sendRefundNotification = async (booking, io) => {
    try {
        await createNotification({
            user: booking.customer._id || booking.customer,
            title: 'Refund Processed 💰',
            message: `A refund of Rs. ${booking.total_price} has been credited to your wallet for booking #${booking._id.toString().substring(0, 8)}.`,
            type: 'wallet_status',
            metadata: {
                bookingId: booking._id.toString(),
                action: 'refund'
            },
            io
        });
    } catch (error) {
        console.error('Error sending refund notification:', error);
    }
};
