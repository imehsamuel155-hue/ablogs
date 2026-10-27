const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');

const router = express.Router();

function mapListItem(p) {
    const left = (p.stockItems || []).filter((s) => !s.sold).length;
    return {
        _id: String(p._id),
        id: String(p._id),
        title: p.title,
        category: p.category,
        price: p.price,
        description: p.description || '',
        image: p.image || '',
        stock: left,
        piecesLeft: left,
        duration: p.duration || '',
        formatText: p.formatText || '',
        isHot: !!p.isHot,
        viewAccountLink: p.viewAccountLink || '',
        icon: p.icon || ''
    };
}

router.get('/', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        const category = (req.query.category || '').trim().toLowerCase();
        // $ne:false so older docs without isActive still show (Mongo only)
        const filter = { isActive: { $ne: false } };
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
        // show products even with 0 stock so category list stays; detail handles empty
        res.json({ products: products.map(mapListItem) });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to load logs' });
    }
});

router.get('/meta/categories', async (req, res) => {
    try {
        const cats = await Product.distinct('category', { isActive: { $ne: false } });
        res.json({ categories: (cats || []).filter(Boolean).sort() });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const raw = String(req.params.id || '').trim();
        if (!mongoose.Types.ObjectId.isValid(raw)) {
            return res.status(404).json({ error: 'Invalid log id' });
        }
        const product = await Product.findById(raw);
        if (!product) return res.status(404).json({ error: 'Log not found' });
        if (product.isActive === false) return res.status(404).json({ error: 'Log is inactive' });

        const available = (product.stockItems || [])
            .filter((s) => !s.sold)
            .map((s, idx) => ({
                id: String(s._id),
                index: idx + 1,
                hasPreview: !!(s.previewLink || product.viewAccountLink),
                previewLink: s.previewLink || product.viewAccountLink || ''
            }));

        res.json({
            product: {
                _id: String(product._id),
                id: String(product._id),
                title: product.title,
                category: product.category,
                price: product.price,
                description: product.description || '',
                image: product.image || '',
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
        console.error(e);
        res.status(500).json({ error: 'Failed to load log' });
    }
});

module.exports = router;
