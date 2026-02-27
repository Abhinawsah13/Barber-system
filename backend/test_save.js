import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import BarberProfile from './src/models/BarberProfile.js';
import { connectDB } from './src/lib/db.js';

async function test() {
    await connectDB();
    const profile = await BarberProfile.findOne();
    profile.serviceModes = { salon: true, home: false };
    try {
        await profile.save();
        console.log('Saved successfully');
    } catch (e) {
        console.log('Error:', e.stack);
    }
    process.exit(0);
}

test();
