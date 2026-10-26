# Ablogs

Digital accounts shop (Facebook, Instagram, VPN, etc.) — **frontend + backend first**.  
Payment gateway (Paystack / virtual accounts) comes next.

## Brand
- Name: **Ablogs**
- Header & footer: **red**
- Body: **white / light grey**
- Logo: put file at `public/images/logo.png` (img src already set)

## Features in this version
- Login / Sign up (popup modal)
- Dashboard: balance, orders count, transactions (clickable)
- Search bar (FB, IG, VPN…)
- Hidden side nav (right)
- Shop with sample products
- Buy requires login (modal opens)
- WhatsApp floating button (left)
- Live customer support chat (right)
- MongoDB users, products, orders, transactions, chat

## Setup

```bash
cd ablogs
cp .env.example .env
# edit MONGODB_URI if needed
npm install
npm start
```

Open http://localhost:5080

Default admin (seeded):
- Email: `admin@ablogs.com`
- Password: `Admin@12345`

## Change WhatsApp number
In `public/js/app.js` set:
```js
const WA_NUMBER = '2348012345678'; // country code, no +
```

## Next (later)
- Paystack / virtual deposit accounts
- Real buy with wallet deduct + delivery
- Admin panel + email alerts
