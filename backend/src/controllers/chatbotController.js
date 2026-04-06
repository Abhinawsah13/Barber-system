// src/controllers/chatbotController.js
import { getChatbotResponse, checkMLHealth } from '../services/chatbotService.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import BarberProfile from '../models/BarberProfile.js';

export const chat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user._id;  // authMiddleware sets req.user = user object

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty' });
    }

    const mlResult = await getChatbotResponse(message.trim());
    const { intent, confidence, response, entities } = mlResult;

    let actionResult = null;

    switch (intent) {

      case 'book_appointment': {
        if (entities.service || entities.date || entities.barber_name) {
          let barberInfo = null;
          if (entities.barber_name) {
            const barberUser = await User.findOne({
              username: new RegExp(entities.barber_name, 'i'),
              user_type: 'barber',
            }).select('_id username');
            if (barberUser) {
              barberInfo = { id: barberUser._id, name: barberUser.username };
            }
          }
          actionResult = {
            action: 'NAVIGATE_TO_BOOKING',
            prefill: {
              service: entities.service || null,
              date: entities.date || null,
              time: entities.time || null,
              barber: barberInfo,
            },
          };
        }
        break;
      }

      case 'check_status': {
        const latestBooking = await Booking.findOne({ customer: userId })
          .sort({ createdAt: -1 })
          .populate('barber', 'username')
          .select('status date time_slot total_price');

        if (latestBooking) {
          actionResult = {
            action: 'SHOW_BOOKING_STATUS',
            booking: {
              status: latestBooking.status,
              date: latestBooking.date,
              time: latestBooking.time_slot,
              price: latestBooking.total_price,
              barber: latestBooking.barber?.username || 'Unknown',
            },
          };
        } else {
          actionResult = {
            action: 'NO_BOOKING_FOUND',
            message: 'You have no recent bookings.',
          };
        }
        break;
      }

      case 'wallet_balance': {
        const user = await User.findById(userId).select('wallet_balance');
        actionResult = {
          action: 'SHOW_WALLET',
          balance: user.wallet_balance || 0,
        };
        break;
      }

      case 'loyalty_points': {
        const user = await User.findById(userId).select('loyalty_points');
        const points = user.loyalty_points || 0;
        const tier = points >= 300 ? 'Gold' : points >= 100 ? 'Silver' : 'Bronze';
        const nextTier =
          tier === 'Bronze' ? `${100 - points} points to Silver`
            : tier === 'Silver' ? `${300 - points} points to Gold`
              : 'Maximum tier reached!';
        actionResult = { action: 'SHOW_LOYALTY', points, tier, nextTier };
        break;
      }

      case 'recommend_barber': {
        const topBarbers = await BarberProfile.find({})
          .sort({ 'rating.average': -1 })
          .limit(3)
          .populate('user', 'username');
        actionResult = {
          action: 'SHOW_BARBERS',
          barbers: topBarbers.map((b) => ({
            name: b.user?.username || 'Unknown',
            rating: b.rating?.average || 0,
            services: b.services?.slice(0, 3) || [],
          })),
        };
        break;
      }

      case 'cancel_booking': {
        const activeBooking = await Booking.findOne({
          customer: userId,
          status: { $in: ['pending', 'confirmed'] },
        }).sort({ createdAt: -1 }).select('_id status date time_slot total_price');

        if (activeBooking) {
          actionResult = {
            action: 'CONFIRM_CANCEL',
            bookingId: activeBooking._id,
            date: activeBooking.date,
            time: activeBooking.time_slot,
            price: activeBooking.total_price,
            status: activeBooking.status,
          };
        } else {
          actionResult = {
            action: 'NO_ACTIVE_BOOKING',
            message: 'You have no active bookings to cancel.',
          };
        }
        break;
      }

      case 'check_availability': {
        actionResult = { action: 'NAVIGATE_TO_BARBERS' };
        break;
      }

      case 'home_service': {
        actionResult = {
          action: 'NAVIGATE_TO_BOOKING',
          prefill: { serviceType: 'home' },
        };
        break;
      }

      default:
        actionResult = null;
        break;
    }

    return res.json({
      success: true,
      response,
      intent,
      confidence,
      entities,
      actionResult,
    });

  } catch (err) {
    console.error('Chatbot controller error:', err.message);
    return res.status(500).json({
      success: false,
      response: 'Something went wrong. Please try again.',
      intent: 'error',
      confidence: 0,
      entities: {},
      actionResult: null,
    });
  }
};

export const health = async (req, res) => {
  const mlStatus = await checkMLHealth();
  return res.json({ success: true, chatbot: 'online', ml_model: mlStatus });
};