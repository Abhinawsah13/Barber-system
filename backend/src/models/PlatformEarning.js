import mongoose from "mongoose";

const platformEarningSchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    commission_rate: {
        type: Number,
        required: true
    },
    barber: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

const PlatformEarning = mongoose.model("PlatformEarning", platformEarningSchema);
export default PlatformEarning;
