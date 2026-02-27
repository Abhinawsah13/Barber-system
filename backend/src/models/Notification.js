import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String, // 'booking_success', 'booking_status', 'promo', etc.
        default: 'info'
    },
    is_read: {
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
