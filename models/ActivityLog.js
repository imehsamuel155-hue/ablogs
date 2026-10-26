const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    type: { type: String, enum: ['signup', 'login', 'admin_login', 'admin_visit'], required: true },
    userEmail: { type: String, default: '' },
    userName: { type: String, default: '' },
    note: { type: String, default: '' },
    read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
