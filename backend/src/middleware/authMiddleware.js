// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Middleware to verify JWT token
 */
export const authenticateToken = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
                code: 'NO_TOKEN'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user (exclude sensitive fields)
        const user = await User.findById(decoded.userId)
            .select('-password_hash -verification_token -__v');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact support.',
                code: 'ACCOUNT_DEACTIVATED'
            });
        }

        // Attach user to request
        req.user = user;
        req.userId = decoded.userId;
        req.userType = decoded.userType;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }

        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};

/**
 * Middleware to check if email is verified
 */
export const requireVerification = (req, res, next) => {
    if (!req.user.is_verified) {
        return res.status(403).json({
            success: false,
            message: 'Please verify your email to access this resource',
            code: 'EMAIL_NOT_VERIFIED',
            requires_verification: true
        });
    }
    next();
};

/**
 * Middleware to check user role
 */
export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!roles.includes(req.user.user_type)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${roles.join(', ')}`,
                code: 'INSUFFICIENT_PERMISSIONS',
                required_roles: roles,
                current_role: req.user.user_type
            });
        }

        next();
    };
};

/**
 * Middleware to check if user is admin
 */
export const isAdmin = (req, res, next) => {
    requireRole('admin')(req, res, next);
};

/**
 * Middleware to check if user is barber
 */
export const isBarber = (req, res, next) => {
    requireRole('barber')(req, res, next);
};

/**
 * Middleware to check if user is customer
 */
export const isCustomer = (req, res, next) => {
    requireRole('customer')(req, res, next);
};