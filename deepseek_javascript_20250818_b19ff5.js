const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { ensureAuthenticated } = require('../middleware/auth');
const { sendOrderConfirmationEmail } = require('../utils/mailer');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Checkout page
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Get cart items with product details
        const cartItems = await Promise.all(req.session.cart.map(async item => {
            const product = await Product.findById(item.productId)
                .select('name price discountedPrice');
            return {
                product,
                quantity: item.quantity,
                size: item.size,
                color: item.color
            };
        }));
        
        // Calculate totals
        const subtotal = cartItems.reduce((sum, item) => {
            return sum + (item.product.discountedPrice * item.quantity);
        }, 0);
        
        const shipping = subtotal > 999 ? 0 : 50;
        const total = subtotal + shipping;
        
        // Get user addresses
        const user = req.user;
        
        res.render('checkout/index', { 
            cartItems, 
            subtotal, 
            shipping, 
            total,
            addresses: user.addresses,
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Create order
router.post('/place-order', ensureAuthenticated, async (req, res) => {
    try {
        const { addressId, paymentMethod, note } = req.body;
        
        // Get user and selected address
        const user = req.user;
        const address = user.addresses.id(addressId);
        if (!address) {
            return res.status(400).json({ error: 'Invalid address' });
        }
        
        // Get cart items with product details
        const cartItems = await Promise.all(req.session.cart.map(async item => {
            const product = await Product.findById(item.productId)
                .select('name price discountedPrice stock');
            return {
                product,
                quantity: item.quantity,
                size: item.size,
                color: item.color
            };
        }));
        
        // Calculate totals
        const subtotal = cartItems.reduce((sum, item) => {
            return sum + (item.product.discountedPrice * item.quantity);
        }, 0);
        
        const shipping = subtotal > 999 ? 0 : 50;
        const total = subtotal + shipping;
        
        // Create order in database
        const order = new Order({
            user: user._id,
            items: cartItems.map(item => ({
                product: item.product._id,
                quantity: item.quantity,
                price: item.product.discountedPrice,
                size: item.size,
                color: item.color
            })),
            shippingAddress: {
                name: address.name,
                street: address.street,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
                phone: address.phone
            },
            subtotal,
            shipping,
            total,
            paymentMethod,
            status: 'pending',
            note
        });
        
        await order.save();
        
        // Handle payment based on method
        if (paymentMethod === 'online') {
            // Create Razorpay order
            const razorpayOrder = await razorpay.orders.create({
                amount: total * 100, // Razorpay expects amount in paise
                currency: 'INR',
                receipt: order._id.toString(),
                payment_capture: 1
            });
            
            res.json({ 
                success: true, 
                orderId: order._id,
                paymentMethod: 'online',
                razorpayOrderId: razorpayOrder.id 
            });
        } else if (paymentMethod === 'cod') {
            // For COD, just confirm the order
            await sendOrderConfirmationEmail(user.email, order);
            
            // Clear the cart
            req.session.cart = [];
            
            res.json({ 
                success: true, 
                orderId: order._id,
                paymentMethod: 'cod'
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Verify payment and confirm order
router.post('/verify-payment', ensureAuthenticated, async (req, res) => {
    try {
        const { orderId, paymentId, signature } = req.body;
        
        // Verify the payment signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(orderId + "|" + paymentId)
            .digest('hex');
            
        if (generatedSignature !== signature) {
            return res.status(400).json({ error: 'Invalid payment signature' });
        }
        
        // Update order status
        const order = await Order.findById(orderId);
        if (!order || order.user.toString() !== req.user._id.toString()) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        order.paymentId = paymentId;
        order.status = 'confirmed';
        order.paymentStatus = 'paid';
        await order.save();
        
        // Send confirmation email
        await sendOrderConfirmationEmail(req.user.email, order);
        
        // Clear the cart
        req.session.cart = [];
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;