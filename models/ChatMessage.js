const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    guestName: { type: String, default: 'Guest' },
    from: { type: String, enum: ['user', 'admin', 'system'], required: true },
    text: { type: String, default: '' },
    image: { type: String, default: '' }, // data URL or http URL
    readByAdmin: { type: Boolean, default: false },
    readByCustomer: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
