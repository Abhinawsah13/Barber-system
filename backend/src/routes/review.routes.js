import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {
    createReview,
    updateReview,
    deleteReview,
    getBarberReviews,
    getBarberRating,
    getReviewByBooking,
} from '../controllers/review.controller.js';

const router = express.Router();

// public — anyone can read barber reviews and ratings
router.get('/barbers/:id/reviews', getBarberReviews);
router.get('/barbers/:id/rating', getBarberRating);

// needs login — check if a booking already has a review
router.get('/booking/:bookingId', authenticateToken, getReviewByBooking);

// customers only
router.post('/', authenticateToken, requireRole('customer'), createReview);
router.put('/:id', authenticateToken, requireRole('customer'), updateReview);
router.delete('/:id', authenticateToken, deleteReview);

export default router;
