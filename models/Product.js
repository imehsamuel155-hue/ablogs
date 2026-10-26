const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema({
    loginDetails: { type: String, default: '' },
    previewLink: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    sold: { type: Boolean, default: false },
    soldTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    soldAt: { type: Date }
}, { _id: true });

const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    formatText: { type: String, default: '' },
    isHot: { type: Boolean, default: false },
    viewAccountLink: { type: String, default: '' },
    icon: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    stockItems: [stockItemSchema]
}, { timestamps: true });

productSchema.virtual('stock').get(function () {
    return (this.stockItems || []).filter((s) => !s.sold).length;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
