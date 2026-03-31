import Notification from '../models/Notification.js';
import { sendBookingEmail, sendCancellationEmail, sendConfirmationEmail } from './email.service.js';

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
export const createNotification = async ({ recipientId, barberId, customerId, message, type, metadata, io }) => {
    try {
        // If they provided recipientId directly, use it. 
        // If not, we fall back to barber (as the recipient) OR customer.
        const finalRecipientId = recipientId || barberId || customerId;

        const notification = new Notification({
            recipientId: finalRecipientId,
            barberId,
            customerId,
            message,
            type,
            metadata,
            isRead: false
        });
        await notification.save();

        // Emit real-time events
        if (io) {
            // Always emit to recipient
            io.to(`user-${finalRecipientId.toString()}`).emit('notification_received', notification);
            
            // If they are a barber, also emit to barber-specific dashboard listener
            if (barberId) {
                io.to(`barber-${barberId.toString()}`).emit('notification_received', notification);
                
                // Update unread count specifically for barber context
                const unreadCountBarber = await Notification.countDocuments({ recipientId: barberId, isRead: false });
                io.to(`barber-${barberId.toString()}`).emit('unread_count_update', { count: unreadCountBarber });
            }
        }

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

/**
 * Specifically handles booking confirmation notifications
 */
export const sendNewBookingNotification = async (booking, io) => {
    try {
        const dateStr = new Date(booking.date).toLocaleDateString();
        const customerName = booking.customer?.username || 'Customer';
        const barberName = booking.barber?.username || 'Barber';
        const serviceName = booking.service?.name || 'Service';

        // 1. Notify Barber
        await createNotification({
            recipientId: booking.barber._id || booking.barber,
            barberId: booking.barber._id || booking.barber,
            customerId: booking.customer._id || booking.customer,
            message: `New Booking: ${customerName} booked ${serviceName} on ${dateStr} at ${booking.time_slot}.`,
            type: 'booked',
            metadata: {
                bookingId: booking._id.toString(),
                customerName,
                serviceName,
                date: dateStr,
                time: booking.time_slot
            },
            io
        });

        // 2. Notify Customer
        await createNotification({
            recipientId: booking.customer._id || booking.customer,
            barberId: booking.barber._id || booking.barber,
            customerId: booking.customer._id || booking.customer,
            message: `Booking Placed: You booked ${serviceName} with ${barberName} for ${dateStr} at ${booking.time_slot}. Waiting for barber to confirm.`,
            type: 'booked',
            metadata: {
                bookingId: booking._id.toString(),
                barberName,
                serviceName,
                date: dateStr,
                time: booking.time_slot
            },
            io
        });
        // 3. Send Email
        await sendBookingEmail(booking);
    } catch (error) {
        console.error('Error sending new booking notification:', error);
    }
};

export const sendBookingConfirmationNotifications = async (booking, io) => {
    try {
        const dateStr = new Date(booking.date).toLocaleDateString();
        const customerName = booking.customer?.username || 'Customer';
        const barberName = booking.barber?.username || 'Barber';
        const serviceName = booking.service?.name || 'Service';

        // 1. Notify Barber
        await createNotification({
            recipientId: booking.barber._id || booking.barber,
            barberId: booking.barber._id || booking.barber,
            customerId: booking.customer._id || booking.customer,
            message: `Confirmed: ${customerName}'s booking for ${serviceName} on ${dateStr} at ${booking.time_slot} is now confirmed.`,
            type: 'updated',
            metadata: {
                bookingId: booking._id.toString(),
                customerName,
                serviceName,
                date: dateStr,
                time: booking.time_slot,
                action: 'confirmation'
            },
            io
        });

        // 2. Notify Customer
        await createNotification({
            recipientId: booking.customer._id || booking.customer,
            barberId: booking.barber._id || booking.barber,
            customerId: booking.customer._id || booking.customer,
            message: `Booking Confirmed! ${barberName} has accepted your booking for ${serviceName} on ${dateStr} at ${booking.time_slot}.`,
            type: 'updated',
            metadata: {
                bookingId: booking._id.toString(),
                barberName,
                serviceName,
                date: dateStr,
                time: booking.time_slot,
                action: 'confirmation'
            },
            io
        });
        // 3. Send Email
        await sendConfirmationEmail(booking);
    } catch (error) {
        console.error('Error sending booking confirmation notifications:', error);
    }
};

export const sendBookingCancellationNotifications = async (booking, cancelledBy, io) => {
    try {
        const dateStr = new Date(booking.date).toLocaleDateString();
        const customerName = booking.customer?.username || 'Customer';
        const barberName = booking.barber?.username || 'Barber';
        const serviceName = booking.service?.name || 'Service';
        const cancellerPath = cancelledBy === 'barber' ? 'Barber' : 'Customer';

        // 1. Notify Barber
        await createNotification({
            recipientId: booking.barber._id || booking.barber,
            barberId: booking.barber._id || booking.barber,
            customerId: booking.customer._id || booking.customer,
            message: `Cancelled: Booking for ${serviceName} on ${dateStr} at ${booking.time_slot} has been cancelled by ${cancellerPath}.`,
            type: 'cancelled',
            metadata: {
                bookingId: booking._id.toString(),
                customerName,
                serviceName,
                date: dateStr,
                time: booking.time_slot
            },
            io
        });

        // 2. Notify Customer
        await createNotification({
            recipientId: booking.customer._id || booking.customer,
            barberId: booking.barber._id || booking.barber,
            customerId: booking.customer._id || booking.customer,
            message: `Booking Cancelled: Your booking with ${barberName} for ${serviceName} on ${dateStr} at ${booking.time_slot} has been cancelled by ${cancellerPath}.`,
            type: 'cancelled',
            metadata: {
                bookingId: booking._id.toString(),
                barberName,
                serviceName,
                date: dateStr,
                time: booking.time_slot
            },
            io
        });
        // 3. Send Email
        await sendCancellationEmail(booking, cancelledBy);
    } catch (error) {
        console.error('Error sending cancellation notifications:', error);
    }
};

/**
 * Handles booking completion notifications
 */
export const sendBookingCompletedNotification = async (booking, io) => {
    try {
        const barberName = booking.barber?.username || 'Barber';
        const serviceName = booking.service?.name || 'Service';

        await createNotification({
            recipientId: booking.customer._id || booking.customer,
            barberId: booking.barber._id || booking.barber,
            customerId: booking.customer._id || booking.customer,
            message: `Service Completed! Your ${serviceName} with ${barberName} is finished. Please take a moment to rate your experience.`,
            type: 'updated',
            metadata: {
                bookingId: booking._id.toString(),
                barberName,
                serviceName,
                action: 'completion'
            },
            io
        });
    } catch (error) {
        console.error('Error sending booking completion notification:', error);
    }
};

/**
 * Handles refund notifications
 * ✅ Enhanced: uses actual refund_amount from booking
 */
export const sendRefundNotification = async (booking, io) => {
    try {
        const refundAmount = booking.refund_amount || booking.total_price;
        const refundPct = booking.refund_percentage || 100;

        await createNotification({
            barberId: booking.barber._id || booking.barber,
            customerId: booking.customer._id || booking.customer,
            message: `Refund: Rs ${refundAmount} (${refundPct}%) has been credited to ${booking.customer?.username || 'the customer'}'s wallet for booking #${booking._id.toString().substring(0, 8)}.`,
            type: 'updated',
            metadata: {
                bookingId: booking._id.toString(),
                action: 'refund',
                refund_amount: refundAmount,
                refund_percentage: refundPct,
            },
            io
        });
    } catch (error) {
        console.error('Error sending refund notification:', error);
    }
};
/**
 * Admin broadcasting to multiple users
 */
export const sendAdminNotification = async ({ title, message, target, io }) => {
    try {
        const User = (await import('../models/User.js')).default;
        
        let filter = { is_active: true };
        if (target === 'customer') filter.user_type = 'customer';
        if (target === 'barber') filter.user_type = 'barber';

        const users = await User.find(filter).select('_id');

        const notifications = users.map(user => ({
            recipientId: user._id,
            message: `${title}: ${message}`,
            type: 'admin',
            metadata: { title, originalMessage: message }
        }));

        // Batch insert for performance
        await Notification.insertMany(notifications);

        // Emit via socket
        if (io) {
            if (target === 'all') {
                io.emit('notification_received', { title, message, type: 'admin' });
            } else if (target === 'customer') {
                // We don't have a 'customers' room, so we can either emit to all and filter on client,
                // or emit to each user. For simplicity, since it's an admin push, we'll emit to a role room if it exists,
                // or just broadcast with a flag.
                // Let's use a dedicated role room for future scalability.
                io.to('customers').emit('notification_received', { title, message, type: 'admin' });
            } else if (target === 'barber') {
                io.to('barbers').emit('notification_received', { title, message, type: 'admin' });
            }
        }

        return users.length;
    } catch (error) {
        console.error('Error sending admin notification:', error);
        throw error;
    }
};
