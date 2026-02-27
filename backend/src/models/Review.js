import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
            unique: true, // one review per booking
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        barber: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        stars: {
            type: Number,
            required: true,
            min: [1, 'Minimum rating is 1'],
            max: [5, 'Maximum rating is 5'],
            validate: {
                validator: Number.isInteger,
                message: 'Stars must be a whole number between 1 and 5',
            },
        },
        comment: {
            type: String,
            default: '',
            trim: true,
            maxlength: [500, 'Comment cannot exceed 500 characters'],
        },
        // per-category ratings (skill, punctuality, cleanliness, value)
        categoryRatings: {
            skill: { type: Number, min: 0, max: 5, default: 0 },
            punctuality: { type: Number, min: 0, max: 5, default: 0 },
            cleanliness: { type: Number, min: 0, max: 5, default: 0 },
            value: { type: Number, min: 0, max: 5, default: 0 },
        },
        // quick tags selected by customer e.g. "Great Fade ✂️"
        tags: {
            type: [String],
            default: [],
        },
        // hide customer name on public display
        anonymous: {
            type: Boolean,
            default: false,
        },
        isDeleted: {
            type: Boolean,
            default: false,
            select: false,
        },
    },
    { timestamps: true }
);

// fetch barber reviews sorted by newest
reviewSchema.index({ barber: 1, createdAt: -1 });

// fast lookup to check if customer already reviewed a booking
reviewSchema.index({ customer: 1, booking: 1 });

// skip soft-deleted reviews automatically
// async style — mongoose 7+ doesn't pass next to regex pre-hooks
reviewSchema.pre(/^find/, async function () {
    this.where({ isDeleted: { $ne: true } });
});

const Review = mongoose.model('Review', reviewSchema);
export default Review;
