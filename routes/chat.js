const express = require('express');
const jwt = require('jsonwebtoken');
const ChatMessage = require('../models/ChatMessage');

const router = express.Router();

function optionalAuth(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (token) req.user = jwt.verify(token, process.env.JWT_SECRET || 'ablogs_dev_secret');
    } catch (e) { }
    next();
}

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

router.get('/messages', optionalAuth, async (req, res) => {
    try {
        const filter = req.user ? { user: req.user.id } : { guestName: req.query.guest || 'Guest' };
        const messages = await ChatMessage.find(filter).sort({ createdAt: 1 }).limit(150);
        if (req.user && req.user.role !== 'admin') {
            await ChatMessage.updateMany(
                { user: req.user.id, from: 'admin', readByCustomer: false },
                { $set: { readByCustomer: true } }
            );
        }
        res.json({ messages });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load chat' });
    }
});

router.post('/messages', optionalAuth, async (req, res) => {
    try {
        const text = (req.body.text || '').trim();
        const image = (req.body.image || '').trim();
        if (!text && !image) return res.status(400).json({ error: 'Message or photo required' });

        const msg = await ChatMessage.create({
            user: req.user && req.user.id && req.user.id !== 'admin-board' ? req.user.id : undefined,
            guestName: req.user ? undefined : (req.body.guestName || 'Guest'),
            from: 'user',
            text: text || (image ? '[Photo]' : ''),
            image: image || ''
        });

        res.json({ message: msg });
    } catch (e) {
        res.status(500).json({ error: 'Send failed' });
    }
});

router.get('/admin/threads', adminAuth, async (req, res) => {
    try {
        const msgs = await ChatMessage.find({ user: { $ne: null } })
            .sort({ createdAt: -1 })
            .limit(300)
            .populate('user', 'name email');
        const map = {};
        msgs.forEach((m) => {
            const id = String(m.user && m.user._id);
            if (!id || id === 'undefined') return;
            if (!map[id]) {
                map[id] = {
                    userId: id,
                    name: (m.user && m.user.name) || 'User',
                    email: (m.user && m.user.email) || '',
                    lastText: m.text,
                    lastAt: m.createdAt,
                    unread: 0
                };
            }
            if (m.from === 'user' && !m.readByAdmin) map[id].unread += 1;
        });
        res.json({ threads: Object.values(map).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt)) });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.get('/admin/messages/:userId', adminAuth, async (req, res) => {
    try {
        const messages = await ChatMessage.find({ user: req.params.userId }).sort({ createdAt: 1 }).limit(200);
        await ChatMessage.updateMany(
            { user: req.params.userId, from: 'user', readByAdmin: false },
            { $set: { readByAdmin: true } }
        );
        res.json({ messages });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

router.post('/admin/messages/:userId', adminAuth, async (req, res) => {
    try {
        const text = (req.body.text || '').trim();
        const image = (req.body.image || '').trim();
        if (!text && !image) return res.status(400).json({ error: 'Message or photo required' });
        const msg = await ChatMessage.create({
            user: req.params.userId,
            from: 'admin',
            text: text || (image ? '[Photo]' : ''),
            image: image || '',
            readByAdmin: true
        });
        res.json({ message: msg });
    } catch (e) {
        res.status(500).json({ error: 'Send failed' });
    }
});

module.exports = router;
