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

/**
 * Send booking email to both customer and barber
 */
export const sendBookingEmail = async (booking) => {
    try {
        const customer = booking.customer;
        const barber = booking.barber;
        const service = booking.service;
        const dateStr = new Date(booking.date).toLocaleDateString();

        if (!customer || !barber || !service) {
            console.warn('[Email Service] Missing data to send email');
            return;
        }

        const customerEmail = customer.email;
        const barberEmail = barber.email;

        if (!customerEmail && !barberEmail) {
            console.warn('[Email Service] No emails found for customer or barber');
            return;
        }

        const mailContent = `
            <h2>Booking Confirmation - Book-A-Cut</h2>
            <p><strong>Booking ID:</strong> #${booking._id.toString().substring(0, 8)}</p>
            <p><strong>Service:</strong> ${service.name}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Time:</strong> ${booking.time_slot}</p>
            <hr />
            <p><strong>Customer:</strong> ${customer.username}</p>
            <p><strong>Barber:</strong> ${barber.username}</p>
            <p><strong>Total Price:</strong> Rs. ${booking.total_price}</p>
            <p><strong>Payment Status:</strong> ${booking.payment_status}</p>
            <br />
            <p>Thank you for using Book-A-Cut!</p>
        `;

        const recipients = [];
        if (customerEmail) recipients.push(customerEmail);
        if (barberEmail) recipients.push(barberEmail);

        if (recipients.length === 0) return;

        const mailOptions = {
            from: `"Book-A-Cut" <${process.env.EMAIL_USER}>`,
            to: recipients.join(', '),
            subject: `New Booking Confirmation: ${service.name} with ${barber.username}`,
            html: mailContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[Email Service] Email sent: ' + (info.messageId || 'unknown ID'));
        
        return info;
    } catch (error) {
        console.error('[Email Service] Error sending email:', error);
    }
};

/**
 * Send confirmation email
 */
export const sendConfirmationEmail = async (booking) => {
    try {
        const recipients = [];
        if (booking.customer?.email) recipients.push(booking.customer.email);
        if (booking.barber?.email) recipients.push(booking.barber.email);

        if (recipients.length === 0) return;

        const mailOptions = {
            from: `"Book-A-Cut" <${process.env.EMAIL_USER}>`,
            to: recipients.join(', '),
            subject: `Booking Confirmed: ${booking.service?.name}`,
            html: `
                <h2>Booking Confirmed!</h2>
                <p>Great news! Your booking for <strong>${booking.service?.name}</strong> on ${new Date(booking.date).toLocaleDateString()} at ${booking.time_slot} has been confirmed.</p>
                <p><strong>Barber:</strong> ${booking.barber?.username}</p>
                <p><strong>Location:</strong> ${booking.barber?.location?.address || 'Salon'}</p>
                <br />
                <p>See you then!</p>
            `
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('[Email Service] Error sending confirmation email:', error);
    }
};

/**
 * Send cancellation email
 */
export const sendCancellationEmail = async (booking, cancelledBy) => {
    try {
        const customer = booking.customer;
        const barber = booking.barber;
        const service = booking.service;
        
        const recipients = [];
        if (customer?.email) recipients.push(customer.email);
        if (barber?.email) recipients.push(barber.email);

        if (recipients.length === 0) return;

        const mailOptions = {
            from: `"Book-A-Cut" <${process.env.EMAIL_USER}>`,
            to: recipients.join(', '),
            subject: `Booking Cancelled: ${service?.name || 'Service'}`,
            html: `
                <h2>Booking Cancelled</h2>
                <p>The booking for <strong>${service?.name || 'Service'}</strong> on ${new Date(booking.date).toLocaleDateString()} at ${booking.time_slot} has been cancelled by the ${cancelledBy}.</p>
                <p>If you have any questions, please contact support.</p>
            `
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('[Email Service] Error sending cancellation email:', error);
    }
};
