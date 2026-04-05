// controllers/payment.controller.js
// ✅ Khalti Payment Integration (eSewa removed)
import axios from 'axios';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import BarberProfile from '../models/BarberProfile.js';
import Service from '../models/Service.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { sendNewBookingNotification } from '../services/notification.service.js';

// ─── Config ──────────────────────────────────────────────────────────────────
const KHALTI_SECRET = process.env.KHALTI_SECRET_KEY;
const KHALTI_PUBLIC = process.env.KHALTI_PUBLIC_KEY; 
const KHALTI_BASE = 'https://dev.khalti.com/api/v2'; 



const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// ─── Helper: Duplicate slot guard ────────────────────────────────────────────
const isSlotAlreadyBooked = async (barberId, date, timeSlot) => {
    const existing = await Booking.findOne({
        barber: barberId,
        date: new Date(date),
        time_slot: timeSlot,
        status: { $in: ['pending', 'confirmed', 'completed'] },
    }).lean();
    return !!existing;
};

// ─── Helper: Create a confirmed booking AFTER payment succeeds ────────────────
const createConfirmedBooking = async (userId, data, pidx) => {
    const { barberId, serviceId, date, timeSlot, serviceType,
        customerAddress, notes, amount } = data;

    const service = await Service.findById(serviceId).lean();
    if (!service) throw new Error('Service not found');

    const barberProfile = await BarberProfile.findOne({ user: barberId }).lean();

    // ✅ Duplicate slot guard before DB write
    const alreadyBooked = await isSlotAlreadyBooked(barberId, date, timeSlot);
    if (alreadyBooked) {
        throw Object.assign(new Error('This time slot is already booked. Please choose another.'), { statusCode: 409 });
    }

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
        payment_status: 'paid',      // ✅ Immediately paid — created only after confirmation
        payment_method: 'khalti',
        transaction_id: pidx,
        status: 'pending',
    });

    return booking;
};


// ═══════════════════════════════════════════════════════════════════════════════
// KHALTI
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /v2/payments/khalti/initiate ───────────────────────────────────────
// ✅ FIXED: Does NOT create a booking here.
// Booking is created ONLY inside verifyKhalti, after Khalti confirms payment.
export const initiateKhalti = async (req, res) => {
    try {
        const { amount, barberId, serviceId, date, timeSlot, serviceType,
            customerAddress, notes } = req.body;

        if (!KHALTI_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Khalti not configured. Set KHALTI_SECRET_KEY in .env'
            });
        }

        // Validate required booking fields upfront
        if (!barberId || !serviceId || !date || !timeSlot || !amount) {
            return res.status(400).json({
                success: false,
                message: 'barberId, serviceId, date, timeSlot, and amount are required'
            });
        }

        // ✅ Pre-flight duplicate check BEFORE involving Khalti
        const alreadyBooked = await isSlotAlreadyBooked(barberId, date, timeSlot);
        if (alreadyBooked) {
            return res.status(409).json({
                success: false,
                message: 'This time slot is already booked. Please choose another.'
            });
        }

        // 1. Get customer info for Khalti
        const customer = await User.findById(req.user._id).select('username email phone').lean();

        // 2. Use a unique order ID — we use a temp reference (NOT a booking ID)
        //    The real booking is created in verifyKhalti after payment succeeds.
        const tempOrderId = `TEMP_${req.user._id}_${Date.now()}`;

        // 3. Initiate KPG-2 Payment
        const response = await axios.post(
            `${KHALTI_BASE}/epayment/initiate/`,
            {
                return_url: `${APP_BASE_URL}/api/v2/payments/khalti/callback`,
                website_url: APP_BASE_URL,
                amount: Math.round(amount * 100), // convert Rs to Paisa
                purchase_order_id: tempOrderId,
                purchase_order_name: `Barber Booking - ${customer.username || 'Customer'}`,
                customer_info: {
                    name: customer.username || "Test User",
                    email: customer.email || "test@gmail.com",
                    phone: customer.phone || "9800000000"
                }
            },
            {
                headers: {
                    Authorization: `Key ${KHALTI_SECRET}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const { pidx, payment_url } = response.data;

        return res.json({
            success: true,
            paymentUrl: payment_url,
            pidx: pidx,
            // Return booking intent data so the frontend can pass it back on verify
            bookingIntent: { barberId, serviceId, date, timeSlot, serviceType, customerAddress, notes, amount },
        });
    } catch (err) {
        console.error('[Khalti Initiate Error]', err.response?.data || err.message);
        return res.status(500).json({ success: false, message: err.response?.data?.detail || 'Failed to initiate' });
    }
};


// ─── GET /v2/payments/khalti/v1-widget ──────────────────────────────────────
export const khaltiWidget = async (req, res) => {
    const { amount, order_id, order_name } = req.query;
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Khalti Payment</title>
            <script src="https://khalti.s3.ap-south-1.amazonaws.com/KPG/dist/2020.12.22.0.0.0/khalti-checkout.iffe.js"></script>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f5f5f5; }
                .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; width: 85%; max-width: 400px; }
                img { margin-bottom: 20px; }
                button { background-color: #5c2d91; color: white; border: none; padding: 18px 40px; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer; transition: 0.3s; width: 100%; }
                button:active { transform: scale(0.98); opacity: 0.9; }
                #status { margin-top: 20px; color: #666; }
            </style>
        </head>
        <body>
            <div class="card">
                <img src="https://khalti.com/static/img/logo1.png" width="160" alt="Khalti">
                <p style="font-size: 18px; margin-bottom: 10px;">${order_name}</p>
                <p style="font-size: 24px; font-weight: bold; color: #5c2d91; margin: 10px 0;">Rs. ${amount / 100}</p>
                <button id="payment-button">Pay with Khalti</button>
                <p id="status">Loading Khalti...</p>
            </div>

            <script>
                var config = {
                    "publicKey": "${KHALTI_PUBLIC}",
                    "productIdentity": "${order_id}",
                    "productName": "${order_name}",
                    "productUrl": "${APP_BASE_URL}",
                    "paymentPreference": ["KHALTI", "EBANKING", "MOBILE_BANKING", "CONNECT_IPS"],
                    "eventHandler": {
                        onSuccess (payload) {
                            document.getElementById('status').innerText = "✅ Verifying...";
                            window.location.href = "${APP_BASE_URL}/api/v2/payments/khalti/callback?status=Completed&pidx=" + payload.token + "&purchase_order_id=${order_id}";
                        },
                        onError (error) {
                            document.getElementById('status').innerText = "❌ " + (error.detail || "Payment failed.");
                        },
                        onClose () { console.log("closed"); }
                    }
                };
                var checkout = new KhaltiCheckout(config);
                var btn = document.getElementById("payment-button");
                btn.onclick = function () { checkout.show({amount: ${amount}}); }
                document.getElementById('status').innerText = "Click the button below to pay";
                setTimeout(() => btn.click(), 800);
            </script>
        </body>
        </html>
    `);
};

// ─── POST /v2/payments/khalti/verify ─────────────────────────────────────────
// ✅ FIXED: Booking is created HERE, only after Khalti confirms payment.
// Frontend must pass back the bookingIntent data from the initiate response.
export const verifyKhalti = async (req, res) => {
    try {
        const { pidx, bookingIntent } = req.body;

        if (!pidx) return res.status(400).json({ success: false, message: 'pidx is required' });
        if (!bookingIntent) return res.status(400).json({ success: false, message: 'bookingIntent is required' });

        // 1. Confirm payment status with Khalti
        const response = await axios.post(
            `${KHALTI_BASE}/epayment/lookup/`,
            { pidx },
            {
                headers: {
                    Authorization: `Key ${KHALTI_SECRET}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = response.data;
        console.log('[Khalti Verify Lookup]', data);

        if (data.status !== 'Completed') {
            return res.status(400).json({ success: false, message: `Payment not completed. Status: ${data.status}` });
        }

        // 2. ✅ Amount verification
        const expectedPaisa = Math.round(bookingIntent.amount * 100);
        if (data.total_amount < expectedPaisa) {
            return res.status(400).json({ success: false, message: 'Payment amount is insufficient.' });
        }

        // 3. ✅ Idempotency: check if booking was already created for this pidx
        const existingBooking = await Booking.findOne({ transaction_id: pidx }).lean();
        if (existingBooking) {
            return res.json({
                success: true,
                message: 'Payment already processed',
                bookingId: existingBooking._id,
                transactionId: pidx
            });
        }

        // 4. ✅ Create booking ONLY NOW, after payment is confirmed
        let booking;
        try {
            booking = await createConfirmedBooking(req.user._id, bookingIntent, pidx);
        } catch (bookingErr) {
            // Handle duplicate slot error gracefully
            if (bookingErr.statusCode === 409 || bookingErr.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: 'This time slot was just booked by someone else. Please choose another slot.'
                });
            }
            throw bookingErr;
        }

        // 5. Populate and notify
        const populatedBooking = await Booking.findById(booking._id)
            .populate('customer', 'username phone')
            .populate('barber', 'username profile_image')
            .populate('service', 'name price');

        const io = req.app.get('io');
        if (populatedBooking && io) {
            await sendNewBookingNotification(populatedBooking, io);
        }

        return res.json({
            success: true,
            transactionId: pidx,
            bookingId: booking._id,
            message: 'Payment verified and booking confirmed!'
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
// Khalti redirects here after payment (web browser redirect — used for web only)
// ✅ NOTE: For React Native, verifyKhalti (POST) is the canonical endpoint.
export const khaltiCallback = async (req, res) => {
    try {
        const { pidx, status, purchase_order_id, transaction_id } = req.query;
        console.log('[Khalti Callback]', { pidx, status, purchase_order_id });

        if (status !== 'Completed') {
            return res.send(`
                <html>
                <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background-color:#f8d7da">
                    <div style="text-align:center;padding:20px;background:white;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.1)">
                        <h2 style="color:#721c24">❌ Payment ${status || 'Failed'}</h2>
                        <p>Something went wrong with your payment. Please try again.</p>
                        <button onclick="window.close()" style="margin-top:20px;padding:10px 20px;border:none;background:#5c2d91;color:white;border-radius:8px;cursor:pointer">Back to App</button>
                    </div>
                </body>
                </html>
            `);
        }

        // Verify with Khalti lookup
        const lookupRes = await axios.post(
            `${KHALTI_BASE}/epayment/lookup/`,
            { pidx },
            {
                headers: {
                    Authorization: `Key ${KHALTI_SECRET}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const result = lookupRes.data;

        if (result.status === 'Completed') {
            // ✅ Idempotency: check if booking already created for this pidx
            const existingBooking = await Booking.findOne({ transaction_id: pidx }).lean();
            if (!existingBooking) {
                // Check if it's a wallet top-up transaction
                const transaction = await Transaction.findById(purchase_order_id);
                if (transaction && transaction.status !== 'completed') {
                    transaction.status = 'completed';
                    transaction.reference_id = pidx;
                    await transaction.save();

                    const user = await User.findById(transaction.user);
                    user.wallet_balance = (user.wallet_balance || 0) + transaction.amount;
                    await user.save();
                }
                // ✅ Note: For bookings via React Native, verifyKhalti (POST) handles creation.
                // The callback is primarily a browser redirect confirmation page.
            }

            return res.send(`
                <html>
                <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background-color:#d4edda">
                    <div style="text-align:center;padding:20px;background:white;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.1)">
                        <h2 style="color:#155724">✅ Payment Successful!</h2>
                        <p>Your payment has been verified. You can now close this window.</p>
                        <button onclick="window.close()" style="margin-top:20px;padding:10px 20px;border:none;background:#5c2d91;color:white;border-radius:8px;cursor:pointer">Back to App</button>
                    </div>
                    <script>
                        setTimeout(() => { /* close or redirect if needed */ }, 3000);
                    </script>
                </body>
                </html>
            `);
        }

        res.send("Processing payment...");
    } catch (err) {
        console.error('[Khalti Callback Error]', err.response?.data || err.message);
        res.status(500).send("Error verifying payment");
    }
};


// ─── WALLET TOP-UP ──────────────────────────────────────────────────────────

export const initiateKhaltiTopUp = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount < 10) {
            return res.status(400).json({ success: false, message: 'Minimum RS 10 top-up required' });
        }

        // 1. Create a pending transaction
        const transaction = await Transaction.create({
            user: req.user._id,
            type: 'credit',
            amount: amount,
            title: 'Khalti Top-up (Pending)',
            description: 'Wallet top-up via Khalti',
            status: 'pending'
        });

        // 2. Get customer info
        const customer = await User.findById(req.user._id).select('username email phone').lean();

        // 3. Initiate KPG-2 Top-up
        const response = await axios.post(
            `${KHALTI_BASE}/epayment/initiate/`,
            {
                return_url: `${APP_BASE_URL}/api/v2/payments/khalti/callback`,
                website_url: APP_BASE_URL,
                amount: Math.round(amount * 100),
                purchase_order_id: transaction._id.toString(),
                purchase_order_name: `Wallet Top-up - ${customer.username}`,
                customer_info: {
                    name: customer.username,
                    email: customer.email,
                    phone: customer.phone
                }
            },
            {
                headers: {
                    Authorization: `Key ${KHALTI_SECRET}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const { pidx, payment_url } = response.data;
        transaction.reference_id = pidx; // track pidx
        await transaction.save();

        return res.json({
            success: true,
            paymentUrl: payment_url,
            pidx: pidx,
            transactionId: transaction._id.toString(),
        });

    } catch (err) {
        console.error('[Khalti Topup Error]', err.response?.data || err.message);
        return res.status(500).json({
            success: false,
            message: err.response?.data?.detail || err.message || 'Failed to initiate top-up'
        });
    }
};


export const verifyKhaltiTopUp = async (req, res) => {
    try {
        const { pidx, transactionId: bodyTxnId } = req.body;

        if (!pidx) return res.status(400).json({ success: false, message: 'pidx is required' });

        // Lookup
        const lookupRes = await axios.post(
            `${KHALTI_BASE}/epayment/lookup/`,
            { pidx },
            {
                headers: {
                    Authorization: `Key ${KHALTI_SECRET}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = lookupRes.data;
        console.log('[Khalti Topup Verify Lookup]', data);

        if (data.status !== "Completed") {
            return res.status(400).json({ success: false, message: `Status: ${data.status}` });
        }

        const transactionId = data.purchase_order_id || bodyTxnId;

        // 1. Find transaction
        const pendingTxn = await Transaction.findById(transactionId);
        if (!pendingTxn) return res.status(404).json({ success: false, message: 'Txn not found' });
        if (pendingTxn.status === 'completed') return res.json({ success: true, message: 'Already processed' });

        // 2. Validate amount
        if (data.total_amount < (pendingTxn.amount * 100)) {
            return res.status(400).json({ success: false, message: 'Insufficient amount' });
        }

        // 3. Update
        pendingTxn.status = 'completed';
        pendingTxn.reference_id = pidx;
        pendingTxn.title = 'Khalti Top-up';
        await pendingTxn.save();

        const user = await User.findById(pendingTxn.user);
        user.wallet_balance = (user.wallet_balance || 0) + pendingTxn.amount;
        await user.save();

        return res.json({
            success: true,
            balance: user.wallet_balance,
            message: 'Wallet topped up successfully!'
        });

    } catch (err) {
        console.error('[Khalti Topup Verify Error]', err.response?.data || err.message);
        return res.status(500).json({ success: false, message: 'Verification failed' });
    }
};

export const requestWithdrawal = async (req, res) => {
    try {
        const { amount, khaltiId } = req.body;

        if (!amount || amount < 100) {
            return res.status(400).json({ success: false, message: 'Minimum Rs. 100 withdrawal required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if ((user.wallet_balance || 0) < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        await Transaction.create({
            user: req.user._id,
            type: 'debit',
            amount: amount,
            title: 'Withdrawal (Pending)',
            description: `Khalti/Bank: ${khaltiId || user.phone || 'Same as profile'}`,
            status: 'pending'
        });

        user.wallet_balance = (user.wallet_balance || 0) - amount;
        await user.save();

        return res.json({
            success: true,
            balance: user.wallet_balance,
            message: 'Withdrawal request submitted! Processing soon.'
        });

    } catch (err) {
        console.error('[Withdrawal Error]', err.message);
        return res.status(500).json({ success: false, message: 'Withdrawal failed' });
    }
};