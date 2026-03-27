import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to Atlas...');

        // Check if this email exists
        const existing = await User.findOne({ email: 'abhinawprasad83@gmail.com' });
        
        if (existing) {
            // Upgrade to admin
            existing.user_type = 'admin';
            existing.is_verified = true;
            existing.is_active = true;
            await existing.save();
            console.log('✅ Account upgraded to admin!');
            console.log('Email:', existing.email);
            console.log('Username:', existing.username);
        } else {
            // Create fresh admin with this email
            const admin = new User({
                username: 'admin',
                email: 'abhinawprasad83@gmail.com',
                password_hash: 'Admin@123',
                user_type: 'admin',
                is_verified: true,
                is_active: true
            });
            await admin.save();
            console.log('✅ Admin created!');
            console.log('Email: abhinawprasad83@gmail.com');
            console.log('Password: Admin@123');
        }

        process.exit();

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

createAdmin();