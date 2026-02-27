import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
    barber: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    category: {
        type: String,
        required: [true, "Service must belong to a category (e.g. Haircut)"],
    },
    name: {
        type: String,
        required: [true, "Service name is required (e.g. Classic Fade)"]
    },
    description: {
        type: String,
        default: ""
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    duration_minutes: {
        type: Number,
        required: true,
        min: 5
    },
    serviceType: {
        type: String,
        enum: ["salon", "home", "both"],
        required: true,
        default: "both"
    },
    is_active: {
        type: Boolean,
        default: true
    },
    image: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

const Service = mongoose.model("Service", serviceSchema);
export default Service;
