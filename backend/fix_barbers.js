import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BarberProfile from './src/models/BarberProfile.js';

dotenv.config();

async function update() {
    await mongoose.connect(process.env.MONGODB_URI);
    // Update all barbers to support both home and salon for the demo
    const result = await BarberProfile.updateMany({}, {
        $set: {
            service_type: 'both',
            isActive: true,
            isApproved: true
        }
    });
    console.log(`Updated ${result.modifiedCount} barbers to 'both' service type.`);
    process.exit(0);
}
update();
