// src/index.js
import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './lib/db.js';
import authRoutes from './routes/authRoutes.js';
import barberRoutes from './routes/barberRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';

import serviceRoutesV2 from './routes/service.routes.js';
import barberRoutesV2 from './routes/barber.routes.js';
import bookingRoutesV2 from './routes/booking.routes.js';
import reviewRoutes from './routes/review.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import chatbotRoutes from './routes/chatbotRoutes.js';  // ← ADDED

// Debugging .env loading
console.log('Current CWD:', process.cwd());
const envResult = dotenv.config();
if (envResult.error) {
    console.error('Error loading .env:', envResult.error);
} else {
    console.log('.env loaded successfully. Keys:', Object.keys(envResult.parsed || {}));
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Security: Remove Express fingerprint header
app.disable('x-powered-by');

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes (original)
app.use('/api/auth', authRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
// app.use('/api/ai', aiRoutes); // disabled - Gemini quota exceeded
app.use('/api/chatbot', chatbotRoutes);  // ← ADDED

// Routes v2 — Sprint 2-3-5 modular routes
app.use('/api/v2/services', serviceRoutesV2);
app.use('/api/v2/barbers', barberRoutesV2);
app.use('/api/v2/bookings', bookingRoutesV2);
app.use('/api/v2/reviews', reviewRoutes);
app.use('/api/v2/payments', paymentRoutes);
// app.use('/api/v2/ai', aiRoutes); // disabled - Gemini quota exceeded
app.use('/api/subscriptions', subscriptionRoutes);

// Basic route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Book-A-Cut API is running!',
        version: '1.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                profile: 'GET /api/auth/profile'
            }
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is healthy',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Global error handler (Express 5 — MUST have 4 params)
// In Express 5, any error thrown inside an async route handler is automatically
// forwarded here. Without this, Express panics with "next is not a function".
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[Global Error]', err.message || err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});


const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Attach io to app for use in routes
app.set('io', io);

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-barber-room', (barberId) => {
        socket.join(`barber-${barberId}`);
        console.log(`Barber ${barberId} joined room`);
    });

    socket.on('join-user-room', (data) => {
        const userId = typeof data === 'object' ? data.userId : data;
        const role = typeof data === 'object' ? data.role : null;

        socket.join(`user-${userId}`);
        console.log(`User ${userId} joined personal room`);

        // Join role-specific rooms for broadcasting
        if (role === 'customer') {
            socket.join('customers');
            console.log(`User ${userId} joined customers room`);
        } else if (role === 'barber') {
            socket.join('barbers');
            console.log(`User ${userId} joined barbers room`);
        }
    });

    // ── ✅ NEW: Customer Live Location → forward to Barber ────
    // Customer emits this every 5 seconds when home service is active
    socket.on('customer-location-update', (data) => {
        const { bookingId, barberId, lat, lng, timestamp } = data;
        console.log(`[LiveLocation] Booking ${bookingId} → Barber ${barberId}: ${lat}, ${lng}`);
        // Forward customer location to the barber's room
        io.to(`barber-${barberId}`).emit('customer-location-update', {
            bookingId,
            lat,
            lng,
            timestamp
        });
    });


    socket.on('customer-location-stopped', (data) => {
        const { bookingId, barberId } = data;
        console.log(`[LiveLocation] Customer stopped sharing for booking ${bookingId}`);
        io.to(`barber-${barberId}`).emit('customer-location-stopped', {
            bookingId
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running: http://0.0.0.0:${PORT}`);
    console.log(`Local: http://localhost:${PORT}`);
});