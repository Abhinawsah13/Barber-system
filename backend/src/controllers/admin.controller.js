import User from '../models/User.js';
import Booking from '../models/Booking.js';
import PlatformEarning from '../models/PlatformEarning.js';
import Transaction from '../models/Transaction.js';
import Complaint from '../models/Complaint.js';
import Notification from '../models/Notification.js';

export const getDashboardStats = async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const bookingCount = await Booking.countDocuments();
        const totalEarnings = await PlatformEarning.aggregate([
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        res.json({
            success: true,
            data: {
                users: userCount,
                bookings: bookingCount,
                platform_earnings: totalEarnings[0]?.total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().sort({ created_at: -1 });
        res.json({ success: true, count: users.length, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('customer', 'username email')
            .populate('barber', 'username email')
            .populate('service', 'name price')
            .sort({ date: -1 });
        res.json({ success: true, count: bookings.length, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getPlatformEarnings = async (req, res) => {
    try {
        const earnings = await PlatformEarning.find()
            .populate('booking')
            .populate('barber', 'username')
            .sort({ created_at: -1 });
        res.json({ success: true, count: earnings.length, data: earnings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const manualRefund = async (req, res) => {
    try {
        const { bookingId } = req.body;
        const booking = await Booking.findById(bookingId);

        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        if (booking.payment_status === 'refunded') return res.status(400).json({ success: false, message: 'Already refunded' });
        if (booking.payment_status !== 'paid') return res.status(400).json({ success: false, message: 'Only paid bookings can be refunded' });

        const customer = await User.findById(booking.customer);
        if (customer) {
            customer.wallet_balance += booking.total_price;
            await customer.save();

            await Transaction.create({
                user: customer._id,
                type: 'credit',
                amount: booking.total_price,
                title: 'Manual Admin Refund',
                description: `Manual refund for booking #${booking._id}`,
                status: 'completed',
                reference_id: booking._id.toString()
            });

            booking.payment_status = 'refunded';
            booking.status = 'cancelled_by_barber'; // Mark as cancelled if refunded
            await booking.save();

            res.json({ success: true, message: 'Refund processed successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Customer not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const toggleUserSuspension = async (req, res) => {
    try {
        const { userId, reason } = req.body;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Toggle is_active
        user.is_active = !user.is_active;
        
        if (!user.is_active) {
            user.suspended_reason = reason || 'Suspended by Administrator';
            user.suspended_at = new Date();
        } else {
            user.suspended_reason = '';
            user.suspended_at = null;
        }

        await user.save();

        res.json({
            success: true,
            message: `User ${user.is_active ? 'activated' : 'suspended'} successfully`,
            data: user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find()
            .populate('complainant', 'username email')
            .populate('booking')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: complaints.length, data: complaints });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateComplaintStatus = async (req, res) => {
    try {
        const { complaintId, status, resolution_notes } = req.body;
        const complaint = await Complaint.findById(complaintId);

        if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

        complaint.status = status;
        complaint.resolution_notes = resolution_notes;
        
        if (status === 'resolved' || status === 'dismissed') {
            complaint.resolved_at = new Date();
            complaint.resolved_by = req.user._id;
        }

        await complaint.save();

        res.json({ success: true, message: 'Complaint updated successfully', data: complaint });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendBroadcastNotification = async (req, res) => {
    try {
        const { title, message, userType } = req.body; // userType could be 'all', 'customer', 'barber'
        
        let query = {};
        if (userType && userType !== 'all') {
            query.user_type = userType;
        }

        const users = await User.find(query).select('_id');
        
        const notifications = users.map(user => ({
            user: user._id,
            title,
            message,
            type: 'broadcast'
        }));

        await Notification.insertMany(notifications);

        res.json({ 
            success: true, 
            message: `Notification sent to ${users.length} ${userType || 'all'} users` 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
