require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Product = require('./models/Product');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5080;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ablogs';
const pages = path.join(__dirname, 'public', 'pages');

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '8mb' }));

app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/settings/public', async (req, res) => {
    try {
        const SiteSettings = require('./models/SiteSettings');
        let s = await SiteSettings.findOne({ key: 'main' });
        if (!s) s = await SiteSettings.create({ key: 'main' });
        res.json({ settings: { siteName: s.siteName, logoUrl: s.logoUrl || '', whatsappNumber: s.whatsappNumber } });
    } catch (e) { res.json({ settings: {} }); }
});

function sendPage(res, name) {
    res.sendFile(path.join(pages, name));
}

// First visit = full signup page (not shop home)
app.get('/', (req, res) => sendPage(res, 'signup.html'));
app.get('/login', (req, res) => sendPage(res, 'login.html'));
app.get('/signup', (req, res) => sendPage(res, 'signup.html'));
app.get('/forgot-password', (req, res) => sendPage(res, 'forgot-password.html'));
app.get('/dashboard', (req, res) => sendPage(res, 'dashboard.html'));
app.get('/purchases', (req, res) => sendPage(res, 'purchases.html'));
app.get('/shop', (req, res) => sendPage(res, 'shop.html'));
app.get('/products', (req, res) => sendPage(res, 'products.html'));
app.get('/wallet', (req, res) => sendPage(res, 'wallet.html'));
app.get('/profile', (req, res) => sendPage(res, 'profile.html'));
app.get('/working-pictures', (req, res) => sendPage(res, 'working-pictures.html'));
app.get('/category', (req, res) => sendPage(res, 'category.html'));
app.get('/admin', (req, res) => sendPage(res, 'admin.html'));
app.get('/tools', (req, res) => sendPage(res, 'tools.html'));
app.get('/format', (req, res) => sendPage(res, 'format.html'));

app.get(['/login.html', '/signup.html', '/dashboard.html', '/index.html', '/forgot-password.html', '/home.html'], (req, res) => {
    const map = {
        '/login.html': '/login',
        '/signup.html': '/signup',
        '/dashboard.html': '/dashboard',
        '/index.html': '/',
        '/forgot-password.html': '/forgot-password',
        '/home.html': '/'
    };
    res.redirect(301, map[req.path] || '/');
});

app.use((req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.redirect('/');
});

async function seed() {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@ablogs.com').toLowerCase();
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
        const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 10);
        await User.create({
            name: 'Ablogs Admin',
            email: adminEmail,
            password: hash,
            role: 'admin',
            balance: 0
        });
        console.log('Admin created:', adminEmail);
    }

    // Remove old sample logs so Saved logs stays empty until admin adds real ones
    const Product = require('./models/Product');
    const seedTitles = ['VPN 1 Month', 'VPN 3 Months', 'Facebook Account', 'Instagram Account'];
    const del = await Product.deleteMany({ title: { $in: seedTitles } });
    if (del.deletedCount) console.log('Removed sample logs:', del.deletedCount);

    const SiteSettings = require('./models/SiteSettings');
    await SiteSettings.findOneAndUpdate(
        { key: 'main' },
        {
            $set: {
                whatsappNumber: '2348022313937',
                whatsappGroupLink: 'https://chat.whatsapp.com/JdTW56VIf5GFo0Rzr5GQoE',
                announcementEnabled: true
            }
        },
        { upsert: true }
    );
}

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('MongoDB connected');
        await seed();
        app.listen(PORT, () => {
            console.log('Ablogs → http://localhost:' + PORT);
            console.log(' /  /login  /signup  /dashboard  /shop  /admin');
        });
    })
    .catch((err) => {
        console.error('MongoDB error:', err.message);
        process.exit(1);
    });
