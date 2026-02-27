// controllers/barber.controller.js
import BarberProfile from '../models/BarberProfile.js';
import User from '../models/User.js';
import Service from '../models/Service.js';

// ─── Allowed service categories ─────────────────────────────────────────────
export const VALID_SERVICES = [
    'Haircut', 'Beard Trim', 'Hair Color', 'Facial', 'Kids Cut', 'Shave', 'Others'
];

// ─── POST /barbers/profile — Create or upsert barber profile ─────────────────
export const createOrUpdateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            bio,
            experience_years,
            services = [],
            availability,
            service_type,
            profile_image,
            location,
        } = req.body;

        const profileData = {
            ...(bio !== undefined && { bio: bio.trim() }),
            ...(experience_years !== undefined && { experience_years: Number(experience_years) }),
            ...(services && services.length > 0 && { services }),
            ...(availability && { availability }),
            ...(service_type && { service_type }),
            ...(req.body.pricing && { pricing: req.body.pricing }),
            ...(req.body.serviceModes && {
                serviceModes: {
                    salon: !!req.body.serviceModes.salon,
                    home: !!req.body.serviceModes.home
                }
            }),
        };

        let profile = await BarberProfile.findOneAndUpdate(
            { user: userId },
            { $set: profileData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).populate('user', 'username email profile_image phone');

        // Update profile image on User document if provided
        if (profile_image) {
            await User.findByIdAndUpdate(userId, { profile_image });
        }

        return res.json({
            success: true,
            message: 'Barber profile updated successfully',
            data: profile,
        });
    } catch (error) {
        console.error('[createOrUpdateProfile]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /barbers — List barbers with optional specialization filter ──────────
export const getBarbers = async (req, res) => {
    try {
        const {
            services,         // comma separated list
            type,             // 'salon', 'home', or 'all'
            service_type,     // legacy support
            isOnline,
            verified,
            page = 1,
            limit = 20,
        } = req.query;

        const filter = {};

        // Services filter — optimized with $in and index
        if (services) {
            const tags = services.split(',').map(t => t.trim());
            filter.services = { $in: tags.map(t => new RegExp(t, 'i')) };
        }

        // Service Type Filter (Home/Salon/All)
        // We prefer checking the serviceModes booleans
        const activeType = type || service_type;

        if (activeType === 'home') {
            filter['serviceModes.home'] = true;
        } else if (activeType === 'salon') {
            filter['serviceModes.salon'] = true;
        } else {
            // "All" or default: show if either mode is enabled
            filter.$or = [
                { 'serviceModes.home': true },
                { 'serviceModes.salon': { $ne: false } }
            ];
        }

        if (isOnline !== undefined) filter.isOnline = isOnline === 'true';
        if (verified !== undefined) filter.is_verified_barber = verified === 'true';

        const skip = (Number(page) - 1) * Number(limit);

        const [barbers, total] = await Promise.all([
            BarberProfile.find(filter)
                .populate('user', 'username profile_image phone')
                .sort({ 'rating.average': -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            BarberProfile.countDocuments(filter),
        ]);

        // Filter out profiles with deleted user accounts
        const validBarbers = barbers.filter(b => b.user);

        return res.json({
            success: true,
            count: validBarbers.length,
            total,
            page: Number(page),
            data: validBarbers,
        });
    } catch (error) {
        console.error('[getBarbers]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /barbers/:id — Single barber profile with services ──────────────────
export const getBarberById = async (req, res) => {
    try {
        const { id } = req.params;

        const [profile, services] = await Promise.all([
            BarberProfile.findOne({ user: id })
                .populate('user', 'username email profile_image phone'),
            Service.find({ barber: id, is_active: true }).lean(),
        ]);

        if (!profile) {
            // Check if user exists but hasn't set up profile yet
            const user = await User.findById(id);
            if (user?.user_type === 'barber') {
                return res.status(404).json({
                    success: false,
                    message: 'Barber profile not set up yet',
                    code: 'PROFILE_NOT_FOUND',
                });
            }
            return res.status(404).json({ success: false, message: 'Barber not found' });
        }

        return res.json({
            success: true,
            data: { ...profile.toObject(), offeredServices: services },
        });
    } catch (error) {
        console.error('[getBarberById]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /barbers/services — Return valid service category list ─────────────────────
export const getServiceCategories = async (_req, res) => {
    return res.json({ success: true, data: VALID_SERVICES });
};
