// controllers/subscription.controller.js
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import BarberProfile from '../models/BarberProfile.js';
import Transaction from '../models/Transaction.js';
import SystemSettings from '../models/SystemSettings.js';
import { createNotification } from '../services/notification.service.js';

// ✅ SUBSCRIPTION PLANS CONFIGURATION
export const SUBSCRIPTION_PLANS = {
    basic: {
        name: 'Basic Plan',
        price: 0, // FREE
        duration_days: 30,
        commission_rate: 10, // 10% commission
        features: {
            max_services: 10,
            priority_listing: false,
            analytics_access: false,
            promotional_boost: false,
        },
        description: 'Perfect for getting started',
        badge: '🆓',
    },
    premium: {
        name: 'Premium Plan',
        price: 999, // Rs 999/month
        duration_days: 30,
        commission_rate: 5, // 5% commission (50% savings!)
        features: {
            max_services: -1, // unlimited
            priority_listing: true,
            analytics_access: true,
            promotional_boost: true,
        },
        description: 'For serious professionals',
        badge: '⭐',
    }
};

export const getDynamicPlans = async () => {
    let settings = await SystemSettings.findOne();
    if (!settings) settings = { basic_commission: 10, premium_commission: 5, premium_subscription_price: 999 };

    const plans = JSON.parse(JSON.stringify(SUBSCRIPTION_PLANS));
    plans.basic.commission_rate = settings.basic_commission;
    plans.premium.commission_rate = settings.premium_commission;
    plans.premium.price = settings.premium_subscription_price;
    return plans;
};

// ─── GET /subscriptions/plans ────────────────────────────────────────────────
export const getSubscriptionPlans = async (req, res) => {
    try {
        const dynamicPlans = await getDynamicPlans();
        return res.json({
            success: true,
            plans: dynamicPlans,
            message: `Premium plan reduces commission from ${dynamicPlans.basic.commission_rate}% to ${dynamicPlans.premium.commission_rate}%!`
        });
    } catch (error) {
        console.error('[getSubscriptionPlans]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /subscriptions/my-subscription ──────────────────────────────────────
export const getMySubscription = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find active subscription
        const subscription = await Subscription.findOne({
            user: userId,
            status: 'active'
        }).sort({ createdAt: -1 });

        if (!subscription) {
            const dynamicPlans = await getDynamicPlans();
            const basicPlan = dynamicPlans.basic;
            const newSubscription = await Subscription.create({
                user: userId,
                plan: 'basic',
                status: 'active',
                start_date: new Date(),
                end_date: new Date(Date.now() + basicPlan.duration_days * 24 * 60 * 60 * 1000),
                price_paid: 0,
                commission_rate: basicPlan.commission_rate,
                features: basicPlan.features,
            });

            // Update BarberProfile
            await BarberProfile.findOneAndUpdate(
                { user: userId },
                { subscription_plan: 'basic' }
            );

            return res.json({
                success: true,
                subscription: newSubscription,
                planDetails: basicPlan,
                message: 'Basic plan activated (free)'
            });
        }

        // Check if expired
        if (subscription.isExpired()) {
            subscription.status = 'expired';
            await subscription.save();

            // Downgrade to Basic
            await BarberProfile.findOneAndUpdate(
                { user: userId },
                { subscription_plan: 'basic' }
            );

            return res.json({
                success: false,
                subscription,
                message: 'Your subscription has expired. Upgrade to continue enjoying premium benefits!'
            });
        }

        const dynamicPlans = await getDynamicPlans();
        const planDetails = dynamicPlans[subscription.plan];

        return res.json({
            success: true,
            subscription,
            planDetails,
            daysRemaining: Math.ceil((subscription.end_date - new Date()) / (1000 * 60 * 60 * 24))
        });
    } catch (error) {
        console.error('[getMySubscription]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── POST /subscriptions/subscribe ───────────────────────────────────────────
export const subscribeToPlan = async (req, res) => {
    try {
        const { plan, paymentMethod = 'wallet' } = req.body;
        const userId = req.user._id;

        // Validate plan
        if (!['basic', 'premium'].includes(plan)) {
            return res.status(400).json({ success: false, message: 'Invalid plan. Choose: basic or premium' });
        }

        const dynamicPlans = await getDynamicPlans();
        const planDetails = dynamicPlans[plan];

        // Check wallet balance for premium
        if (plan === 'premium' && paymentMethod === 'wallet') {
            const user = await User.findById(userId);
            if (user.wallet_balance < planDetails.price) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient wallet balance. You need Rs ${planDetails.price}, but you have Rs ${user.wallet_balance}`
                });
            }
        }

        // Cancel existing active subscription
        await Subscription.updateMany(
            { user: userId, status: 'active' },
            { $set: { status: 'cancelled' } }
        );

        // Deduct from wallet (if premium)
        if (plan === 'premium' && paymentMethod === 'wallet') {
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet_balance: -planDetails.price }
            });

            await Transaction.create({
                user: userId,
                type: 'debit',
                amount: planDetails.price,
                title: '⭐ Premium Subscription',
                description: `${planDetails.name} - 30 days (5% commission rate)`,
                status: 'completed',
                reference_id: `SUB-${Date.now()}`
            });
        }

        // Create new subscription
        const endDate = new Date(Date.now() + planDetails.duration_days * 24 * 60 * 60 * 1000);
        const subscription = await Subscription.create({
            user: userId,
            plan,
            status: 'active',
            start_date: new Date(),
            end_date: endDate,
            price_paid: plan === 'premium' ? planDetails.price : 0,
            payment_method: paymentMethod,
            commission_rate: planDetails.commission_rate,
            features: planDetails.features,
        });

        // Update BarberProfile
        await BarberProfile.findOneAndUpdate(
            { user: userId },
            { subscription_plan: plan }
        );

        // Send notification
        const io = req.app.get('io');
        await createNotification({
            recipientId: userId,
            barberId: userId, // Current user is the barber
            message: plan === 'premium' 
                ? `⭐ Premium Activated! Enjoy 5% commission rate and priority listing.`
                : '🆓 Basic Plan Activated. Upgrade to Premium anytime for 50% lower commission!',
            type: 'subscription',
            metadata: { subscriptionId: subscription._id.toString(), plan },
            io,
        });

        return res.status(201).json({
            success: true,
            message: `${planDetails.name} activated successfully!`,
            subscription,
            planDetails,
            daysRemaining: planDetails.duration_days,
        });
    } catch (error) {
        console.error('[subscribeToPlan]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── POST /subscriptions/renew ───────────────────────────────────────────────
export const renewSubscription = async (req, res) => {
    try {
        const userId = req.user._id;
        const { paymentMethod = 'wallet' } = req.body;

        const subscription = await Subscription.findOne({
            user: userId,
            status: { $in: ['active', 'expired'] }
        }).sort({ createdAt: -1 });

        if (!subscription) {
            return res.status(404).json({ success: false, message: 'No subscription found to renew' });
        }

        const plan = subscription.plan;
        const dynamicPlans = await getDynamicPlans();
        const planDetails = dynamicPlans[plan];

        // Check wallet balance
        if (plan === 'premium' && paymentMethod === 'wallet') {
            const user = await User.findById(userId);
            if (user.wallet_balance < planDetails.price) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient wallet balance. You need Rs ${planDetails.price}`
                });
            }
        }

        // Deduct from wallet (premium only)
        if (plan === 'premium' && paymentMethod === 'wallet') {
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet_balance: -planDetails.price }
            });

            await Transaction.create({
                user: userId,
                type: 'debit',
                amount: planDetails.price,
                title: '⭐ Premium Renewal',
                description: `${planDetails.name} renewal - 30 days`,
                status: 'completed',
                reference_id: `RENEW-${Date.now()}`
            });
        }

        // Extend end date
        let baseDate = new Date();
        if (subscription.status === 'active' && subscription.end_date > new Date()) {
            baseDate = new Date(subscription.end_date);
        }
        
        const newEndDate = new Date(baseDate.getTime() + planDetails.duration_days * 24 * 60 * 60 * 1000);
        subscription.end_date = newEndDate;
        subscription.status = 'active';
        subscription.renewal_count += 1;
        subscription.last_renewal_date = new Date();
        await subscription.save();

        // Notify
        const io = req.app.get('io');
        await createNotification({
            recipientId: userId,
            barberId: userId,
            message: `⭐ ${planDetails.name} Renewed! Your plan has been extended for 30 more days.`,
            type: 'subscription',
            metadata: { subscriptionId: subscription._id.toString(), plan },
            io,
        });

        return res.json({
            success: true,
            message: 'Subscription renewed successfully!',
            subscription,
            daysRemaining: planDetails.duration_days,
        });
    } catch (error) {
        console.error('[renewSubscription]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── POST /subscriptions/cancel ──────────────────────────────────────────────
export const cancelSubscription = async (req, res) => {
    try {
        const userId = req.user._id;

        const subscription = await Subscription.findOne({
            user: userId,
            status: 'active'
        });

        if (!subscription) {
            return res.status(404).json({ success: false, message: 'No active subscription found' });
        }

        if (subscription.plan === 'basic') {
            return res.status(400).json({
                success: false,
                message: 'Basic plan is free and cannot be cancelled. You can upgrade to Premium anytime!'
            });
        }

        subscription.status = 'cancelled';
        subscription.auto_renew = false;
        await subscription.save();

        // Downgrade to Basic
        await BarberProfile.findOneAndUpdate(
            { user: userId },
            { subscription_plan: 'basic' }
        );

        // Notify
        const io = req.app.get('io');
        await createNotification({
            recipientId: userId,
            barberId: userId,
            message: 'Subscription Cancelled: Your Premium subscription has been cancelled and downgraded to Basic.',
            type: 'subscription',
            metadata: { subscriptionId: subscription._id.toString() },
            io,
        });

        return res.json({
            success: true,
            message: 'Premium subscription cancelled. You have been downgraded to Basic plan (10% commission).'
        });
    } catch (error) {
        console.error('[cancelSubscription]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /subscriptions/history ──────────────────────────────────────────────
export const getSubscriptionHistory = async (req, res) => {
    try {
        const userId = req.user._id;

        const history = await Subscription.find({ user: userId })
            .sort({ createdAt: -1 })
            .lean();

        return res.json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        console.error('[getSubscriptionHistory]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
