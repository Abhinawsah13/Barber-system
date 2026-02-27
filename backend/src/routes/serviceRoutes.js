import express from 'express';
import Service from '../models/Service.js';
import BarberProfile from '../models/BarberProfile.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all services (can modify to filter by category)
router.get('/', async (req, res) => {
    try {
        const { category, barberId, serviceType } = req.query;
        let query = { is_active: true };

        if (category) {
            query.category = category;
        }

        if (barberId) {
            query.barber = barberId;
        }

        if (serviceType) {
            query.serviceType = serviceType;
        }

        const services = await Service.find(query).populate('barber', 'username');

        res.json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Create a service (Barber only)
router.post('/', authenticateToken, requireRole('barber'), async (req, res) => {
    try {
        const { name, description, price, duration_minutes, category, image, serviceType } = req.body;
        const userId = req.user._id;

        // Force mode selection and validate against profile
        const targetType = serviceType || 'salon';
        const profile = await BarberProfile.findOne({ user: userId });

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Barber profile not found' });
        }

        if (!profile.serviceModes[targetType]?.enabled) {
            return res.status(400).json({
                success: false,
                message: `You cannot create a ${targetType} service because this mode is disabled in your profile settings.`
            });
        }

        const service = new Service({
            barber: userId,
            name,
            description,
            price,
            duration_minutes,
            category,
            image,
            serviceType: serviceType || 'salon',
            is_active: true
        });

        await service.save();

        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            data: service
        });

    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update a service (Barber only - and must own the service)
router.put('/:id', authenticateToken, requireRole('barber'), async (req, res) => {
    try {
        const serviceId = req.params.id;
        const userId = req.user._id;
        const updateData = req.body;

        const service = await Service.findById(serviceId);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Verify ownership
        if (service.barber.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update this service'
            });
        }

        // Update fields
        Object.assign(service, updateData);
        await service.save();

        res.json({
            success: true,
            message: 'Service updated successfully',
            data: service
        });

    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Delete a service (Barber only - must own)
router.delete('/:id', authenticateToken, requireRole('barber'), async (req, res) => {
    try {
        const serviceId = req.params.id;
        const userId = req.user._id;

        const service = await Service.findById(serviceId);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Verify ownership
        if (service.barber.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this service'
            });
        }

        // Hard delete or Soft delete? Soft delete is safer, but strictly user asked for delete. 
        // Let's do hard delete for simplicity or just set is_active=false. 
        // I'll do hard delete as per standard CRUD, but setting is_active=false is better for history.
        // Let's do hard delete to keep it simple and clean.
        await Service.findByIdAndDelete(serviceId);

        res.json({
            success: true,
            message: 'Service deleted successfully'
        });

    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

export default router;
