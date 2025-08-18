const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { ensureAuthenticated } = require('../middleware/auth');

// Get cart
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // In a real app, you'd get this from the database
        const cart = req.session.cart || [];
        
        // Get full product details for items in cart
        const cartItems = await Promise.all(cart.map(async item => {
            const product = await Product.findById(item.productId)
                .select('name slug price discountedPrice images');
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
        
        const shipping = subtotal > 999 ? 0 : 50; // Free shipping above ₹999
        const total = subtotal + shipping;
        
        res.render('cart/view', { cartItems, subtotal, shipping, total });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add to cart
router.post('/add', ensureAuthenticated, async (req, res) => {
    try {
        const { productId, quantity = 1, size, color } = req.body;
        
        // Validate product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Initialize cart if not exists
        if (!req.session.cart) {
            req.session.cart = [];
        }
        
        // Check if product already in cart
        const existingItem = req.session.cart.find(item => 
            item.productId === productId && 
            item.size === size && 
            item.color === color
        );
        
        if (existingItem) {
            // Update quantity
            existingItem.quantity += parseInt(quantity);
        } else {
            // Add new item
            req.session.cart.push({
                productId,
                quantity: parseInt(quantity),
                size,
                color
            });
        }
        
        // Calculate new cart count
        const cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
        
        res.json({ success: true, cartCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Update cart item
router.put('/update/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;
        
        // Find item in cart
        const item = req.session.cart.find(item => item._id.toString() === id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found in cart' });
        }
        
        // Update quantity
        item.quantity = parseInt(quantity);
        
        // Calculate new totals
        const cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
        const cartItems = await Promise.all(req.session.cart.map(async cartItem => {
            const product = await Product.findById(cartItem.productId)
                .select('discountedPrice');
            return {
                product,
                quantity: cartItem.quantity
            };
        }));
        
        const subtotal = cartItems.reduce((sum, item) => {
            return sum + (item.product.discountedPrice * item.quantity);
        }, 0);
        
        res.json({ success: true, cartCount, subtotal });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Remove from cart
router.delete('/remove/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Remove item from cart
        req.session.cart = req.session.cart.filter(item => item._id.toString() !== id);
        
        // Calculate new cart count
        const cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
        
        res.json({ success: true, cartCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;