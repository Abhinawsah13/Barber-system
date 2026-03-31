// models/Subscription.js
import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    plan: {
        type: String,
        enum: ['basic', 'premium'],
        required: true,
        default: 'basic'
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'cancelled'],
        default: 'active'
    },
    start_date: {
        type: Date,
        required: true,
        default: Date.now
    },
    end_date: {
        type: Date,
        required: true
    },
    auto_renew: {
        type: Boolean,
        default: false
    },
    price_paid: {
        type: Number,
        required: true
    },
    payment_method: {
        type: String,
        enum: ['wallet', 'khalti', 'esewa', 'fonepay', 'cash'],
        default: 'wallet'
    },
    transaction_id: {
        type: String
    },
    // Commission rate for this subscription
    commission_rate: {
        type: Number,
        required: true,
        default: 10 // 10% for basic, 5% for premium
    },
    // Features included
    features: {
        max_services: {
            type: Number,
            default: 10 // Basic: 10, Premium: unlimited (-1)
        },
        priority_listing: {
            type: Boolean,
            default: false // Premium gets priority in search
        },
        analytics_access: {
            type: Boolean,
            default: false // Premium gets detailed analytics
        },
        promotional_boost: {
            type: Boolean,
            default: false // Premium gets promotional badges
        }
    },
    // Renewal history
    renewal_count: {
        type: Number,
        default: 0
    },
    last_renewal_date: {
        type: Date
    }
}, {
    timestamps: true
});

// ✅ Index for quick lookup
subscriptionSchema.index({ user: 1, status: 1 });

// ✅ Check if subscription is expired
subscriptionSchema.methods.isExpired = function() {
    return this.end_date < new Date();
};

// ✅ Check if subscription is active
subscriptionSchema.methods.isActive = function() {
    return this.status === 'active' && !this.isExpired();
};

// ✅ Auto-update status if expired
subscriptionSchema.pre('save', async function() {
    if (this.isExpired() && this.status === 'active') {
        this.status = 'expired';
    }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
