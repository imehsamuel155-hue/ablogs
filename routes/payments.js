const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const router = express.Router();

const TP_PUBLIC = process.env.TRANSACTPAY_PUBLIC_KEY || '';
const TP_SECRET = process.env.TRANSACTPAY_SECRET_KEY || '';
const TP_ENC = process.env.TRANSACTPAY_ENCRYPTION_KEY || '';
const TP_BASE = 'https://payment-api-service.transactpay.ai';

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

function encryptPayload(obj) {
    // TransactPay expects RSA PKCS#1 v1.5 encryption of JSON, base64 output
    const NodeRSA = require('node-rsa');
    let keyData = TP_ENC;
    try {
        // Client sent base64 of RSAKeyValue XML-ish string
        const decoded = Buffer.from(TP_ENC, 'base64').toString('utf8');
        if (decoded.includes('Modulus') || decoded.includes('RSAKeyValue')) {
            keyData = decoded;
        }
    } catch (e) { }

    const key = new NodeRSA();
    // Try PEM / components — if XML, extract modulus & exponent
    if (String(keyData).includes('Modulus')) {
        const modMatch = String(keyData).match(/<Modulus>([^<]+)<\/Modulus>/i);
        const expMatch = String(keyData).match(/<Exponent>([^<]+)<\/Exponent>/i);
        if (modMatch && expMatch) {
            key.importKey({
                n: Buffer.from(modMatch[1], 'base64'),
                e: Buffer.from(expMatch[1], 'base64')
            }, 'components-public');
        } else {
            key.importKey(keyData, 'pkcs8-public');
        }
    } else if (String(keyData).includes('BEGIN')) {
        key.importKey(keyData, 'pkcs8-public');
    } else {
        // raw base64 modulus fallback not reliable — try as pem
        try {
            key.importKey(keyData, 'pkcs8-public');
        } catch (e) {
            throw new Error('Could not load TransactPay encryption key. Check TRANSACTPAY_ENCRYPTION_KEY.');
        }
    }
    key.setOptions({ encryptionScheme: 'pkcs1' });
    return key.encrypt(JSON.stringify(obj), 'base64');
}

/** Create / return dedicated virtual account for logged-in user */
router.post('/virtual-account', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.virtualAccount && user.virtualAccount.accountNumber) {
            return res.json({ virtualAccount: user.virtualAccount, reused: true });
        }

        const phone = (req.body.phone || user.phone || '').replace(/\D/g, '');
        if (phone.length < 10) {
            return res.status(400).json({ error: 'Valid phone number required' });
        }
        user.phone = phone;
        await user.save();

        const alias = 'ABLOGS_' + user._id.toString().slice(-8);
        const reference = 'VA_' + user._id.toString() + '_' + Date.now();
        const payload = {
            Alias: alias,
            Reference: reference,
            Narration: 'Ablogs wallet ' + user.email
        };

        let body;
        try {
            const encrypted = encryptPayload(payload);
            body = { data: encrypted };
        } catch (encErr) {
            // Fallback: some environments accept plain (test) — try plain then fail clearly
            console.warn('Encrypt warning:', encErr.message);
            body = payload;
        }

        const response = await axios.post(
            TP_BASE + '/payment/virtual-account/generate',
            body,
            {
                headers: {
                    'api-key': TP_PUBLIC,
                    encryption: 'RSA',
                    'Content-Type': 'application/json'
                },
                timeout: 30000,
                validateStatus: () => true
            }
        );

        const data = response.data || {};
        if (!response.status || response.status >= 400 || data.status === false) {
            console.error('TransactPay VA error', response.status, data);
            return res.status(502).json({
                error: data.message || 'Could not generate deposit account. Check TransactPay keys / plan.',
                detail: data
            });
        }

        const va = {
            accountNumber: data.accountNumber || data.data?.account_number || data.data?.accountNumber || '',
            accountName: data.accountName || data.data?.account_name || data.data?.accountName || user.name,
            bank: data.bank || data.data?.bank_name || data.data?.bank || '',
            bankCode: data.bankCode || data.data?.bankCode || '',
            reference: reference
        };

        if (!va.accountNumber) {
            return res.status(502).json({ error: 'No account number returned', detail: data });
        }

        user.virtualAccount = va;
        await user.save();

        res.json({ virtualAccount: va, reused: false });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message || 'Virtual account failed' });
    }
});

/** Start a one-time payment order (card / transfer checkout) */
router.post('/deposit', auth, async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        if (!amount || amount < 100) {
            return res.status(400).json({ error: 'Minimum deposit is ₦100' });
        }
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const reference = 'DEP_' + user._id.toString() + '_' + Date.now();
        const appUrl = process.env.APP_URL || 'http://localhost:5080';

        const orderBody = {
            customer: {
                firstname: (user.name || 'Customer').split(' ')[0],
                lastname: (user.name || 'User').split(' ').slice(1).join(' ') || 'Ablogs',
                mobile: user.phone ? (user.phone.startsWith('+') ? user.phone : '+234' + user.phone.replace(/^0/, '')) : '+2348000000000',
                country: 'NG',
                email: user.email
            },
            order: {
                amount: amount,
                reference: reference,
                description: 'Ablogs wallet deposit',
                currency: 'NGN'
            },
            payment: {
                RedirectUrl: appUrl + '/dashboard?deposit=1'
            }
        };

        const response = await axios.post(
            TP_BASE + '/payment/order/create',
            orderBody,
            {
                headers: {
                    'api-key': TP_PUBLIC,
                    'Content-Type': 'application/json'
                },
                timeout: 30000,
                validateStatus: () => true
            }
        );

        const data = response.data || {};
        if (response.status >= 400) {
            console.error('Order create error', data);
            return res.status(502).json({ error: data.message || 'Could not start payment', detail: data });
        }

        // Save pending reference for later verify
        await Transaction.create({
            user: user._id,
            type: 'deposit',
            amount: amount,
            balanceAfter: user.balance,
            note: 'Pending deposit',
            reference: reference
        });

        res.json({
            reference,
            amount,
            payment: data,
            // client may open checkout URL if provided
            checkoutUrl: data.checkoutUrl || data.data?.checkoutUrl || data.data?.paymentUrl || null
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message || 'Deposit failed' });
    }
});

/** Webhook from TransactPay — credit wallet */
router.post('/webhook', async (req, res) => {
    try {
        const body = req.body || {};
        console.log('TransactPay webhook:', JSON.stringify(body).slice(0, 500));

        const status = (body.status || body.event || body.data?.status || '').toString().toLowerCase();
        const reference =
            body.reference ||
            body.orderReference ||
            body.data?.reference ||
            body.data?.orderReference ||
            body.accountReference ||
            '';
        const amount = Number(
            body.amount || body.data?.amount || body.order?.amount || 0
        );

        const success =
            status.includes('success') ||
            status === 'successful' ||
            status === 'paid' ||
            body.event === 'payment.success' ||
            body.paymentStatus === 'successful';

        if (!success) {
            return res.json({ received: true, ignored: true });
        }

        // Match user by reference DEP_<userId>_ or VA_<userId>_
        let userId = null;
        const m = String(reference).match(/(?:DEP|VA)_([a-f0-9]{24})_/i);
        if (m) userId = m[1];

        let user = userId ? await User.findById(userId) : null;
        if (!user && body.customer?.email) {
            user = await User.findOne({ email: String(body.customer.email).toLowerCase() });
        }
        if (!user && reference) {
            const pending = await Transaction.findOne({ reference });
            if (pending) user = await User.findById(pending.user);
        }

        if (!user) {
            console.warn('Webhook: user not found for', reference);
            return res.json({ received: true, userFound: false });
        }

        const already = await Transaction.findOne({
            reference: reference || 'none',
            type: 'deposit',
            note: { $ne: 'Pending deposit' }
        });
        if (already && reference) {
            return res.json({ received: true, duplicate: true });
        }

        const credit = amount > 0 ? amount : 0;
        if (credit <= 0) {
            return res.json({ received: true, noAmount: true });
        }

        user.balance = Number(user.balance || 0) + credit;
        await user.save();

        // Update or create transaction
        const pending = reference ? await Transaction.findOne({ reference, note: 'Pending deposit' }) : null;
        if (pending) {
            pending.note = 'Deposit via TransactPay';
            pending.balanceAfter = user.balance;
            pending.amount = credit;
            await pending.save();
        } else {
            await Transaction.create({
                user: user._id,
                type: 'deposit',
                amount: credit,
                balanceAfter: user.balance,
                note: 'Deposit via TransactPay',
                reference: reference || ('WH_' + Date.now())
            });
        }

        res.json({ received: true, credited: credit });
    } catch (e) {
        console.error('Webhook error', e);
        res.status(500).json({ error: 'Webhook failed' });
    }
});

/** Manual verify (user taps “I have paid”) — checks our pending refs; full TP verify can be added */
router.post('/confirm-pending', auth, async (req, res) => {
    try {
        const { reference, amount } = req.body;
        // For safety we only auto-credit via webhook in production.
        // This endpoint returns pending status for UI.
        const tx = await Transaction.findOne({ user: req.user.id, reference });
        if (!tx) return res.status(404).json({ error: 'Reference not found' });
        const user = await User.findById(req.user.id).select('balance');
        res.json({
            status: tx.note === 'Pending deposit' ? 'pending' : 'completed',
            balance: user.balance,
            transaction: tx
        });
    } catch (e) {
        res.status(500).json({ error: 'Confirm failed' });
    }
});

router.get('/my-virtual-account', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('virtualAccount phone balance');
        res.json({
            virtualAccount: user.virtualAccount || {},
            phone: user.phone,
            balance: user.balance
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

module.exports = router;
