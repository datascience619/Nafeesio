const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const { ensureAuthenticated } = require('../middleware/auth');

// Get all products
router.get('/', async (req, res) => {
    try {
        const { category, minPrice, maxPrice, color, size, sort, search } = req.query;
        
        let query = {};
        
        // Filter by category
        if (category) {
            const cat = await Category.findOne({ slug: category });
            if (cat) query.category = cat._id;
        }
        
        // Price range filter
        if (minPrice || maxPrice) {
            query.discountedPrice = {};
            if (minPrice) query.discountedPrice.$gte = Number(minPrice);
            if (maxPrice) query.discountedPrice.$lte = Number(maxPrice);
        }
        
        // Color filter
        if (color) {
            query['attributes.color'] = { $in: color.split(',') };
        }
        
        // Size filter
        if (size) {
            query['attributes.size'] = { $in: size.split(',') };
        }
        
        // Search query
        if (search) {
            query.$text = { $search: search };
        }
        
        let sortOption = { createdAt: -1 }; // Default sort by newest
        
        if (sort === 'price-low') {
            sortOption = { discountedPrice: 1 };
        } else if (sort === 'price-high') {
            sortOption = { discountedPrice: -1 };
        } else if (sort === 'popular') {
            sortOption = { rating: -1 };
        }
        
        const products = await Product.find(query)
            .sort(sortOption)
            .populate('category', 'name slug');
            
        res.render('products/list', { 
            products,
            filters: { category, minPrice, maxPrice, color, size, sort, search }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Get product details
router.get('/:slug', async (req, res) => {
    try {
        const product = await Product.findOne({ slug: req.params.slug })
            .populate('category', 'name slug')
            .populate('reviews.user', 'name avatar');
            
        if (!product) {
            return res.status(404).render('error/404');
        }
        
        // Get related products
        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: product._id }
        }).limit(4);
        
        res.render('products/detail', { product, relatedProducts });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Search suggestions API
router.get('/api/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        const products = await Product.find(
            { $text: { $search: q } },
            { score: { $meta: "textScore" } }
        )
        .sort({ score: { $meta: "textScore" } })
        .limit(5)
        .select('name slug images');
        
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Get featured products API
router.get('/api/featured', async (req, res) => {
    try {
        const products = await Product.find({ isFeatured: true })
            .limit(8)
            .select('name slug price discountedPrice images shortDescription rating');
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;