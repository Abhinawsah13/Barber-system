import mongoose from 'mongoose';
import dotenv from 'dotenv';
import './src/models/User.js';
import BarberProfile from './src/models/BarberProfile.js';

dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const profiles = await BarberProfile.find({}).populate('user').lean();
    for (const p of profiles) {
        console.log(`JSON_DATA: ${JSON.stringify({
            username: p.user?.username,
            type: p.service_type,
            active: p.isActive,
            approved: p.isApproved,
            specs: p.specialization
        })}`);
    }
    process.exit(0);
}
check();
