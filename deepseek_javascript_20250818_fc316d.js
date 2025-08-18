const nodemailer = require('nodemailer');
const pug = require('pug');
const path = require('path');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendOrderConfirmationEmail = async (email, order) => {
    try {
        const html = pug.renderFile(
            path.join(__dirname, '../views/emails/order-confirmation.pug'),
            { order }
        );
        
        await transporter.sendMail({
            from: `"A1 Bedsheets" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: `Your Order #${order._id} has been confirmed`,
            html
        });
    } catch (err) {
        console.error('Error sending email:', err);
    }
};

exports.sendPasswordResetEmail = async (email, token) => {
    try {
        const resetUrl = `${process.env.BASE_URL}/auth/reset-password/${token}`;
        
        const html = pug.renderFile(
            path.join(__dirname, '../views/emails/password-reset.pug'),
            { resetUrl }
        );
        
        await transporter.sendMail({
            from: `"A1 Bedsheets" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Password Reset Request',
            html
        });
    } catch (err) {
        console.error('Error sending email:', err);
    }
};