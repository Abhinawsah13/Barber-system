// controllers/payment.controller.js
// ✅ Khalti & eSewa Payment Integration
import axios from 'axios';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import BarberProfile from '../models/BarberProfile.js';
import Service from '../models/Service.js';
import User from '../models/User.js';
import { sendNewBookingNotification } from '../services/notification.service.js';

// ─── Config ──────────────────────────────────────────────────────────────────
const KHALTI_SECRET = process.env.KHALTI_SECRET_KEY;
const KHALTI_BASE = process.env.NODE_ENV === 'production'
    ? 'https://khalti.com/api/v2'
    : 'https://dev.khalti.com/api/v2';

const ESEWA_MERCHANT = process.env.ESEWA_MERCHANT_ID || 'EPAYTEST';
const ESEWA_SECRET = process.env.ESEWA_SECRET || '8gBm/:&EnhH.1/q'; // sandbox default
const ESEWA_BASE = process.env.NODE_ENV === 'production'
    ? 'https://esewa.com.np'
    : 'https://uat.esewa.com.np';

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// ─── Helper: Create a pending booking for payment ────────────────────────────
const createPendingBooking = async (userId, data) => {
    const { barberId, serviceId, date, timeSlot, serviceType,
        customerAddress, notes, amount } = data;

    const service = await Service.findById(serviceId).lean();
    if (!service) throw new Error('Service not found');

    const barberProfile = await BarberProfile.findOne({ user: barberId }).lean();

    const booking = await Booking.create({
        customer: userId,
        barber: barberId,
        service: serviceId,
        date: new Date(date),
        time_slot: timeSlot,
        service_type: serviceType || 'salon',
        customer_address: customerAddress || '',
        notes: notes || '',
        barber_location: barberProfile?.location || null,
        total_price: amount,
        payment_status: 'pending',
        payment_method: 'khalti', // will be overridden per gateway
        status: 'pending',
    });

    return booking;
};

// ═══════════════════════════════════════════════════════════════════════════════
// KHALTI
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /v2/payments/khalti/initiate ───────────────────────────────────────
export const initiateKhalti = async (req, res) => {
    try {
        const { amount, customerName, customerEmail, customerPhone, existingBookingId, ...bookingData } = req.body;

        if (!KHALTI_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Khalti not configured. Set KHALTI_SECRET_KEY in .env'
            });
        }

        // 1. Create or retrieve booking
        let booking;
        if (existingBookingId) {
            booking = await Booking.findById(existingBookingId);
            if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
            if (booking.payment_status === 'paid') return res.status(400).json({ success: false, message: 'Booking is already paid' });
            booking.payment_method = 'khalti';
            await booking.save();
        } else {
            booking = await createPendingBooking(req.user._id, { ...bookingData, amount });
            booking.payment_method = 'khalti';
            await booking.save();
        }

        // 2. Get customer info for Khalti
        const customer = await User.findById(req.user._id).select('username email phone').lean();

        // 3. Initiate Khalti — amount must be in PAISA (Rs 100 = 10000 paisa)
        const khaltiRes = await axios.post(`${KHALTI_BASE}/epayment/initiate/`, {
            return_url: `${APP_BASE_URL}/api/v2/payments/khalti/callback`,
            website_url: APP_BASE_URL,
            amount: Math.round(amount * 100), // NPR → paisa
            purchase_order_id: booking._id.toString(),
            purchase_order_name: `Booking #${booking._id.toString().substring(0, 8)}`,
            customer_info: {
                name: customerName || customer?.username || 'Customer',
                email: customerEmail || customer?.email || 'customer@bookacutt.com',
                phone: customerPhone || customer?.phone || '9800000000',
            },
        }, {
            headers: { Authorization: `Key ${KHALTI_SECRET}` }
        });

        console.log('[Khalti] Initiate success:', khaltiRes.data);

        return res.json({
            success: true,
            paymentUrl: khaltiRes.data.payment_url,
            pidx: khaltiRes.data.pidx,
            bookingId: booking._id,
        });
    } catch (err) {
        console.error('[Khalti Initiate Error]', err.response?.data || err.message);
        return res.status(500).json({
            success: false,
            message: err.response?.data?.detail || err.message || 'Failed to initiate Khalti payment'
        });
    }
};

// ─── POST /v2/payments/khalti/verify ─────────────────────────────────────────
export const verifyKhalti = async (req, res) => {
    try {
        const { pidx, bookingId } = req.body;

        if (!pidx) {
            return res.status(400).json({ success: false, message: 'pidx is required' });
        }

        // Lookup payment status from Khalti
        const lookupRes = await axios.post(`${KHALTI_BASE}/epayment/lookup/`, { pidx }, {
            headers: { Authorization: `Key ${KHALTI_SECRET}` }
        });

        console.log('[Khalti] Lookup result:', lookupRes.data);

        const { status, transaction_id, total_amount } = lookupRes.data;

        if (status !== 'Completed') {
            return res.json({
                success: false,
                message: `Payment not completed. Status: ${status}`
            });
        }

        // 🛡️ SECURITY 1: Find existing booking and prevent duplicate payment
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (booking.payment_status === 'paid') {
            return res.status(400).json({ success: false, message: 'Payment has already been processed for this booking' });
        }

        // 🛡️ SECURITY 2: Verify Amount matches (Khalti sends paisa, DB is NPR)
        const verifiedAmount = total_amount / 100;
        if (Math.abs(verifiedAmount - booking.total_price) > 0.01) {
            console.error('[Khalti] Amount mismatch:', { expected: booking.total_price, received: verifiedAmount });
            return res.status(400).json({ success: false, message: 'Payment amount mismatch. Possible fraud attempt.' });
        }

        // 🛡️ SECURITY 3: Ensure transaction_id is not already used elsewhere
        const duplicateTxn = await Booking.findOne({ transaction_id: transaction_id, _id: { $ne: bookingId } });
        if (duplicateTxn) {
            console.error('[Khalti] FRAUD ALERT: transaction_id already used:', transaction_id);
            return res.status(400).json({ success: false, message: 'Transaction ID already used.' });
        }

        // Mark booking as paid (Using Atomic Update for Race Conditions)
        const updatedBooking = await Booking.findOneAndUpdate(
            { _id: bookingId, payment_status: { $ne: 'paid' } },
            {
                payment_status: 'paid',
                payment_method: 'khalti',
                transaction_id: transaction_id,
            },
            { new: true }
        )
            .populate('customer', 'username phone')
            .populate('barber', 'username profile_image')
            .populate('service', 'name price');

        if (!updatedBooking) {
             return res.status(400).json({ success: false, message: 'Concurrent payment processing detected.' });
        }

        // Send booking notification
        const io = req.app.get('io');
        await sendNewBookingNotification(updatedBooking, io);

        return res.json({
            success: true,
            transactionId: transaction_id,
            message: 'Payment verified successfully'
        });
    } catch (err) {
        console.error('[Khalti Verify Error]', err.response?.data || err.message);
        return res.status(500).json({
            success: false,
            message: err.response?.data?.detail || err.message || 'Payment verification failed'
        });
    }
};

// ─── GET /v2/payments/khalti/callback ────────────────────────────────────────
// Khalti redirects here after payment — WebView will detect this URL
export const khaltiCallback = async (req, res) => {
    const { pidx, status, purchase_order_id } = req.query;
    console.log('[Khalti Callback]', { pidx, status, purchase_order_id });

    // Return a simple HTML page that the WebView can detect
    res.send(`
        <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
            <div style="text-align:center">
                <h2>${status === 'Completed' ? '✅ Payment Successful!' : '❌ Payment ' + status}</h2>
                <p>Redirecting back to app...</p>
            </div>
        </body>
        </html>
    `);
};

// ═══════════════════════════════════════════════════════════════════════════════
// eSEWA
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /v2/payments/esewa/initiate ────────────────────────────────────────
export const initiateEsewa = async (req, res) => {
    try {
        const { amount, existingBookingId, ...bookingData } = req.body;

        // 1. Create or retrieve booking
        let booking;
        if (existingBookingId) {
            booking = await Booking.findById(existingBookingId);
            if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
            if (booking.payment_status === 'paid') return res.status(400).json({ success: false, message: 'Booking is already paid' });
            booking.payment_method = 'esewa';
            await booking.save();
        } else {
            booking = await createPendingBooking(req.user._id, { ...bookingData, amount });
            booking.payment_method = 'esewa';
            await booking.save();
        }

        // 2. Generate eSewa HMAC signature
        const transactionUuid = booking._id.toString();
        const signatureString = `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${ESEWA_MERCHANT}`;
        const signature = crypto
            .createHmac('sha256', ESEWA_SECRET)
            .update(signatureString)
            .digest('base64');

        // 3. Return the form URL — the app will serve it via WebView
        const successUrl = `${APP_BASE_URL}/api/v2/payments/esewa/callback?bookingId=${booking._id}`;
        const failureUrl = `${APP_BASE_URL}/api/v2/payments/esewa/failure`;

        return res.json({
            success: true,
            bookingId: booking._id,
            // Return all form params so the app can build the WebView HTML
            esewaParams: {
                amount,
                tax_amount: 0,
                total_amount: amount,
                transaction_uuid: transactionUuid,
                product_code: ESEWA_MERCHANT,
                product_service_charge: 0,
                product_delivery_charge: 0,
                success_url: successUrl,
                failure_url: failureUrl,
                signed_field_names: 'total_amount,transaction_uuid,product_code',
                signature,
                action: `${ESEWA_BASE}/api/epay/main/v2/form`,
            }
        });
    } catch (err) {
        console.error('[eSewa Initiate Error]', err.response?.data || err.message);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to initiate eSewa payment'
        });
    }
};

// ─── POST /v2/payments/esewa/verify ──────────────────────────────────────────
export const verifyEsewa = async (req, res) => {
    try {
        const { encodedData, bookingId } = req.body;

        if (!encodedData) {
            return res.status(400).json({ success: false, message: 'encodedData is required' });
        }

        // Decode base64 response from eSewa
        const decoded = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf8'));
        console.log('[eSewa] Decoded response:', decoded);

        const { status, transaction_uuid, total_amount, transaction_code, signed_field_names, signature } = decoded;

        // Verify HMAC signature
        if (signed_field_names && signature) {
            const signatureString = signed_field_names
                .split(',')
                .map(f => `${f}=${decoded[f]}`)
                .join(',');
            const expectedSig = crypto
                .createHmac('sha256', ESEWA_SECRET)
                .update(signatureString)
                .digest('base64');

            if (expectedSig !== signature) {
                console.error('[eSewa] Signature mismatch!');
                return res.json({ success: false, message: 'Invalid payment signature' });
            }
        }

        if (status !== 'COMPLETE') {
            return res.json({
                success: false,
                message: `Payment not completed. Status: ${status}`
            });
        }

        const targetBookingId = bookingId || transaction_uuid;

        // 🛡️ SECURITY 1: Find existing booking and prevent duplicate payment
        const booking = await Booking.findById(targetBookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (booking.payment_status === 'paid') {
            return res.status(400).json({ success: false, message: 'Payment has already been processed for this booking' });
        }

        // 🛡️ SECURITY 2: Verify Amount matches
        const verifiedAmount = Number(total_amount);
        if (Math.abs(verifiedAmount - booking.total_price) > 0.01) {
            console.error('[eSewa] Amount mismatch:', { expected: booking.total_price, received: verifiedAmount });
            return res.status(400).json({ success: false, message: 'Payment amount mismatch. Possible fraud attempt.' });
        }

        // 🛡️ SECURITY 3: Verify the transaction UUID matches the booking ID
        if (transaction_uuid && transaction_uuid !== targetBookingId) {
            console.error('[eSewa] Transaction UUID mismatch:', { expected: targetBookingId, received: transaction_uuid });
            return res.status(400).json({ success: false, message: 'Invalid transaction tracking ID.' });
        }

        // 🛡️ SECURITY 4: Ensure transaction_code is not already used elsewhere
        const duplicateTxn = await Booking.findOne({ transaction_id: transaction_code, _id: { $ne: targetBookingId } });
        if (duplicateTxn && transaction_code) {
             console.error('[eSewa] FRAUD ALERT: transaction_code already used:', transaction_code);
             return res.status(400).json({ success: false, message: 'Transaction ID already used.' });
        }

        // Mark booking as paid (Using Atomic Update)
        const updatedBooking = await Booking.findOneAndUpdate(
            { _id: targetBookingId, payment_status: { $ne: 'paid' } },
            {
                payment_status: 'paid',
                payment_method: 'esewa',
                transaction_id: transaction_code,
            },
            { new: true }
        )
            .populate('customer', 'username phone')
            .populate('barber', 'username profile_image')
            .populate('service', 'name price');

        if (!updatedBooking) {
             return res.status(400).json({ success: false, message: 'Concurrent payment processing detected or already paid.' });
        }

        // Send booking notification
        const io = req.app.get('io');
        await sendNewBookingNotification(updatedBooking, io);

        return res.json({
            success: true,
            transactionId: transaction_code,
            message: 'eSewa payment verified successfully'
        });
    } catch (err) {
        console.error('[eSewa Verify Error]', err.message);
        return res.status(500).json({
            success: false,
            message: err.message || 'eSewa payment verification failed'
        });
    }
};

// ─── GET /v2/payments/esewa/callback ─────────────────────────────────────────
export const esewaCallback = async (req, res) => {
    const { data, bookingId } = req.query;
    console.log('[eSewa Callback] bookingId:', bookingId, 'data:', data?.substring(0, 50));

    res.send(`
        <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
            <div style="text-align:center">
                <h2>✅ eSewa Payment Received!</h2>
                <p>Redirecting back to app...</p>
            </div>
        </body>
        </html>
    `);
};

// ─── GET /v2/payments/esewa/failure ──────────────────────────────────────────
export const esewaFailure = async (req, res) => {
    console.log('[eSewa Failure]', req.query);
    res.send(`
        <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
            <div style="text-align:center">
                <h2>❌ Payment Failed</h2>
                <p>Redirecting back to app...</p>
            </div>
        </body>
        </html>
    `);
};
