import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendVerificationEmail = async (email, token) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify your Book-A-Cut Account',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #d4a373;">Welcome to Book-A-Cut!</h2>
                    <p>Thank you for signing up. Please verify your email address to continue.</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                        <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${token}</span>
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you didn't create an account, you can safely ignore this email.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent: ' + info.response);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

export const sendPasswordResetEmail = async (email, resetCode) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Reset Your Book-A-Cut Password',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #d4a373;">Password Reset Request</h2>
                    <p>We received a request to reset your password. Use the code below to reset your password:</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                        <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${resetCode}</span>
                    </div>
                    <p><strong>This code will expire in 10 minutes.</strong></p>
                    <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">Book-A-Cut - Your trusted barber booking app</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent: ' + info.response);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
    }
};
