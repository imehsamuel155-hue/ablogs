const express = require('express');
const Product = require('../models/Product');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        const category = (req.query.category || '').trim().toLowerCase();
        const filter = { isActive: true };
        if (category) {
            filter.category = new RegExp(
                '^' + category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
                'i'
            );
        }
        if (q) {
            filter.$or = [
                { title: new RegExp(q, 'i') },
                { category: new RegExp(q, 'i') },
                { description: new RegExp(q, 'i') }
            ];
        }
        const products = await Product.find(filter).sort({ createdAt: -1 });
        res.json({
            products: products.map((p) => ({
                _id: p._id,
                title: p.title,
                category: p.category,
                price: p.price,
                description: p.description,
                image: p.image,
                stock: (p.stockItems || []).filter((s) => !s.sold).length,
                piecesLeft: (p.stockItems || []).filter((s) => !s.sold).length,
                duration: p.duration || '',
                formatText: p.formatText || '',
                isHot: !!p.isHot,
                viewAccountLink: p.viewAccountLink || '',
                icon: p.icon || ''
            }))
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load logs' });
    }
});

router.get('/meta/categories', async (req, res) => {
    try {
        const cats = await Product.distinct('category', { isActive: true });
        res.json({ categories: (cats || []).filter(Boolean).sort() });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Invalid log id' });
        }
        const product = await Product.findById(req.params.id);
        if (!product || !product.isActive) return res.status(404).json({ error: 'Not found' });
        const available = (product.stockItems || [])
            .filter((s) => !s.sold)
            .map((s, idx) => ({
                id: s._id,
                index: idx + 1,
                // do not send full login until purchased — only optional per-line preview
                hasPreview: !!(s.previewLink || product.viewAccountLink),
                previewLink: s.previewLink || product.viewAccountLink || ''
            }));
        res.json({
            product: {
                _id: product._id,
                title: product.title,
                category: product.category,
                price: product.price,
                description: product.description,
                image: product.image,
                stock: available.length,
                piecesLeft: available.length,
                duration: product.duration || '',
                formatText: product.formatText || '',
                isHot: !!product.isHot,
                viewAccountLink: product.viewAccountLink || '',
                icon: product.icon || '',
                accounts: available
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load log' });
    }
});

module.exports = router;
