const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    avatar: { type: String, default: '' },
    virtualAccount: {
        accountNumber: { type: String, default: '' },
        accountName: { type: String, default: '' },
        bank: { type: String, default: '' },
        bankCode: { type: String, default: '' },
        reference: { type: String, default: '' }
    },
    resetToken: { type: String, default: '' },
    resetExpires: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
