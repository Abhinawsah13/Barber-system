// controllers/admin.commission.controller.js
import PlatformEarning from '../models/PlatformEarning.js';
import Booking from '../models/Booking.js';
import BarberProfile from '../models/BarberProfile.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import SystemSettings from '../models/SystemSettings.js';
import mongoose from 'mongoose';

export const getCommissionOverview = async (req, res) => {
    try {
        // ─── RETROACTIVE FIX: Ensure all completed bookings have commissions ───
        const missedBookings = await Booking.find({
            status: 'completed',
            payment_status: { $ne: 'refunded' }
        }).lean();

        for (const booking of missedBookings) {
            // Check if PlatformEarning exists
            const existing = await PlatformEarning.findOne({ booking: booking._id });
            if (!existing) {
                const barberProfile = await BarberProfile.findOne({ user: booking.barber });
                if (barberProfile) {
                    const settings = await SystemSettings.findOne().lean() || { basic_commission: 10, premium_commission: 5 };
                    const bas_rate = (settings.basic_commission || 10) / 100;
                    const prem_rate = (settings.premium_commission !== undefined ? settings.premium_commission : 5) / 100;
                    
                    const commissionRate = barberProfile.subscription_plan === 'premium' ? prem_rate : bas_rate;
                    const commissionAmount = (booking.total_price || 0) * commissionRate;
                    
                    await PlatformEarning.create({
                        booking: booking._id,
                        amount: commissionAmount,
                        commission_rate: commissionRate * 100,
                        barber: booking.barber
                    });

                    // Ensure payment status is also updated
                    if (booking.payment_status !== 'paid') {
                        await Booking.findByIdAndUpdate(booking._id, { payment_status: 'paid' });
                    }
                }
            }
        }

        // ─── AGGREGATIONS ───

        // Total platform earnings
        const totalEarnings = await PlatformEarning.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // This month's earnings
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const monthlyEarnings = await PlatformEarning.aggregate([
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Today's earnings
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayEarnings = await PlatformEarning.aggregate([
            { $match: { createdAt: { $gte: startOfDay } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Average commission per booking
        const avgCommission = await PlatformEarning.aggregate([
            { $group: { _id: null, avg: { $avg: '$amount' } } }
        ]);

        // Commission by rate (5% vs 10%)
        const commissionByRate = await PlatformEarning.aggregate([
            {
                $group: {
                    _id: '$commission_rate',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Top earning barbers
        const topBarbers = await PlatformEarning.aggregate([
            {
                $group: {
                    _id: '$barber',
                    totalCommission: { $sum: '$amount' },
                    bookingCount: { $sum: 1 }
                }
            },
            { $sort: { totalCommission: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'barberInfo'
                }
            },
            { $unwind: '$barberInfo' },
            {
                $project: {
                    barberId: '$_id',
                    barberName: '$barberInfo.username',
                    barberEmail: '$barberInfo.email',
                    totalCommission: 1,
                    bookingCount: 1
                }
            }
        ]);

        // Subscription revenue
        const subscriptionRevenue = await Subscription.aggregate([
            { $match: { plan: 'premium', status: { $in: ['active', 'expired'] } } },
            { $group: { _id: null, total: { $sum: '$price_paid' } } }
        ]);

        // Robust Premium Count: Merge Unique IDs from Profile and Subscription models
        const profilesWithPremium = await BarberProfile.find({ subscription_plan: 'premium' }).distinct('user');
        const activeSubscriptions = await Subscription.find({ plan: 'premium', status: 'active' }).distinct('user');
        
        // Merge and deduplicate
        const uniquePremiumUsers = new Set([
            ...profilesWithPremium.map(id => id.toString()),
            ...activeSubscriptions.map(id => id.toString())
        ]);
        
        const premiumCount = uniquePremiumUsers.size;
        console.log(`[Dashboard Debug] Profiles (${profilesWithPremium.length}) + Subscriptions (${activeSubscriptions.length}) = Unique Premium Count: ${premiumCount}`);

        // Total booking volume (All completed bookings - now includes previously unpaid ones)
        const bookingVolume = await Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$total_price' } } }
        ]);

        // Total Barber payouts (Current profile balances + total earned)
        const totalBarberEarnings = await BarberProfile.aggregate([
            { $group: { _id: null, total: { $sum: '$earnings.total_earned' } } }
        ]);

        return res.json({
            success: true,
            data: {
                total_platform_earnings: totalEarnings[0]?.total || 0,
                monthly_earnings: monthlyEarnings[0]?.total || 0,
                today_earnings: todayEarnings[0]?.total || 0,
                average_commission_per_booking: avgCommission[0]?.avg || 0,
                commission_by_rate: commissionByRate,
                top_earning_barbers: topBarbers,
                subscription_revenue: subscriptionRevenue[0]?.total || 0,
                active_premium_subscribers: premiumCount,
                total_revenue: (totalEarnings[0]?.total || 0) + (subscriptionRevenue[0]?.total || 0),
                total_booking_volume: bookingVolume[0]?.total || 0,
                total_barber_payouts: totalBarberEarnings[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('[getCommissionOverview]', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

// ─── GET /admin/commission/transactions ──────────────────────────────────────
export const getCommissionTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20, barberId, startDate, endDate } = req.query;

        const filter = {};
        if (barberId) filter.barber = barberId;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const transactions = await PlatformEarning.find(filter)
            .populate('barber', 'username email')
            .populate({
                path: 'booking',
                select: 'date time_slot service total_price',
                populate: { path: 'service', select: 'name' }
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const count = await PlatformEarning.countDocuments(filter);

        return res.json({
            success: true,
            data: transactions,
            total: count,
            page: Number(page),
            pages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('[getCommissionTransactions]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /admin/commission/monthly-report ────────────────────────────────────
export const getMonthlyCommissionReport = async (req, res) => {
    try {
        const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // Daily breakdown
        const dailyBreakdown = await PlatformEarning.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dayOfMonth: '$createdAt' },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    day: '$_id',
                    total: 1,
                    count: 1,
                    _id: 0
                }
            }
        ]);

        // Commission by rate
        const rateBreakdown = await PlatformEarning.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: '$commission_rate',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Total for the month
        const monthTotal = await PlatformEarning.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Subscription revenue for the month
        const subscriptionRevenue = await Subscription.aggregate([
            {
                $match: {
                    plan: 'premium',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, total: { $sum: '$price_paid' } } }
        ]);

        return res.json({
            success: true,
            data: {
                year: Number(year),
                month: Number(month),
                daily_breakdown: dailyBreakdown,
                commission_by_rate: rateBreakdown,
                total_commission: monthTotal[0]?.total || 0,
                subscription_revenue: subscriptionRevenue[0]?.total || 0,
                total_revenue: (monthTotal[0]?.total || 0) + (subscriptionRevenue[0]?.total || 0)
            }
        });
    } catch (error) {
        console.error('[getMonthlyCommissionReport]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /admin/commission/barber/:barberId ──────────────────────────────────
export const getBarberCommissionDetails = async (req, res) => {
    try {
        const { barberId } = req.params;

        const barber = await User.findById(barberId).select('username email');
        if (!barber) {
            return res.status(404).json({ success: false, message: 'Barber not found' });
        }

        const profile = await BarberProfile.findOne({ user: barberId });
        const subscription = await Subscription.findOne({ user: barberId, status: 'active' });

        // Total commission generated by this barber
        const totalCommission = await PlatformEarning.aggregate([
            { $match: { barber: barberId } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Commission breakdown by rate
        const rateBreakdown = await PlatformEarning.aggregate([
            { $match: { barber: barberId } },
            {
                $group: {
                    _id: '$commission_rate',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Recent transactions
        const recentTransactions = await PlatformEarning.find({ barber: barberId })
            .populate('booking', 'date time_slot service total_price')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        return res.json({
            success: true,
            data: {
                barber: {
                    id: barber._id,
                    name: barber.username,
                    email: barber.email,
                    subscription_plan: profile?.subscription_plan || 'basic',
                    current_rate: subscription?.commission_rate || 10,
                },
                total_commission_generated: totalCommission[0]?.total || 0,
                commission_by_rate: rateBreakdown,
                recent_transactions: recentTransactions,
                barber_earnings: profile?.earnings || { balance: 0, total_earned: 0 }
            }
        });
    } catch (error) {
        console.error('[getBarberCommissionDetails]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /admin/commission/projections ───────────────────────────────────────
export const getRevenueProjections = async (req, res) => {
    try {
        // Last 30 days average
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const last30Days = await PlatformEarning.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);

        const avgDailyRevenue = (last30Days[0]?.total || 0) / 30;
        const avgBookingsPerDay = (last30Days[0]?.count || 0) / 30;

        // Projected monthly
        const projectedMonthly = avgDailyRevenue * 30;
        const projectedYearly = avgDailyRevenue * 365;

        // Active barbers
        const activeBarbers = await BarberProfile.countDocuments({ is_active: true });
        const premiumBarbers = await Subscription.countDocuments({ plan: 'premium', status: 'active' });

        // If all barbers upgrade to premium
        const currentAvgRate = 0.10 * (activeBarbers - premiumBarbers) + 0.05 * premiumBarbers;
        const potentialRate = 0.05; // If everyone was premium
        const potentialIncrease = (currentAvgRate - potentialRate) / currentAvgRate;

        return res.json({
            success: true,
            data: {
                last_30_days: {
                    total_revenue: last30Days[0]?.total || 0,
                    total_bookings: last30Days[0]?.count || 0,
                    avg_daily_revenue: avgDailyRevenue,
                    avg_bookings_per_day: avgBookingsPerDay,
                },
                projections: {
                    projected_monthly: projectedMonthly,
                    projected_yearly: projectedYearly,
                },
                barber_stats: {
                    total_active_barbers: activeBarbers,
                    premium_barbers: premiumBarbers,
                    basic_barbers: activeBarbers - premiumBarbers,
                    premium_conversion_rate: activeBarbers > 0
                        ? ((premiumBarbers / activeBarbers) * 100).toFixed(2) + '%'
                        : '0%'
                },
                insights: {
                    message: premiumBarbers < activeBarbers
                        ? `If all ${activeBarbers - premiumBarbers} Basic barbers upgrade to Premium, commission revenue would decrease by ${(potentialIncrease * 100).toFixed(0)}%, but subscription revenue would increase by Rs ${(activeBarbers - premiumBarbers) * 999}/month`
                        : 'All barbers are on Premium plan!'
                }
            }
        });
    } catch (error) {
        console.error('[getRevenueProjections]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
