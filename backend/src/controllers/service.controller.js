// controllers/service.controller.js
import Service from '../models/Service.js';

// ─── Validation Helper ────────────────────────────────────────────────────────
const validateServiceInput = ({ name, price, duration_minutes }) => {
    const errors = [];
    if (!name || name.trim().length < 2) errors.push('Service name must be at least 2 characters');
    if (price === undefined || isNaN(price) || Number(price) < 0) errors.push('Price must be a non-negative number');
    if (!duration_minutes || isNaN(duration_minutes) || Number(duration_minutes) < 5)
        errors.push('Duration must be at least 5 minutes');
    return errors;
};

// ─── POST /services (admin or barber) ────────────────────────────────────────
export const createService = async (req, res) => {
    try {
        const { name, description, price, duration_minutes, category, image, serviceType } = req.body;

        const errors = validateServiceInput({ name, price, duration_minutes });
        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: 'Validation failed', errors });
        }

        const service = await Service.create({
            barber: req.user._id, // linked barber/admin user
            name: name.trim(),
            description: description?.trim() || '',
            price: Number(price),
            duration_minutes: Number(duration_minutes),
            category: category || 'Other',
            image: image || '',
            serviceType: serviceType || 'both',
            is_active: true,
        });

        return res.status(201).json({
            success: true,
            message: 'Service created successfully',
            data: service,
        });
    } catch (error) {
        console.error('[createService]', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

// ─── GET /services (public, supports ?category=&barberId=&search=) ────────────
export const getServices = async (req, res) => {
    try {
        const { category, barberId, search, page = 1, limit = 20 } = req.query;
        const filter = { is_active: true };

        if (category) filter.category = category;
        if (barberId) filter.barber = barberId;
        if (search) filter.name = { $regex: search.trim(), $options: 'i' };

        const skip = (Number(page) - 1) * Number(limit);

        const [services, total] = await Promise.all([
            Service.find(filter)
                .populate('barber', 'username profile_image')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Service.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            count: services.length,
            total,
            page: Number(page),
            data: services,
        });
    } catch (error) {
        console.error('[getServices]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── GET /services/:id (public) ───────────────────────────────────────────────
export const getServiceById = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id)
            .populate('barber', 'username profile_image');

        if (!service || !service.is_active) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        return res.json({ success: true, data: service });
    } catch (error) {
        console.error('[getServiceById]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── PUT /services/:id (barber owner or admin) ───────────────────────────────
export const updateService = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

        // Ownership guard (admin bypasses)
        if (req.user.user_type !== 'admin' && service.barber.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this service' });
        }

        const { name, description, price, duration_minutes, category, image, is_active } = req.body;

        // Validate only the provided numeric fields
        if (price !== undefined && (isNaN(price) || Number(price) < 0))
            return res.status(400).json({ success: false, message: 'Price must be a non-negative number' });
        if (duration_minutes !== undefined && (isNaN(duration_minutes) || Number(duration_minutes) < 5))
            return res.status(400).json({ success: false, message: 'Duration must be at least 5 minutes' });

        const allowedUpdates = { name, description, price, duration_minutes, category, image, is_active };
        Object.entries(allowedUpdates).forEach(([key, val]) => {
            if (val !== undefined) service[key] = val;
        });

        await service.save();

        return res.json({ success: true, message: 'Service updated successfully', data: service });
    } catch (error) {
        console.error('[updateService]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ─── DELETE /services/:id (barber owner or admin) ────────────────────────────
export const deleteService = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

        // Ownership guard
        if (req.user.user_type !== 'admin' && service.barber.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this service' });
        }

        // Soft-delete: preserve booking history references
        service.is_active = false;
        await service.save();

        return res.json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
        console.error('[deleteService]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
