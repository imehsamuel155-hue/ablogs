const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['deposit', 'purchase', 'refund', 'adjust'], required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, default: 0 },
    note: { type: String, default: '' },
    reference: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
