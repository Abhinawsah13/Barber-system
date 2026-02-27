import Review from '../models/Review.js';
import BarberProfile from '../models/BarberProfile.js';

// recalculate and save barber's average rating after any review change
export const recalculateBarberRating = async (barberId) => {
    const [result] = await Review.aggregate([
        {
            $match: {
                barber: new (await import('mongoose')).default.Types.ObjectId(barberId),
                isDeleted: { $ne: true },
            },
        },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$stars' },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    const averageRating = result ? parseFloat(result.averageRating.toFixed(2)) : 0;
    const totalReviews = result ? result.totalReviews : 0;

    await BarberProfile.findOneAndUpdate(
        { user: barberId },
        { $set: { 'rating.average': averageRating, 'rating.count': totalReviews } }
    );

    return { averageRating, totalReviews };
};
