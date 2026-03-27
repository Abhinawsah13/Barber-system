// controllers/barber.controller.js
import BarberProfile from '../models/BarberProfile.js';
import User from '../models/User.js';
import Service from '../models/Service.js';

export const VALID_SERVICES = [
    'Haircut', 'Beard Trim', 'Hair Color', 'Facial', 'Kids Cut', 'Shave', 'Others'
];

// ─── POST/PUT /barbers/profile ────────────────────────────────────────────────
export const createOrUpdateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            bio, experience_years, services = [],
            availability, service_type, profile_image, location,
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
            ...(location && {
                location: {
                    ...(location.address !== undefined && { address: location.address }),
                    ...(location.city !== undefined && { city: location.city }),
                    ...(location.fullAddress !== undefined && { fullAddress: location.fullAddress }),
                    ...(location.serviceArea !== undefined && { serviceArea: location.serviceArea }),
                }
            }),
        };

        let profile = await BarberProfile.findOneAndUpdate(
            { user: userId },
            { $set: profileData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).populate('user', 'username email profile_image phone');

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

// ─── GET /barbers ─────────────────────────────────────────────────────────────
export const getBarbers = async (req, res) => {
    try {
        const {
            services,
            type,
            service_type,
            isOnline,
            verified,
            city,
            search,
            page = 1,
            limit = 20,
        } = req.query;

        // ── Build DB filter — NO city here, done in JS below ─────────────────
        const filter = {};

        // Service filter
        if (services && services.toLowerCase() !== 'all') {
            const tags = services.split(',').map(t => t.trim());
            filter.services = { $in: tags.map(t => new RegExp(t, 'i')) };
        }

        // Service type filter
        const activeType = type || service_type;
        if (activeType === 'home') {
            filter['serviceModes.home'] = true;
        } else if (activeType === 'salon') {
            filter['serviceModes.salon'] = true;
        } else {
            filter.$or = [
                { 'serviceModes.home': true },
                { 'serviceModes.salon': true }
            ];
        }

        if (isOnline !== undefined) filter.isOnline = isOnline === 'true';
        if (verified !== undefined) filter.is_verified_barber = verified === 'true';

        // ── Fetch all from DB ─────────────────────────────────────────────────
        const allBarbers = await BarberProfile.find(filter)
            .populate('user', 'username profile_image phone')
            .sort({ 'rating.average': -1 })
            .lean();

        // Remove deleted users
        let validBarbers = allBarbers.filter(b => b.user);

        // ✅ City/location filter in JavaScript — guaranteed to work
        const searchTerm = (city || search || '').trim();
        if (searchTerm) {
            const regex = new RegExp(searchTerm, 'i');
            validBarbers = validBarbers.filter(b => {
                const loc = b.location || {};
                return (
                    regex.test(loc.city || '') ||
                    regex.test(loc.address || '') ||
                    regex.test(loc.serviceArea || '') ||
                    regex.test(loc.fullAddress || '') ||
                    regex.test(b.user?.username || '') ||
                    (b.services || []).some(s => regex.test(s))
                );
            });
        }

        console.log(`[getBarbers] search="${searchTerm || 'none'}" → DB:${allBarbers.length} → Filtered:${validBarbers.length}`);

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);
        const paginated = validBarbers.slice(skip, skip + Number(limit));

        return res.json({
            success: true,
            count: paginated.length,
            total: validBarbers.length,
            page: Number(page),
            data: paginated,
        });
    } catch (error) {
        console.error('[getBarbers]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /barbers/:id ─────────────────────────────────────────────────────────
export const getBarberById = async (req, res) => {
    try {
        const { id } = req.params;

        const [profile, services] = await Promise.all([
            BarberProfile.findOne({ user: id })
                .populate('user', 'username email profile_image phone'),
            Service.find({ barber: id, is_active: true }).lean(),
        ]);

        if (!profile) {
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

// ─── GET /barbers/services-list ───────────────────────────────────────────────
export const getServiceCategories = async (_req, res) => {
    return res.json({ success: true, data: VALID_SERVICES });
};