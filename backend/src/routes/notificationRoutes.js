import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get all notifications for the current user (using req.user._id for security)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user._id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// GET /notifications/:barberId (specific requirement from user)
router.get('/:barberId', authenticateToken, async (req, res) => {
    try {
        // Security check: user should only see their own notifications
        if (req.params.barberId !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const notifications = await Notification.find({ recipientId: req.params.barberId })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: notifications
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        const unreadCount = await Notification.countDocuments({ 
            recipientId: req.user._id, 
            isRead: false 
        });
        res.json({ success: true, count: unreadCount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// PUT /notifications/read/:barberId → mark all as read (specific requirement)
router.put('/read/:barberId', authenticateToken, async (req, res) => {
    try {
        if (req.params.barberId !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        await Notification.updateMany(
            { recipientId: req.params.barberId, isRead: false },
            { $set: { isRead: true } }
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Mark a specific notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        if (notification.recipientId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        notification.isRead = true;
        await notification.save();

        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

export default router;
