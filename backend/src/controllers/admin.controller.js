import User from '../models/User.js';
import Booking from '../models/Booking.js';
import PlatformEarning from '../models/PlatformEarning.js';
import Transaction from '../models/Transaction.js';

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
