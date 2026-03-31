import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
    basic_commission: {
        type: Number,
        default: 10
    },
    premium_commission: {
        type: Number,
        default: 5
    },
    premium_subscription_price: {
        type: Number,
        default: 999
    },
    // Refund Tiers (as percentages 0-100)
    refund_2h_more: {
        type: Number,
        default: 100
    },
    refund_1h_to_2h: {
        type: Number,
        default: 70
    },
    refund_less_than_1h: {
        type: Number,
        default: 50
    },
    refund_barber_on_way: {
        type: Number,
        default: 30
    }
}, {
    timestamps: true
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

export default SystemSettings;
