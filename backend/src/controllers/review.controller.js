import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import BarberProfile from '../models/BarberProfile.js';
import { recalculateBarberRating } from '../services/rating.service.js';

export const createReview = async (req, res) => {
    try {
        const { bookingId, barberId, stars, comment, categoryRatings, tags, anonymous } = req.body;
        const customerId = req.user._id;

        // extra safety — route middleware already checks role, but just in case
        if (req.user.user_type !== 'customer') {
            return res.status(403).json({ success: false, message: 'Only customers can submit reviews' });
        }

        if (!bookingId || !barberId || !stars) {
            return res.status(400).json({ success: false, message: 'bookingId, barberId, and stars are required' });
        }

        // validate star value
        const starsNum = Number(stars);
        if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
            return res.status(400).json({ success: false, message: 'Stars must be a whole number between 1 and 5' });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // make sure this booking belongs to the logged-in customer
        if (booking.customer.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: 'You can only review your own bookings' });
        }

        // only allow review after service is done
        if (booking.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Booking must be completed before leaving a review' });
        }

        // barberId on request must match the booking
        if (booking.barber.toString() !== barberId.toString()) {
            return res.status(400).json({ success: false, message: 'Barber ID does not match this booking' });
        }

        // prevent duplicate review
        const existingReview = await Review.findOne({ booking: bookingId });
        if (existingReview) {
            return res.status(409).json({ success: false, message: 'You have already reviewed this booking' });
        }

        // clamp each category value to 0–5
        const catRatings = {
            skill: Math.min(5, Math.max(0, Number(categoryRatings?.skill) || 0)),
            punctuality: Math.min(5, Math.max(0, Number(categoryRatings?.punctuality) || 0)),
            cleanliness: Math.min(5, Math.max(0, Number(categoryRatings?.cleanliness) || 0)),
            value: Math.min(5, Math.max(0, Number(categoryRatings?.value) || 0)),
        };

        // sanitize tags — strings only, max 20
        const cleanTags = Array.isArray(tags)
            ? tags.filter(t => typeof t === 'string' && t.trim()).slice(0, 20)
            : [];

        const newReview = await Review.create({
            booking: bookingId,
            customer: customerId,
            barber: barberId,
            stars: starsNum,
            comment: comment ? comment.trim() : '',
            categoryRatings: catRatings,
            tags: cleanTags,
            anonymous: anonymous === true,
        });

        // update barber's average rating
        await recalculateBarberRating(barberId);

        const reviewWithDetails = await Review.findById(newReview._id)
            .populate('customer', 'username profile_image')
            .populate('barber', 'username');

        return res.status(201).json({ success: true, message: 'Review submitted successfully', data: reviewWithDetails });

    } catch (error) {
        // catch duplicate key from mongo unique index
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'You have already reviewed this booking' });
        }
        console.error('Error in createReview:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const updateReview = async (req, res) => {
    try {
        const reviewId = req.params.id;
        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        // only the author can edit
        if (review.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this review' });
        }

        const { stars, comment } = req.body;

        if (stars !== undefined) {
            const starsNum = Number(stars);
            if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
                return res.status(400).json({ success: false, message: 'Stars must be between 1 and 5' });
            }
            review.stars = starsNum;
        }

        if (comment !== undefined) {
            review.comment = comment.trim();
        }

        await review.save();

        // recalculate after edit
        await recalculateBarberRating(review.barber);

        return res.json({ success: true, message: 'Review updated', data: review });

    } catch (error) {
        console.error('Error in updateReview:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const deleteReview = async (req, res) => {
    try {
        const reviewId = req.params.id;
        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        const isOwner = review.customer.toString() === req.user._id.toString();
        const isAdmin = req.user.user_type === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // soft delete keeps history intact for rating calculations
        await Review.findByIdAndUpdate(reviewId, { isDeleted: true });

        // recalculate after removal
        await recalculateBarberRating(review.barber);

        return res.json({ success: true, message: 'Review deleted' });

    } catch (error) {
        console.error('Error in deleteReview:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const getBarberReviews = async (req, res) => {
    try {
        const barberId = req.params.id;

        // bad ObjectId would cause a mongo CastError
        if (!mongoose.isValidObjectId(barberId)) {
            return res.json({ success: true, count: 0, total: 0, page: 1, totalPages: 0, data: [] });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const safePage = page < 1 ? 1 : page;
        const safeLimit = limit > 50 ? 50 : limit;
        const skip = (safePage - 1) * safeLimit;

        // don't use .lean() here — it breaks .populate()
        const reviews = await Review.find({ barber: barberId })
            .populate('customer', 'username profile_image')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit);

        const total = await Review.countDocuments({ barber: barberId });

        return res.json({
            success: true,
            count: reviews.length,
            total,
            page: safePage,
            totalPages: Math.ceil(total / safeLimit),
            data: reviews,
        });

    } catch (error) {
        console.error('Error in getBarberReviews:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const getBarberRating = async (req, res) => {
    try {
        const barberId = req.params.id;

        if (!mongoose.isValidObjectId(barberId)) {
            return res.json({ success: true, data: { averageRating: 0, totalReviews: 0, starBreakdown: [] } });
        }

        // new barbers won't have a profile yet — return zeros instead of 404
        const barberProfile = await BarberProfile.findOne({ user: barberId })
            .select('rating')
            .lean();

        // star distribution for the breakdown chart
        const distributionResult = await Review.aggregate([
            { $match: { barber: new mongoose.Types.ObjectId(barberId) } },
            { $group: { _id: '$stars', count: { $sum: 1 } } },
            { $sort: { _id: -1 } },
        ]);

        const starBreakdown = [];
        for (let star = 5; star >= 1; star--) {
            const found = distributionResult.find(d => d._id === star);
            starBreakdown.push({ stars: star, count: found ? found.count : 0 });
        }

        return res.json({
            success: true,
            data: {
                averageRating: barberProfile?.rating?.average ?? 0,
                totalReviews: barberProfile?.rating?.count ?? 0,
                starBreakdown,
            },
        });

    } catch (error) {
        console.error('Error in getBarberRating:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const getReviewByBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;

        const review = await Review.findOne({ booking: bookingId })
            .select('_id stars comment createdAt')
            .lean();

        // return exists: false instead of 404 so frontend doesn't need error handling
        if (!review) {
            return res.json({ success: true, exists: false, data: null });
        }

        return res.json({ success: true, exists: true, data: review });

    } catch (error) {
        console.error('Error in getReviewByBooking:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
    }
};
