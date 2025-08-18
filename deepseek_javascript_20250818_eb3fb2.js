const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    shortDescription: { type: String, required: true },
    price: { type: Number, required: true },
    discountedPrice: { type: Number, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory: { type: String },
    images: [{ type: String, required: true }],
    stock: { 
        available: { type: Boolean, default: true },
        quantity: { type: Number, default: 0 }
    },
    attributes: {
        size: [{ type: String }],
        color: [{ type: String }],
        material: { type: String, required: true },
        threadCount: { type: Number },
        dimensions: { type: String }
    },
    rating: { type: Number, default: 0 },
    reviews: [{
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, required: true },
        comment: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    tags: [{ type: String }],
    isFeatured: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for better search performance
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, isFeatured: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });

module.exports = mongoose.model('Product', productSchema);