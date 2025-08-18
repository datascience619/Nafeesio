const express = require('express');
const router = express.Router();
const { ensureAdmin } = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Category = require('../models/Category');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { upload } = require('../utils/upload');

// Admin dashboard
router.get('/', ensureAdmin, async (req, res) => {
    try {
        // Get counts for dashboard
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        const userCount = await User.countDocuments();
        
        // Get recent orders
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'name email');
            
        // Get sales data for chart
        const salesData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(new Date() - 30 * 24 * 60 * 60 * 1000) },
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalSales: { $sum: "$total" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        res.render('admin/dashboard', {
            productCount,
            orderCount,
            userCount,
            recentOrders,
            salesData: JSON.stringify(salesData)
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Product management
router.get('/products', ensureAdmin, async (req, res) => {
    try {
        const products = await Product.find().populate('category');
        res.render('admin/products/list', { products });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add product form
router.get('/products/add', ensureAdmin, async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('admin/products/add', { categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Create product
router.post('/products', ensureAdmin, upload.array('images', 5), async (req, res) => {
    try {
        const { 
            name, description, shortDescription, 
            price, discountedPrice, category,
            material, threadCount, dimensions,
            sizes, colors, tags, isFeatured
        } = req.body;
        
        // Process sizes and colors
        const sizeArray = sizes.split(',').map(s => s.trim());
        const colorArray = colors.split(',').map(c => c.trim());
        
        // Get image paths
        const images = req.files.map(file => `/uploads/${file.filename}`);
        
        // Create product
        const product = new Product({
            name,
            slug: name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
            description,
            shortDescription,
            price: parseFloat(price),
            discountedPrice: parseFloat(discountedPrice),
            category,
            attributes: {
                size: sizeArray,
                color: colorArray,
                material,
                threadCount: threadCount ? parseInt(threadCount) : null,
                dimensions
            },
            images,
            tags: tags.split(',').map(t => t.trim()),
            isFeatured: isFeatured === 'on'
        });
        
        await product.save();
        
        req.flash('success_msg', 'Product added successfully');
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error adding product');
        res.redirect('/admin/products/add');
    }
});

// Bulk upload products
router.post('/products/bulk-upload', ensureAdmin, upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error_msg', 'Please upload a CSV file');
            return res.redirect('/admin/products');
        }
        
        const filePath = path.join(__dirname, '../public/uploads/', req.file.filename);
        const results = [];
        
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                try {
                    for (const row of results) {
                        const category = await Category.findOne({ name: row.category });
                        if (!category) continue;
                        
                        const product = new Product({
                            name: row.name,
                            slug: row.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
                            description: row.description,
                            shortDescription: row.shortDescription || row.description.substring(0, 100),
                            price: parseFloat(row.price),
                            discountedPrice: parseFloat(row.discountedPrice || row.price),
                            category: category._id,
                            attributes: {
                                size: row.sizes ? row.sizes.split(',').map(s => s.trim()) : [],
                                color: row.colors ? row.colors.split(',').map(c => c.trim()) : [],
                                material: row.material,
                                threadCount: row.threadCount ? parseInt(row.threadCount) : null,
                                dimensions: row.dimensions
                            },
                            images: row.images ? row.images.split(',').map(i => i.trim()) : [],
                            tags: row.tags ? row.tags.split(',').map(t => t.trim()) : [],
                            isFeatured: row.isFeatured === 'true'
                        });
                        
                        await product.save();
                    }
                    
                    req.flash('success_msg', `${results.length} products uploaded successfully`);
                    res.redirect('/admin/products');
                } catch (err) {
                    console.error(err);
                    req.flash('error_msg', 'Error processing CSV file');
                    res.redirect('/admin/products');
                } finally {
                    // Delete the uploaded file
                    fs.unlinkSync(filePath);
                }
            });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error uploading file');
        res.redirect('/admin/products');
    }
});

module.exports = router;