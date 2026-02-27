import express from 'express';
import BarberProfile from '../models/BarberProfile.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// 🔥 NEW: Nearby available barbers (CUSTOMER SCREEN)
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng, type, service, date } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: 'lat, lng required' });
        }

        const filter = {
            isActive: { $ne: false },
            isApproved: { $ne: false },
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: 20000 // 20km
                }
            }
        };

        // Handle Service Type Filtering (home/salon)
        if (type === 'home') {
            filter['serviceModes.home'] = true;
            filter['availability.home.isActive'] = { $ne: false };
        } else if (type === 'salon') {
            filter['serviceModes.salon'] = true;
            filter['availability.salon.isActive'] = { $ne: false };
        } else {
            // Show barbers that have either mode enabled
            filter.$or = [
                { 'serviceModes.home': true },
                { 'serviceModes.salon': { $ne: false } }
            ];
        }

        // Handle Category/Service Filtering (e.g. "Haircut")
        if (service && service !== 'all') {
            filter.services = { $in: [new RegExp(service, 'i')] };
        }

        const barbers = await BarberProfile.find(filter)
            .populate('user', 'username phone profile_image rating')
            .limit(20);

        res.json({
            success: true,
            count: barbers.length,
            data: barbers
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 🔥 NEW: Search Barbers (CUSTOMER SCREEN)
router.get('/search', async (req, res) => {
    try {
        const { query, type, service } = req.query;

        const filter = {
            isActive: { $ne: false },
            isApproved: { $ne: false }
        };

        // Service Type Filter
        if (type === 'home') {
            filter['serviceModes.home'] = true;
            filter['availability.home.isActive'] = { $ne: false };
        } else if (type === 'salon') {
            filter['serviceModes.salon'] = true;
            filter['availability.salon.isActive'] = { $ne: false };
        } else {
            // Show barbers that have either mode enabled
            filter.$or = [
                { 'serviceModes.home': true },
                { 'serviceModes.salon': { $ne: false } }
            ];
        }

        // Handle Category Filtering
        if (service && service !== 'all') {
            filter.services = { $in: [new RegExp(service, 'i')] };
        }

        // Search Query (name or specialization)
        if (query) {
            // We need to find users whose username matches query
            const matchingUsers = await User.find({
                username: { $regex: query, $options: 'i' }
            }).select('_id');
            const userIds = matchingUsers.map(u => u._id);

            filter.$or = [
                { user: { $in: userIds } },
                { services: { $in: [new RegExp(query, 'i')] } }
            ];
        }

        const barbers = await BarberProfile.find(filter)
            .populate('user', 'username phone profile_image rating')
            .limit(20);

        res.json({
            success: true,
            count: barbers.length,
            data: barbers
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 🔥 NEW: Toggle online/offline (BARBER DASHBOARD)
router.put('/toggle-online', authenticateToken, requireRole('barber'), async (req, res) => {
    try {
        const { lat, lng, address } = req.body;
        const profile = await BarberProfile.findOne({ user: req.user._id });

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        profile.isOnline = req.body.isOnline;
        profile.location = {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
            address,
            city: req.body.city || 'Kathmandu'
        };

        await profile.save();

        res.json({ success: true, profile });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all barbers (public)
// Returns list of barbers with their profile details
router.get('/', async (req, res) => {
    try {
        const { type, service } = req.query;

        // Basic visibility filter
        const filter = {
            isActive: { $ne: false },
            isApproved: { $ne: false }
        };

        // Handle Service Type Filtering
        if (type === 'home') {
            filter['serviceModes.home'] = true;
            filter['availability.home.isActive'] = { $ne: false };
        } else if (type === 'salon') {
            filter['serviceModes.salon'] = { $ne: false };
            filter['availability.salon.isActive'] = { $ne: false };
        } else {
            // Show any barber that has at least one mode enabled
            filter.$or = [
                { 'serviceModes.home': true },
                { 'serviceModes.salon': { $ne: false } }
            ];
        }
        // If service is "all" or missing, we show all active/approved barbers

        // Handle Category Filtering
        if (service && service !== 'all') {
            filter.services = { $in: [new RegExp(service, 'i')] };
        }

        const barbers = await BarberProfile.find(filter)
            .populate('user', 'username phone profile_image')
            .sort({ 'rating.average': -1 })
            .lean();

        // Only return barbers where the user account still exists
        const validBarbers = barbers
            .filter(b => b.user)
            .map(b => ({
                ...b,
                // Merge: use BarberProfile.profileImage as primary (always reliable),
                // fall back to User.profile_image (may be large/truncated)
                _resolvedImage: b.profileImage || b.user?.profile_image || '',
            }));

        res.json({
            success: true,
            count: validBarbers.length,
            data: validBarbers
        });
    } catch (error) {
        console.error('Get all barbers error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get single barber by ID (public)
// The frontend may pass either the BarberProfile _id OR the User _id.
// We handle both cases so the UI always works correctly.
router.get('/:id', async (req, res) => {
    try {
        const idParam = req.params.id;

        // Try 1: treat the ID as the User's _id (the intended use case)
        let profile = await BarberProfile.findOne({ user: idParam })
            .populate('user', 'username email profile_image phone');

        // Try 2: if that didn't work, treat it as the BarberProfile's own _id
        // (happens when the list view returns profile._id and the frontend uses it directly)
        if (!profile) {
            profile = await BarberProfile.findById(idParam)
                .populate('user', 'username email profile_image phone');
        }

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Barber not found'
            });
        }

        // Fetch services using the barber's USER _id
        const barberId = profile.user?._id || profile.user;
        let services = await Service.find({ barber: barberId, is_active: true });

        // IMPORTANT: Only show services for modes that are currently enabled in the profile
        services = services.filter(s => {
            const mode = s.serviceType || 'salon';
            if (mode === 'both') {
                return profile.serviceModes?.salon || profile.serviceModes?.home;
            }
            return profile.serviceModes?.[mode] !== false;
        });

        res.json({
            success: true,
            data: {
                ...profile.toObject(),
                offeredServices: services
            }
        });
    } catch (error) {
        console.error('Get barber error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update/Create own profile (Barber only)
router.put('/profile', authenticateToken, requireRole('barber'), async (req, res) => {
    // Keep PUT for backward compatibility if needed, but the logic should be consistent
    return handleProfileUpdate(req, res);
});

// 🔥 NEW: Consistent PATCH endpoint for all profile fields
router.patch('/profile', authenticateToken, requireRole('barber'), async (req, res) => {
    return handleProfileUpdate(req, res);
});

async function handleProfileUpdate(req, res) {
    try {
        const userId = req.user._id;
        const updates = req.body;

        // 1. Validation
        if (updates.services && updates.services.length === 0) {
            return res.status(400).json({ success: false, message: 'Select at least one service' });
        }
        if (updates.serviceModes) {
            if (!updates.serviceModes.salon && !updates.serviceModes.home) {
                return res.status(400).json({ success: false, message: 'Select at least one service mode (Salon or Home)' });
            }
        }
        if (updates.availability) {
            const validateHours = (slot) => {
                if (slot && slot.openTime && slot.closeTime) {
                    return slot.openTime < slot.closeTime;
                }
                return true;
            };
            if (updates.availability.salon && !validateHours(updates.availability.salon)) {
                return res.status(400).json({ success: false, message: 'Salon open time must be before close time' });
            }
            if (updates.availability.home && !validateHours(updates.availability.home)) {
                return res.status(400).json({ success: false, message: 'Home service open time must be before close time' });
            }
        }

        // 2. Update User (Name and Profile Image)
        const userUpdates = {};
        if (updates.fullName) userUpdates.username = updates.fullName;
        if (updates.phone) userUpdates.phone = updates.phone;
        if (updates.profile_image) userUpdates.profile_image = updates.profile_image;

        if (Object.keys(userUpdates).length > 0) {
            await User.findByIdAndUpdate(userId, userUpdates);
        }

        // 3. Update BarberProfile
        let profile = await BarberProfile.findOne({ user: userId });
        if (!profile) {
            profile = new BarberProfile({ user: userId });
        }

        // Basic fields
        if (updates.services) profile.services = updates.services;
        if (updates.experience_years !== undefined) profile.experience_years = updates.experience_years;
        if (updates.bio !== undefined) profile.bio = updates.bio;
        if (updates.subscription_plan) profile.subscription_plan = updates.subscription_plan;
        if (updates.profile_image) profile.profileImage = updates.profile_image;
        if (updates.is_verified_barber !== undefined) profile.is_verified_barber = updates.is_verified_barber;

        // Pricing
        if (updates.pricing) {
            profile.pricing = {
                ...profile.pricing.toObject(),
                ...updates.pricing
            };
        }

        // Location
        if (updates.location) {
            profile.location = {
                ...profile.location.toObject(),
                ...updates.location
            };
        }

        // Service Modes
        if (updates.serviceModes) {
            profile.serviceModes = {
                salon: !!updates.serviceModes.salon,
                home: !!updates.serviceModes.home
            };
        }

        // Availability
        if (updates.availability) {
            if (updates.availability.salon) {
                profile.availability.salon = {
                    ...profile.availability.salon.toObject(),
                    ...updates.availability.salon
                };
            }
            if (updates.availability.home) {
                profile.availability.home = {
                    ...profile.availability.home.toObject(),
                    ...updates.availability.home
                };
            }
        }

        await profile.save();

        // ─── SYNC SERVICES DRAFTS (Optional legacy logic) ───
        if (updates.services && updates.services.length > 0) {
            const currentServices = await Service.find({ barber: userId });
            const newServices = [];
            for (const spec of updates.services) {
                const exists = currentServices.some(s => s.category === spec);
                if (!exists) {
                    newServices.push({
                        barber: userId,
                        category: spec,
                        name: spec,
                        price: 0,
                        duration_minutes: 30,
                        serviceType: 'both',
                        is_active: false,
                        description: `Auto-generated draft for ${spec}`
                    });
                }
            }
            if (newServices.length > 0) await Service.insertMany(newServices);
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                ...profile.toObject(),
                user: {
                    _id: userId,
                    username: updates.fullName || req.user.username,
                    profile_image: updates.profile_image || profile.profileImage
                }
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
}

// Toggle online status (Barber only)
router.put('/toggle-online', authenticateToken, requireRole('barber'), async (req, res) => {
    try {
        const userId = req.user._id;
        const { isOnline, lat, lng } = req.body;

        // Find or create barber profile
        let profile = await BarberProfile.findOne({ user: userId });

        if (!profile) {
            // Create a basic profile if it doesn't exist
            profile = new BarberProfile({
                user: userId,
                services: [],
                experience_years: 0,
                isOnline: isOnline || false,
                location: {
                    type: 'Point',
                    coordinates: [lng || 85.3240, lat || 27.7172]
                }
            });
        } else {
            profile.isOnline = isOnline;
            if (lat && lng) {
                profile.location = {
                    type: 'Point',
                    coordinates: [lng, lat]
                };
            }
        }

        await profile.save();

        res.json({
            success: true,
            message: `Barber is now ${isOnline ? 'online' : 'offline'}`,
            data: profile
        });

    } catch (error) {
        console.error('Toggle online error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update online status'
        });
    }
});

export default router;
