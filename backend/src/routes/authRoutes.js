// routes/authRoutes.js
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateToken, requireVerification, requireRole } from '../middleware/authMiddleware.js';
import crypto from 'crypto';
import BarberProfile from '../models/BarberProfile.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js';

import generateOtp from '../utils/generateOtp.js';

const router = express.Router();

// Generate JWT Token
const generateToken = (userId, userType) => {
    return jwt.sign(
        { userId, userType },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15d' }
    );
};



// Register route
router.post('/register', async (req, res, next) => {
    try {
        const { username, email, password, phone, profile_image, user_type = 'customer' } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check if user exists
        const existingEmail = await User.findOne({ email }).select('+verificationCode +verificationCodeExpiry');
        if (existingEmail) {
            // If the account exists but is NOT verified yet, resend a fresh OTP
            // so the user can complete registration without getting stuck
            if (!existingEmail.is_verified) {
                console.log(`[Register] Unverified account found for ${email} — resending OTP`);
                const newCode = generateOtp();
                existingEmail.verificationCode = newCode;
                existingEmail.verificationCodeExpiry = Date.now() + 10 * 60 * 1000;
                await existingEmail.save();

                try {
                    await sendVerificationEmail(email, newCode);
                    console.log(`OTP resent to ${email}: ${newCode}`);
                } catch (emailError) {
                    console.error('Email resend failed:', emailError);
                }

                return res.status(200).json({
                    success: true,
                    message: 'A new verification code has been sent to your email.',
                    data: {
                        email: existingEmail.email,
                        requiresVerification: true
                    }
                });
            }

            // Account exists AND is already verified — block registration
            console.log(`[Register Conflict] Verified email already exists: ${email}`);
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists. Please log in.'
            });
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            // If the username collision is with an unverified account using a different email, allow it through
            // (rare edge case — just block it cleanly)
            console.log(`[Register Conflict] Username already exists: ${username} (ID: ${existingUsername._id})`);
            return res.status(409).json({
                success: false,
                message: 'This username is already taken. Please choose another.'
            });
        }

        // Generate verification code (6-digit OTP)
        const verificationCode = generateOtp();

        // Create user
        const user = new User({
            username,
            email,
            phone,
            profile_image,
            user_type,
            password_hash: password, // Will be hashed by pre-save middleware
            verificationCode,
            verificationCodeExpiry: Date.now() + 10 * 60 * 1000, // 10 minutes
            is_verified: false // User must verify email
        });

        await user.save();

        // If user is a barber, initialize an full profile with defaults
        if (user_type === 'barber') {
            const barberProfile = new BarberProfile({
                user: user._id,
                services: [],
                experience_years: 0,
                bio: "Welcome to my barber profile!",
                location: { city: "Kathmandu", address: "" },
                service_type: "both",
                isActive: true,
                isApproved: true,
                is_verified_barber: true,
                serviceModes: {
                    salon: true,
                    home: true
                },
                availability: {
                    salon: { isActive: true, workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
                    home: { isActive: false, workingDays: ["Sat", "Sun"] }
                }
            });
            await barberProfile.save();
        }

        // Send verification email
        try {
            await sendVerificationEmail(email, verificationCode);
            console.log(`Verification code sent to ${email}: ${verificationCode}`);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Continue even if email fails - user can request resend
        }

        res.status(201).json({
            success: true,
            message: 'Verification code sent to your email. Please verify to continue.',
            data: {
                email: user.email,
                requiresVerification: true
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // 1. Check if email exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Email not registered. Please sign up first.'
            });
        }

        // 2. Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Incorrect password. Please try again.'
            });
        }

        // 3. Check if email is verified
        if (!user.is_verified) {
            return res.status(403).json({
                success: false,
                status: 'unverified',
                message: 'Your email is not verified. Please register again or verify your account.'
            });
        }

        // 4. Check if user is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact support.'
            });
        }

        // Generate token (7 days expiration for "remember me")
        const token = generateToken(user._id, user.user_type);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    user_type: user.user_type,
                    is_verified: user.is_verified,
                    is_active: user.is_active,
                    phone: user.phone,
                    profile_image: user.profile_image
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Verify email route
router.post('/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: 'Email and verification code are required'
            });
        }

        const user = await User.findOne({ email }).select('+verificationCode +verificationCodeExpiry');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.is_verified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified'
            });
        }

        if (!user.verificationCode || user.verificationCode !== code) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code'
            });
        }

        if (!user.verificationCodeExpiry || user.verificationCodeExpiry < Date.now()) {
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new one.'
            });
        }

        // Update user
        user.is_verified = true;
        user.verificationCode = null;
        user.verificationCodeExpiry = null;
        await user.save();

        // Generate JWT token so user can login immediately
        const token = generateToken(user._id, user.user_type);

        res.json({
            success: true,
            message: 'Email verified successfully!',
            data: {
                token,
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    user_type: user.user_type,
                    is_verified: user.is_verified
                }
            }
        });

    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.is_verified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified'
            });
        }

        // Generate new verification code
        const verificationCode = generateOtp();
        user.verificationCode = verificationCode;
        user.verificationCodeExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        // Send verification email
        try {
            await sendVerificationEmail(email, verificationCode);
            console.log(`New verification code for ${email}: ${verificationCode}`);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }

        res.json({
            success: true,
            message: 'Verification code sent successfully'
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Unified Resend OTP Route (for both verification and password reset)
router.post('/resend-otp', async (req, res) => {
    try {
        const { email, type } = req.body;

        // Validate input
        if (!email || !type) {
            return res.status(400).json({
                success: false,
                message: 'Email and type are required'
            });
        }

        if (type !== 'verify' && type !== 'reset') {
            return res.status(400).json({
                success: false,
                message: 'Type must be either "verify" or "reset"'
            });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate new OTP
        const code = generateOtp();

        // Handle verification OTP
        if (type === 'verify') {
            if (user.is_verified) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is already verified'
                });
            }

            user.verificationCode = code;
            user.verificationCodeExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
            await user.save();

            // Send verification email
            try {
                await sendVerificationEmail(email, code);
                console.log(`Verification OTP resent to ${email}: ${code}`);
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
            }

            return res.json({
                success: true,
                message: 'Verification code resent successfully'
            });
        }

        // Handle password reset OTP
        if (type === 'reset') {
            user.resetCode = code;
            user.resetCodeExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
            await user.save();

            // Send password reset email
            try {
                await sendPasswordResetEmail(email, code);
                console.log(`Password reset OTP resent to ${email}: ${code}`);
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
            }

            return res.json({
                success: true,
                message: 'Password reset code resent successfully'
            });
        }

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get profile (protected)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                user: req.user
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update profile (protected)
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { username, email, phone, profile_image, age, gender, address, dob } = req.body;
        const userId = req.user._id;

        // Find and update user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if new username/email already exists (if being changed)
        if (username && username !== user.username) {
            const existingUsername = await User.findOne({ username });
            if (existingUsername) {
                return res.status(409).json({
                    success: false,
                    message: 'Username already taken'
                });
            }
            user.username = username;
        }

        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(409).json({
                    success: false,
                    message: 'Email already registered'
                });
            }
            user.email = email;
            user.is_verified = false; // Require re-verification if email changes
        }

        if (phone !== undefined) user.phone = phone;
        if (profile_image !== undefined) user.profile_image = profile_image;
        if (age !== undefined) user.age = age;
        if (gender !== undefined) user.gender = gender;
        if (address !== undefined) user.address = address;
        if (dob !== undefined) user.dob = dob;

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Change password (protected)
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user._id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password_hash = newPassword; // Will be hashed by pre-save middleware
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Forgot Password Route - Send OTP
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate 6-digit OTP as STRING
        const resetCode = String(generateOtp());

        // Set reset code and expiry (10 minutes)
        user.resetCode = resetCode;
        user.resetCodeExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
        user.resetCodeVerified = false; // Reset verification status
        await user.save();

        // Send email with reset code
        try {
            await sendPasswordResetEmail(email, resetCode);
            console.log(`Password reset code sent to ${email}: ${resetCode}`);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Continue even if email fails - user can try again
        }

        res.json({
            success: true,
            message: 'Password reset code sent to your email.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// New Route: Verify Reset OTP (Step 2)
router.post('/verify-reset', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'Email and code are required' });
        }

        const user = await User.findOne({ email }).select('+resetCode +resetCodeExpiry');

        if (!user) {
            return res.status(404).json({ success: false, message: 'Email not found' });
        }

        // Compare OTP as STRING
        if (!user.resetCode || String(user.resetCode) !== String(code)) {
            return res.status(400).json({ success: false, message: 'Code incorrect' });
        }

        // Check expiry
        if (!user.resetCodeExpiry || user.resetCodeExpiry < Date.now()) {
            return res.status(400).json({ success: false, message: 'Code expired' });
        }

        // Mark as verified
        user.resetCodeVerified = true;
        await user.save();

        res.json({
            success: true,
            message: 'Code verified. You can now set a new password.'
        });
    } catch (error) {
        console.error('Verify reset code error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Reset Password Route - Final Reset (Step 3)
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        // Validation
        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Find user
        const user = await User.findOne({ email }).select('+resetCodeVerified');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if the code was already verified
        if (!user.resetCodeVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify the reset code first.'
            });
        }

        // Update password
        user.password_hash = newPassword; // Will be hashed by pre-save middleware
        user.resetCode = null;
        user.resetCodeExpiry = null;
        user.resetCodeVerified = false;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Delete account route (protected)
router.delete('/delete-account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;

        // Find and delete user
        const user = await User.findByIdAndDelete(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Also delete barber profile if exists
        if (user.user_type === 'barber') {
            await BarberProfile.findOneAndDelete({ user: userId });
        }

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Auth API is working',
        timestamp: new Date().toISOString()
    });
});

export default router;