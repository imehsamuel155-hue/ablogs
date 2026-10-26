const mongoose = require('mongoose');

const workingPictureSchema = new mongoose.Schema({
    kind: { type: String, enum: ['working', 'tools', 'format'], default: 'working' },
    title: { type: String, required: true },
    gender: { type: String, default: '' },
    price: { type: Number, required: true },
    picturesCount: { type: Number, default: 0 },
    videosCount: { type: Number, default: 0 },
    coverImage: { type: String, default: '' },
    previewImages: [{ type: String }],
    telegramLink: { type: String, default: '' }, // any URL after purchase
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    soldOut: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('WorkingPicture', workingPictureSchema);
