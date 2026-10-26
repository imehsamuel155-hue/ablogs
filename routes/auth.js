const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

function signToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role, email: user.email },
        process.env.JWT_SECRET || 'ablogs_dev_secret',
        { expiresIn: '7d' }
    );
}

router.post('/signup', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const exists = await User.findOne({ email: email.toLowerCase().trim() });
        if (exists) return res.status(400).json({ error: 'Email already registered' });

        const hash = await bcrypt.hash(password, 10);
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: (phone || '').trim(),
            password: hash
        });

        const token = signToken(user);
        try {
            await ActivityLog.create({ type: 'signup', userEmail: user.email, userName: user.name, note: 'New signup' });
        } catch (_) { }
        res.json({
            token,
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
        console.error(e);
        res.status(500).json({ error: 'Signup failed' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

        const token = signToken(user);
        try {
            await ActivityLog.create({
                type: user.role === 'admin' ? 'admin_login' : 'login',
                userEmail: user.email,
                userName: user.name,
                note: user.role === 'admin' ? 'Admin login' : 'User login'
            });
        } catch (_) { }
        res.json({
            token,
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
        console.error(e);
        res.status(500).json({ error: 'Login failed' });
    }
});

router.get('/me', async (req, res) => {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Not logged in' });

        const payload = jwt.verify(token, process.env.JWT_SECRET || 'ablogs_dev_secret');
        const user = await User.findById(payload.id).select('-password');
        if (!user) return res.status(401).json({ error: 'User not found' });

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                balance: user.balance,
                role: user.role
            }
        });
    } catch (e) {
        res.status(401).json({ error: 'Invalid session' });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const email = (req.body.email || '').toLowerCase().trim();
        if (!email) return res.status(400).json({ error: 'Email required' });
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ message: 'If that email exists, a reset link was created.' });
        }
        const token = crypto.randomBytes(24).toString('hex');
        user.resetToken = token;
        user.resetExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();
        res.json({
            message: 'If that email exists, a reset link was created.',
            resetPath: '/forgot-password?token=' + token
        });
    } catch (e) {
        res.status(500).json({ error: 'Request failed' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password || password.length < 6) {
            return res.status(400).json({ error: 'Valid token and password (min 6) required' });
        }
        const user = await User.findOne({
            resetToken: token,
            resetExpires: { $gt: new Date() }
        });
        if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });
        user.password = await bcrypt.hash(password, 10);
        user.resetToken = '';
        user.resetExpires = undefined;
        await user.save();
        res.json({ message: 'Password updated. You can login now.' });
    } catch (e) {
        res.status(500).json({ error: 'Reset failed' });
    }
});

module.exports = router;
