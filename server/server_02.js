const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const nodemailer = require('nodemailer');

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
    console.error("\n❌ STRIPE ERROR: STRIPE_SECRET_KEY is missing!\n");
    process.exit(1);
}

const stripe = require('stripe')(apiKey);

const app = express();

// Production Security Headers & Response Compression
app.use(helmet({
    contentSecurityPolicy: false, // Configured via custom meta tag in index.html for SPA compatibility
}));
app.use(compression());
app.use(express.json());
app.use(cors());

// Configure Transporter for Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Health Check Endpoint for Production Monitoring
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// 1. Stripe Checkout Endpoint (Supports Multi-Currency)
app.post('/create-checkout-session', async (req, res) => {
    const { items, currency = 'eur' } = req.body;

    const lineItems = items.map(item => {
        const itemData = {
            price_data: {
                currency: currency.toLowerCase(),
                product_data: {
                    name: item.name,
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.qty,
        };

        if (item.image && (item.image.startsWith('http://') || item.image.startsWith('https://'))) {
            itemData.price_data.product_data.images = [item.image];
        }

        return itemData;
    });

    try {
        const session = await stripe.checkout.sessions.create({
            line_items: lineItems,
            mode: 'payment',
            success_url: 'http://localhost:3000/index.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://localhost:3000/index.html?canceled=true',
        });

        res.json({ url: session.url });
    } catch (e) {
        console.error('Stripe Session Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// 2. Bespoke Inquiry API Endpoint
app.post('/api/bespoke-inquiry', async (req, res) => {
    const { name, email, metal, budget, notes } = req.body;

    if (!name || !email || !notes) {
        return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    const inquiryRecord = {
        timestamp: new Date().toISOString(),
        name,
        email,
        metal,
        budget,
        notes,
    };

    const dataDir = path.join(__dirname, '../data');
    const filePath = path.join(dataDir, 'inquiries.json');

    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        let currentInquiries = [];
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            currentInquiries = raw ? JSON.parse(raw) : [];
        }

        currentInquiries.push(inquiryRecord);
        fs.writeFileSync(filePath, JSON.stringify(currentInquiries, null, 2));

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const mailOptions = {
                from: `"Aabora Bespoke" <${process.env.EMAIL_USER}>`,
                to: process.env.EMAIL_RECEIVER || process.env.EMAIL_USER,
                subject: `✨ New Bespoke Commission Inquiry from ${name}`,
                html: `
                    <h2>New Bespoke Commission Request</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Metal Choice:</strong> ${metal}</p>
                    <p><strong>Budget:</strong> ${budget || 'Not specified'}</p>
                    <p><strong>Design Notes:</strong></p>
                    <blockquote style="background: #f4f3f0; padding: 12px; border-left: 4px solid #1c1b1a;">
                        ${notes.replace(/\n/g, '<br>')}
                    </blockquote>
                `,
            };

            await transporter.sendMail(mailOptions);
        }

        console.log(`\n📥 Bespoke Inquiry Saved for ${name} (${email})`);
        res.status(200).json({ success: true, message: 'Inquiry received successfully.' });
    } catch (error) {
        console.error('Inquiry Processing Error:', error);
        res.status(500).json({ error: 'Failed to process inquiry.' });
    }
});

// SPA Routing Fallback
app.get('/index_:lang.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Serve static assets with max-age caching in production
app.use(express.static(path.join(__dirname, '..'), {
    maxAge: '1d'
}));

// Change this line at the bottom of server/server.js:
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aabora server running on port ${PORT}`);
});