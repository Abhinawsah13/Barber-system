import express from 'express';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get Wallet Details (Balance + Recent Transactions)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const transactions = await Transaction.find({ user: req.user._id })
            .sort({ created_at: -1 })
            .limit(20);

        res.json({
            success: true,
            data: {
                balance: user.wallet_balance || 0,
                loyalty_points: user.loyalty_points || 0,
                transactions
            }
        });
    } catch (error) {
        console.error('Get wallet error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add Money (Simulation)
router.post('/add-money', authenticateToken, async (req, res) => {
    try {
        const { amount, source } = req.body; // source: 'card', 'khalti', etc.

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Create transaction
        const transaction = new Transaction({
            user: user._id,
            type: 'credit',
            amount: amount,
            title: `Top-up via ${source || 'Card'}`,
            description: 'Wallet top-up',
            status: 'completed'
        });
        await transaction.save();

        // Update balance
        user.wallet_balance = (user.wallet_balance || 0) + parseFloat(amount);
        await user.save();

        res.json({
            success: true,
            message: 'Money added successfully',
            data: {
                balance: user.wallet_balance,
                transaction
            }
        });

    } catch (error) {
        console.error('Add money error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export default router;
