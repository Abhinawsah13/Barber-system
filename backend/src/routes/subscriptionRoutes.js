// routes/subscriptionRoutes.js
import express from 'express';
import {
    getSubscriptionPlans,
    getMySubscription,
    subscribeToPlan,
    renewSubscription,
    cancelSubscription,
    getSubscriptionHistory
} from '../controllers/subscription.controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ All routes require authentication + barber role
router.use(protect);
router.use(restrictTo('barber'));

// Get available plans
router.get('/plans', getSubscriptionPlans);

// Get my current subscription
router.get('/my-subscription', getMySubscription);

// Subscribe to a plan
router.post('/subscribe', subscribeToPlan);

// Renew subscription
router.post('/renew', renewSubscription);

// Cancel subscription
router.post('/cancel', cancelSubscription);

// Subscription history
router.get('/history', getSubscriptionHistory);

export default router;
