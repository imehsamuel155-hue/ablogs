const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'main' },
    welcomeTitle: { type: String, default: 'Welcome to Ablogs Marketplace' },
    welcomeSubtitle: { type: String, default: 'Your Trusted Logs Store' },
    stayConnectedHtml: {
        type: String,
        default:
            'Need help? Reach us directly on WhatsApp for fast support.\n' +
            'Join our Telegram channel for updates, offers, and announcements.\n' +
            'Join our WhatsApp group for the latest deals and updates.\n' +
            "We're here to make your log purchases quick and hassle-free."
    },
    whatsappNumber: { type: String, default: '2348022313937' },
    whatsappGroupLink: { type: String, default: 'https://chat.whatsapp.com/JdTW56VIf5GFo0Rzr5GQoE' },
    telegramLink: { type: String, default: '' },
    telegramGroupLink: { type: String, default: '' },
    siteName: { type: String, default: 'Ablogs' },
    logoUrl: { type: String, default: '' },

    // Announcement popup (shown once per login session when enabled)
    announcementEnabled: { type: Boolean, default: true },
    announcementTitle: { type: String, default: 'Welcome to Ablogs Marketplace' },
    announcementSubtitle: { type: String, default: 'Your Trusted Logs Store' },
    announcementBody: {
        type: String,
        default:
            'Stay Connected:\n' +
            '- Need help? Reach us directly on WhatsApp for fast support\n' +
            '- Join our Telegram channel for updates, offers, and announcements\n' +
            '- Join our WhatsApp group for the latest deals and updates\n' +
            "- We're here to make your log purchases quick and hassle-free"
    },

    // Services strip on dashboard
    liveServiceLabel: { type: String, default: 'Live Support' },
    liveServiceLink: { type: String, default: '' },
    waServiceLabel: { type: String, default: 'WhatsApp Contact' },

    // Custom log categories (appear on customer dropdown even before a log is saved)
    categories: { type: [String], default: [] },

    // Admin board login (separate from customer)
    adminUsername: { type: String, default: 'Samuelthetrader' },
    adminPasswordHash: { type: String, default: '' },
    adminPin: { type: String, default: '4422' },
    securityPin: { type: String, default: '4222' },
    adminFailCount: { type: Number, default: 0 },
    adminLockUntil: { type: Date, default: null },
    adminLockStage: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
