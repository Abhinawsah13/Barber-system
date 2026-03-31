import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    barberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String, // 'booked', 'cancelled', 'updated', etc.
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    metadata: {
        type: Object // Store bookingId or related info
    }
}, {
    timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
