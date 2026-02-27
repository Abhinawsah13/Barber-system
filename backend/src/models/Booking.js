import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    barber: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true
    },
    date: {
        type: Date,
        required: true // The date of the appointment
    },
    time_slot: {
        type: String, // e.g., "14:30"
        required: true
    },
    service_type: {
        type: String,
        // 'both' = customer wants barber to offer both options
        enum: ["salon", "home", "both"],
        default: "salon"
    },
    // Address text for home service visits
    customer_address: {
        type: String,
        default: ''
    },
    // GeoJSON point — optional, only set when customer shares location
    customer_location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [85.3240, 27.7172], // Kathmandu default
        },
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "completed", "numb", "cancelled_by_customer", "cancelled_by_barber"],
        default: "pending"
    },
    total_price: {
        type: Number,
        required: true
    },
    payment_status: {
        type: String,
        enum: ["pending", "paid", "refunded"],
        default: "pending"
    },
    payment_method: {
        type: String,
        enum: ["cash", "wallet", "esewa", "khalti", "fonepay"],
        default: "cash"
    },
    transaction_id: {
        type: String // For digital payments
    },
    notes: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
