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
        enum: ["pending", "confirmed", "completed", "cancelled_by_customer", "cancelled_by_barber"],
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
    },
    // Location snapshot of the barber/shop
    barber_location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
        },
    },
    travel_charge: {
        type: Number,
        default: 0
    },
    distance_km: {
        type: Number,
        default: 0
    },
    // Set to true once customer submits a review — avoids extra API lookup
    reviewGiven: {
        type: Boolean,
        default: false,
    },
    // ✅ Cancellation & Refund tracking
    cancelled_at: {
        type: Date,
        default: null
    },
    refund_amount: {
        type: Number,
        default: 0
    },
    refund_percentage: {
        type: Number,
        default: 0
    },
    cancellation_reason: {
        type: String,
        default: ''
    },
    // ✅ Barber journey tracking (home service)
    barber_on_the_way: {
        type: Boolean,
        default: false
    },
    barber_started_journey_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// ✅ UNIQUE INDEX WITH PARTIAL FILTER
// This ensures no two active bookings (pending/confirmed/completed) can exist for same barber/date/time.
// Cancelled bookings are ignored by this index, allowing the slot to be reused.
bookingSchema.index(
    { barber: 1, date: 1, time_slot: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: { $in: ["pending", "confirmed", "completed"] }  // cancelled bookings allow slot reuse
        }
    }
);

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
