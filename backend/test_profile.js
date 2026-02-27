import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from './src/models/User.js';
import { connectDB } from './src/lib/db.js';

async function test() {
    await connectDB();
    const barber = await User.findOne({ user_type: 'barber' });
    if (!barber) { console.log('no barber'); return process.exit(1); }
    
    const token = jwt.sign({ userId: barber._id, userType: barber.user_type }, process.env.JWT_SECRET);
    console.log('Got token for:', barber.email);
    
    // hit the local endpoint
    const res = await fetch('http://127.0.0.1:3000/api/barbers/profile', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
            services: ['Haircut'],
            bio: 'Test',
            experience_years: 5
        })
    });
    
    const text = await res.text();
    console.log('Response:', res.status, text);
    process.exit(0);
}

test().catch(console.error);
