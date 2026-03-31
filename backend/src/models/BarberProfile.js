import mongoose from "mongoose";

const VALID_SERVICES = [
    'Haircut', 'Beard Trim', 'Hair Color', 'Facial', 'Kids Cut', 'Shave', 'Others'
];

// Helper: normalize to Title Case (e.g. "beard" → "Beard", "kids cut" → "Kids Cut")
const toTitleCase = (str) =>
    str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

const barberProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    services: {
        type: [String],
        default: []
    },
    experience_years: { type: Number, default: 0 },
    bio: { type: String, default: "" },
    service_type: {
        type: String,
        enum: ['salon', 'home', 'both'],
        default: 'salon'
    },

    // List of Service document IDs
    offeredServices: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],

    // Profile image (synced from User)
    profileImage: { type: String, default: "" },

    // Online status + geo (for nearby search)
    isOnline: { type: Boolean, default: false },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: [Number], // [lng, lat]
        address: String,      // Shop Name / Main Address
        city: String,
        fullAddress: String,  // Detailed address for salon
        serviceArea: String   // Coverage area for home visits
    },

    serviceModes: {
        salon: { type: Boolean, default: true },
        home: { type: Boolean, default: false }
    },

    // Weekly availability schedule (Strictly separated)
    availability: {
        salon: {
            isActive: { type: Boolean, default: true },
            workingDays: { type: [String], default: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
            openTime: { type: String, default: "09:00" },
            closeTime: { type: String, default: "19:00" }
        },
        home: {
            isActive: { type: Boolean, default: false },
            workingDays: { type: [String], default: ["Sat", "Sun"] },
            openTime: { type: String, default: "10:00" },
            closeTime: { type: String, default: "18:00" }
        }
    },

    rating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    earnings: { balance: { type: Number, default: 0 }, total_earned: { type: Number, default: 0 } },
    pricing: {
        salonValue: { type: Number, default: 0 },
        homeValue: { type: Number, default: 0 },
        homeSurcharge: { type: Number, default: 0 }
    },
    subscription_plan: {
        type: String,
        enum: ['basic', 'premium', 'free'],
        default: 'basic'
    },
    is_verified_barber: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: true }
}, {
    timestamps: true
});

// Normalize service entries to Title Case before validation
// so 'haircut' → 'Haircut', etc.
barberProfileSchema.pre('validate', function () {
    if (this.services && Array.isArray(this.services)) {
        this.services = this.services
            .filter(s => typeof s === 'string')
            .map(toTitleCase);
    }
});

// Keep legacy service_type in sync with boolean serviceModes
barberProfileSchema.pre('save', async function () {
    if (this.serviceModes) {
        if (this.serviceModes.salon && this.serviceModes.home) {
            this.service_type = 'both';
        } else if (this.serviceModes.home) {
            this.service_type = 'home';
        } else {
            this.service_type = 'salon';
        }
    }
});

// Geo index for $near queries
barberProfileSchema.index({ location: '2dsphere' });

// Optimized $in filter for service-based barber search
barberProfileSchema.index({ services: 1 });

// Compound index for common listing query
barberProfileSchema.index({ isOnline: 1, is_verified_barber: 1, 'rating.average': -1 });

const BarberProfile = mongoose.model("BarberProfile", barberProfileSchema);
export default BarberProfile;
