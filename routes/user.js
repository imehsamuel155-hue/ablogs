const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const SiteSettings = require('../models/SiteSettings');
const WorkingPicture = require('../models/WorkingPicture');

const router = express.Router();

function auth(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Login required' });
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'ablogs_dev_secret');
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid session' });
    }
}

router.get('/dashboard', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const orderCount = await Order.countDocuments({ user: user._id });
        const recentTx = await Transaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(8);
        const recentOrders = await Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(5);
        const spentAgg = await Order.aggregate([
            { $match: { user: user._id } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const depositAgg = await Transaction.aggregate([
            { $match: { user: user._id, type: 'deposit' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                balance: user.balance,
                role: user.role,
                avatar: user.avatar || ''
            },
            orderCount,
            totalSpent: (spentAgg[0] && spentAgg[0].total) || 0,
            totalDeposited: (depositAgg[0] && depositAgg[0].total) || 0,
            depositCount: (depositAgg[0] && depositAgg[0].count) || 0,
            recentTx,
            recentOrders
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Dashboard failed' });
    }
});

router.get('/orders', auth, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json({ orders });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load orders' });
    }
});

router.get('/transactions', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json({ transactions });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load transactions' });
    }
});

/** Buy log — deduct balance; optional stockItemId to buy a specific listed account */
router.post('/buy', auth, async (req, res) => {
    try {
        const product = await Product.findById(req.body.productId);
        if (!product || product.isActive === false) return res.status(404).json({ error: 'Log not found' });

        let available = null;
        if (req.body.stockItemId) {
            available = (product.stockItems || []).id(req.body.stockItemId);
            if (!available || available.sold) {
                return res.status(400).json({ error: 'That account is no longer available' });
            }
        } else {
            available = (product.stockItems || []).find((s) => !s.sold);
        }
        if (!available) return res.status(400).json({ error: 'Out of stock' });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (Number(user.balance) < Number(product.price)) {
            return res.status(400).json({ error: 'Please fund your account. Your balance is not enough.' });
        }

        user.balance = Number(user.balance) - Number(product.price);
        await user.save();

        available.sold = true;
        available.soldTo = user._id;
        available.soldAt = new Date();
        await product.save();

        const order = await Order.create({
            user: user._id,
            product: product._id,
            productTitle: product.title,
            amount: product.price,
            deliveryInfo: JSON.stringify({
                loginDetails: available.loginDetails || '',
                previewLink: available.previewLink || product.viewAccountLink || '',
                imageUrl: available.imageUrl || product.image || '',
                duration: product.duration || ''
            }),
            status: 'delivered'
        });

        await Transaction.create({
            user: user._id,
            type: 'purchase',
            amount: product.price,
            balanceAfter: user.balance,
            note: 'Purchase: ' + product.title,
            reference: 'ORD_' + order._id
        });

        res.json({
            order: {
                id: order._id,
                productTitle: product.title,
                amount: product.price,
                delivery: {
                    loginDetails: available.loginDetails || '',
                    previewLink: available.previewLink || product.viewAccountLink || '',
                    imageUrl: available.imageUrl || product.image || '',
                    duration: product.duration || ''
                },
                status: order.status
            },
            balance: user.balance,
            message: 'Purchase successful'
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Purchase failed' });
    }
});

router.get('/settings-public', async (req, res) => {
    try {
        let s = await SiteSettings.findOne({ key: 'main' });
        if (!s) s = await SiteSettings.create({ key: 'main' });
        res.json({ settings: s });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.get('/working-pictures', auth, async (req, res) => {
    try {
        const kind = (req.query.kind || 'working').toLowerCase();
        const filter = { isActive: { $ne: false } };
        if (kind === 'tools' || kind === 'format' || kind === 'working') {
            filter.kind = kind;
        }
        const items = await WorkingPicture.find(filter).sort({ createdAt: -1 });
        res.json({
            items: items.map((it) => ({
                _id: String(it._id),
                id: String(it._id),
                kind: it.kind || 'working',
                title: it.title,
                price: it.price,
                previewImages: it.previewImages || [],
                coverImage: it.coverImage || '',
                picturesCount: it.picturesCount || 0,
                videosCount: it.videosCount || 0,
                telegramLink: it.telegramLink || '',
                description: it.description || ''
            }))
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed' });
    }
});

router.post('/working-pictures/buy', auth, async (req, res) => {
    try {
        const item = await WorkingPicture.findById(req.body.id);
        if (!item || item.isActive === false) return res.status(404).json({ error: 'Not found' });
        const user = await User.findById(req.user.id);
        if (Number(user.balance) < Number(item.price)) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }
        user.balance = Number(user.balance) - Number(item.price);
        await user.save();
        await Transaction.create({
            user: user._id,
            type: 'purchase',
            amount: item.price,
            balanceAfter: user.balance,
            note: 'Working Pictures: ' + item.title,
            reference: 'WP_' + item._id + '_' + Date.now()
        });
        await Order.create({
            user: user._id,
            productTitle: 'Working Pictures: ' + item.title,
            amount: item.price,
            deliveryInfo: JSON.stringify({ telegramLink: item.telegramLink || '', title: item.title }),
            status: 'delivered'
        });
        res.json({
            balance: user.balance,
            telegramLink: item.telegramLink || '',
            message: item.telegramLink ? 'Open link for your pack' : 'Purchase complete'
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Purchase failed' });
    }
});

router.put('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'Not found' });
        // Name, email, phone locked — password only
        if (req.body.password && req.body.password.length >= 6) {
            user.password = await bcrypt.hash(req.body.password, 10);
        } else if (req.body.password) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        } else {
            return res.status(400).json({ error: 'Only password can be changed' });
        }
        await user.save();
        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                balance: user.balance,
                role: user.role,
                avatar: user.avatar || ''
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Update failed' });
    }
});

module.exports = router;
