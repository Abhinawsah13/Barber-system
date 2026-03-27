// scripts/checkLocations.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Import User FIRST so populate works
import User from '../models/User.js';
import BarberProfile from '../models/BarberProfile.js';

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected');
console.log('');

const barbers = await BarberProfile.find({}).populate('user', 'username').lean();

if (barbers.length === 0) {
    console.log('No barbers found in database');
} else {
    console.log(`Found ${barbers.length} barber(s)\n`);
    barbers.forEach((b, i) => {
        console.log(`--- Barber ${i + 1} ---`);
        console.log('Name     :', b.user?.username || 'No user');
        console.log('City     :', b.location?.city   || 'N/A');
        console.log('Address  :', b.location?.address || 'N/A');
        console.log('ServiceArea:', b.location?.serviceArea || 'N/A');
        console.log('Coords   :', b.location?.coordinates || 'N/A');
        console.log('salonVal :', b.pricing?.salonValue);
        console.log('homeVal  :', b.pricing?.homeValue);
        console.log('Services :', b.services);
        console.log('salonMode:', b.serviceModes?.salon);
        console.log('homeMode :', b.serviceModes?.home);
        console.log('');
    });
}

process.exit();
