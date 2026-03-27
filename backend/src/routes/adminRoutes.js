// routes/adminRoutes.js
import express from 'express';
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

// ─────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────
router.get('/dashboard', requireAdmin, async (req, res) => {
    try {
        const totalCustomers = await User.countDocuments({ user_type: 'customer' });
        const totalBarbers = await User.countDocuments({ user_type: 'barber' });
        const suspendedUsers = await User.countDocuments({ is_active: false });
        const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });

        res.json({
            success: true,
            data: {
                totalCustomers,
                totalBarbers,
                suspendedUsers,
                pendingComplaints
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────
// GET ALL USERS (customers + barbers)
// ─────────────────────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const { role, status } = req.query;

        let filter = { user_type: { $in: ['customer', 'barber'] } };

        if (role && role !== 'all') {
            filter.user_type = role;
        }

        if (status === 'active') filter.is_active = true;
        if (status === 'suspended') filter.is_active = false;

        const users = await User.find(filter)
            .select('username email user_type is_active suspended_reason suspended_at created_at profile_image phone')
            .sort({ created_at: -1 });

        res.json({ success: true, data: users });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────
// SUSPEND USER
// ─────────────────────────────────────────
router.put('/users/:userId/suspend', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.user_type === 'admin') {
            return res.status(403).json({ success: false, message: 'Cannot suspend admin' });
        }

        user.is_active = false;
        user.suspended_reason = reason || 'Suspended by admin';
        user.suspended_at = new Date();
        await user.save();

        res.json({ success: true, message: `${user.username} has been suspended.` });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────
// REACTIVATE USER
// ─────────────────────────────────────────
router.put('/users/:userId/reactivate', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.is_active = true;
        user.suspended_reason = '';
        user.suspended_at = null;
        await user.save();

        res.json({ success: true, message: `${user.username} has been reactivated.` });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────
// GET SINGLE USER DETAIL
// ─────────────────────────────────────────
router.get('/users/:userId', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .select('-password_hash');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, data: user });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────
// COMPLAINTS — GET ALL
// ─────────────────────────────────────────
router.get('/complaints', requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;

        let filter = {};
        if (status && status !== 'all') filter.status = status;

        const complaints = await Complaint.find(filter)
            .populate('userId', 'username email user_type profile_image')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: complaints });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────
// COMPLAINTS — RESOLVE
// ─────────────────────────────────────────
router.put('/complaints/:complaintId/resolve', requireAdmin, async (req, res) => {
    try {
        const { adminNote } = req.body;

        const complaint = await Complaint.findById(req.params.complaintId);
        if (!complaint) {
            return res.status(404).json({ success: false, message: 'Complaint not found' });
        }

        complaint.status = 'resolved';
        complaint.adminNote = adminNote || 'Resolved by admin';
        complaint.resolvedAt = new Date();
        await complaint.save();

        res.json({ success: true, message: 'Complaint resolved.' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────
// SUBMIT COMPLAINT (customer/barber)
// ─────────────────────────────────────────
router.post('/complaints', async (req, res) => {
    try {
        const { userId, userRole, subject, message } = req.body;

        if (!userId || !userRole || !subject || !message) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const complaint = new Complaint({ userId, userRole, subject, message });
        await complaint.save();

        res.status(201).json({ success: true, message: 'Complaint submitted successfully.' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─────────────────────────────────────────
// SEND NOTIFICATION
// ─────────────────────────────────────────
router.post('/notifications/send', requireAdmin, async (req, res) => {
    try {
        const { title, message, target } = req.body;
        // target: 'all' | 'customer' | 'barber'

        if (!title || !message || !target) {
            return res.status(400).json({ success: false, message: 'Title, message and target are required' });
        }

        let filter = { is_active: true };
        if (target !== 'all') {
            filter.user_type = target;
        }

        const users = await User.find(filter).select('_id username');

        // TODO: Connect to your push notification service here
        // For now, returns list of targeted users
        res.json({
            success: true,
            message: `Notification sent to ${users.length} users.`,
            data: { targetCount: users.length, target }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
