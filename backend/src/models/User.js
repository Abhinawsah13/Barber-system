// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password_hash: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    user_type: {
        type: String,
        enum: {
            values: ["customer", "barber", "admin"],
            message: '{VALUE} is not a valid user type'
        },
        required: true,
        default: "customer"
    },
    is_verified: {
        type: Boolean,
        default: false
    },
    verificationCode: {
        type: String,
        select: false // Don't return this field by default
    },
    verificationCodeExpiry: {
        type: Date,
        select: false
    },
    resetCode: {
        type: String,
        select: false
    },
    resetCodeExpiry: {
        type: Date,
        select: false
    },
    resetCodeVerified: {
        type: Boolean,
        default: false,
        select: false
    },
    is_active: {
        type: Boolean,
        default: true
    },
    phone: {
        type: String,
        default: ''
    },
    profile_image: {
        type: String,
        default: ''
    },
    age: {
        type: Number,
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other', 'Prefer not to say', '']
    },
    address: {
        type: String,
        default: ''
    },
    dob: {
        type: Date,
    },
    wallet_balance: {
        type: Number,
        default: 0.00
    },
    loyalty_points: {
        type: Number,
        default: 0
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.password_hash;
            delete ret.verificationCode;
            delete ret.__v;
            return ret;
        }
    }
});

// Hash password before saving
// Hash password before saving - SIMPLIFIED VERSION
userSchema.pre("save", async function () {
    // Only hash the password if it's modified (or new)
    if (!this.isModified("password_hash")) {
        return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
});

// Update updated_at timestamp
userSchema.pre("save", async function () {
    this.updated_at = Date.now();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password_hash);
};

// Virtual for full name
userSchema.virtual('full_name').get(function () {
    return this.username;
});

const User = mongoose.model("User", userSchema);
export default User;