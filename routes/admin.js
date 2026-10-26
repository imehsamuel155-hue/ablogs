const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');
const WorkingPicture = require('../models/WorkingPicture');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

function adminAuth(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Login required' });
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'ablogs_dev_secret');
        if (payload.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid session' });
    }
}

/** Guess brand logo URL from name (Clearbit + fallbacks) */
function logoFromName(name) {
    if (!name) return '';
    const n = String(name).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const map = {
        'express vpn': 'expressvpn.com',
        expressvpn: 'expressvpn.com',
        nordvpn: 'nordvpn.com',
        'nord vpn': 'nordvpn.com',
        surfshark: 'surfshark.com',
        protonvpn: 'protonvpn.com',
        'proton vpn': 'protonvpn.com',
        cyberghost: 'cyberghostvpn.com',
        pia: 'privateinternetaccess.com',
        facebook: 'facebook.com',
        instagram: 'instagram.com',
        tiktok: 'tiktok.com',
        twitter: 'twitter.com',
        x: 'x.com',
        telegram: 'telegram.org',
        whatsapp: 'whatsapp.com',
        'google voice': 'voice.google.com',
        googlevoice: 'voice.google.com',
        pinterest: 'pinterest.com',
        snapchat: 'snapchat.com',
        youtube: 'youtube.com'
    };
    let domain = map[n];
    if (!domain) {
        const compact = n.replace(/\s+/g, '');
        domain = map[compact] || (compact + '.com');
    }
    return 'https://logo.clearbit.com/' + domain;
}

router.get('/products', adminAuth, async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({
            products: products.map((p) => ({
                id: p._id,
                title: p.title,
                category: p.category,
                price: p.price,
                description: p.description,
                image: p.image,
                duration: p.duration || '',
                formatText: p.formatText || '',
                isHot: p.isHot,
                viewAccountLink: p.viewAccountLink || '',
                isActive: p.isActive,
                stockLeft: (p.stockItems || []).filter((s) => !s.sold).length,
                stockTotal: (p.stockItems || []).length
            }))
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load logs' });
    }
});

router.post('/products', adminAuth, async (req, res) => {
    try {
        const {
            title, category, price, description, image, formatText,
            isHot, viewAccountLink, icon, duration, customCategory
        } = req.body;
        if (!title || price == null) {
            return res.status(400).json({ error: 'Title and price required' });
        }
        let cat = String(category || 'other').toLowerCase().trim();
        if (cat === 'add' || cat === 'other' || cat === 'custom') {
            cat = String(customCategory || 'other').toLowerCase().trim() || 'other';
        }
        let img = image || '';
        if (!img && title) img = logoFromName(title);

        const product = await Product.create({
            title: title.trim(),
            category: cat,
            price: Number(price),
            description: description || '',
            image: img,
            formatText: formatText || '',
            duration: duration || '',
            isHot: !!isHot,
            viewAccountLink: viewAccountLink || '',
            icon: icon || ''
        });
        res.json({ product });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Create failed' });
    }
});

router.post('/logo-suggest', adminAuth, async (req, res) => {
    try {
        const name = (req.body && req.body.name) || '';
        const url = logoFromName(name);
        res.json({ url, name });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.post('/products/:id/stock', adminAuth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Log not found' });

        const { loginDetails, previewLink, imageUrl, bulkLogins } = req.body;
        const items = [];

        if (bulkLogins && String(bulkLogins).trim()) {
            String(bulkLogins)
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
                .forEach((line) => {
                    items.push({
                        loginDetails: line,
                        previewLink: previewLink || '',
                        imageUrl: imageUrl || '',
                        sold: false
                    });
                });
        } else if (loginDetails && String(loginDetails).trim()) {
            items.push({
                loginDetails: String(loginDetails).trim(),
                previewLink: previewLink || '',
                imageUrl: imageUrl || '',
                sold: false
            });
        } else {
            return res.status(400).json({ error: 'Add login details or bulk logins (one per line)' });
        }

        product.stockItems.push(...items);
        await product.save();

        res.json({
            added: items.length,
            stockLeft: product.stockItems.filter((s) => !s.sold).length,
            stockTotal: product.stockItems.length
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Add stock failed' });
    }
});

router.put('/products/:id', adminAuth, async (req, res) => {
    try {
        const fields = [
            'title', 'category', 'price', 'description', 'image', 'formatText',
            'isHot', 'viewAccountLink', 'icon', 'isActive', 'duration'
        ];
        const update = {};
        fields.forEach((f) => {
            if (req.body[f] !== undefined) update[f] = req.body[f];
        });
        if (update.category) update.category = String(update.category).toLowerCase().trim();
        const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
        res.json({ product });
    } catch (e) {
        res.status(500).json({ error: 'Update failed' });
    }
});

router.delete('/products/:id', adminAuth, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

router.get('/orders', adminAuth, async (req, res) => {
    try {
        const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(100);
        res.json({ orders });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.get('/users', adminAuth, async (req, res) => {
    try {
        const users = await User.find().select('-password -resetToken').sort({ createdAt: -1 }).limit(200);
        res.json({ users });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.get('/settings', adminAuth, async (req, res) => {
    try {
        let s = await SiteSettings.findOne({ key: 'main' });
        if (!s) s = await SiteSettings.create({ key: 'main' });
        res.json({ settings: s });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.put('/settings', adminAuth, async (req, res) => {
    try {
        const s = await SiteSettings.findOneAndUpdate(
            { key: 'main' },
            { $set: req.body },
            { upsert: true, new: true }
        );
        res.json({ settings: s });
    } catch (e) {
        res.status(500).json({ error: 'Save failed' });
    }
});

router.get('/working-pictures', adminAuth, async (req, res) => {
    try {
        const items = await WorkingPicture.find().sort({ createdAt: -1 });
        res.json({ items });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.post('/working-pictures', adminAuth, async (req, res) => {
    try {
        const body = { ...req.body };
        if (body.previewImages && typeof body.previewImages === 'string') {
            body.previewImages = body.previewImages.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        }
        if (!body.coverImage && body.previewImages && body.previewImages[0]) {
            body.coverImage = body.previewImages[0];
        }
        const item = await WorkingPicture.create(body);
        res.json({ item });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Create failed' });
    }
});

router.put('/working-pictures/:id', adminAuth, async (req, res) => {
    try {
        const body = { ...req.body };
        if (body.previewImages && typeof body.previewImages === 'string') {
            body.previewImages = body.previewImages.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        }
        const item = await WorkingPicture.findByIdAndUpdate(req.params.id, body, { new: true });
        res.json({ item });
    } catch (e) {
        res.status(500).json({ error: 'Update failed' });
    }
});

router.delete('/working-pictures/:id', adminAuth, async (req, res) => {
    try {
        await WorkingPicture.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

router.get('/notifications', adminAuth, async (req, res) => {
    try {
        const items = await ActivityLog.find().sort({ createdAt: -1 }).limit(50);
        const unread = await ActivityLog.countDocuments({ read: false });
        res.json({ items, unread });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.post('/notifications/read', adminAuth, async (req, res) => {
    try {
        await ActivityLog.updateMany({ read: false }, { $set: { read: true } });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});


router.post('/products/clear-empty', adminAuth, async (req, res) => {
    try {
        const seedTitles = ['VPN 1 Month', 'VPN 3 Months', 'Facebook Account', 'Instagram Account'];
        const all = await Product.find();
        let removed = 0;
        for (const p of all) {
            const left = (p.stockItems || []).filter((s) => !s.sold).length;
            const isSeed = seedTitles.includes(p.title) || left === 0;
            if (isSeed) {
                await Product.findByIdAndDelete(p._id);
                removed++;
            }
        }
        res.json({ removed, message: 'Cleared sample and empty logs' });
    } catch (e) {
        res.status(500).json({ error: 'Clear failed' });
    }
});

router.post('/products/delete-all', adminAuth, async (req, res) => {
    try {
        const r = await Product.deleteMany({});
        res.json({ removed: r.deletedCount || 0 });
    } catch (e) {
        res.status(500).json({ error: 'Delete all failed' });
    }
});


router.get('/site-stats', adminAuth, async (req, res) => {
    try {
        const Transaction = require('../models/Transaction');
        const depositAgg = await Transaction.aggregate([
            { $match: { type: 'deposit' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);
        const userCount = await User.countDocuments({ role: { $ne: 'admin' } });
        const orderCount = await Order.countDocuments();
        const successfulOrders = await Order.countDocuments({ status: { $in: ['delivered', 'success', 'completed'] } });
        const failedOrders = await Order.countDocuments({ status: { $in: ['cancelled', 'failed'] } });
        const pendingOrders = await Order.countDocuments({ status: 'pending' });
        const revenueAgg = await Order.aggregate([
            { $match: { status: { $in: ['delivered', 'success', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        res.json({
            totalDeposited: (depositAgg[0] && depositAgg[0].total) || 0,
            depositCount: (depositAgg[0] && depositAgg[0].count) || 0,
            userCount,
            orderCount,
            successfulOrders,
            failedOrders,
            pendingOrders,
            successfulRevenue: (revenueAgg[0] && revenueAgg[0].total) || 0
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

module.exports = router;
