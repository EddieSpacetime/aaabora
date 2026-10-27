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
    console.error("\n❌ STRIPE ERROR: STRIPE_SECRET_KEY environment variable is missing!\n");
    process.exit(1);
}

const stripe = require('stripe')(apiKey);

const app = express();

// Root directory determination
const ROOT_DIR = fs.existsSync(path.join(__dirname, 'index.html'))
    ? __dirname
    : path.join(__dirname, '..');

// 🚀 TOP-PRIORITY ROUTE: Intercept success.html immediately before anything else
app.get('/success.html', (req, res) => {
    const possiblePaths = [
        path.join(ROOT_DIR, 'success.html'),
        path.join(__dirname, '../success.html'),
        path.join(__dirname, 'success.html')
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return res.sendFile(p);
        }
    }

    // Inline fallback guarantee if file is missing on disk
    res.send(`
        <!DOCTYPE html>
        <html lang="el">
        <head>
            <meta charset="UTF-8">
            <title>Επιτυχής Παραγγελία · Aabora</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-stone-50 text-stone-800 min-h-screen flex items-center justify-center">
            <div class="max-w-md w-full bg-white p-8 rounded shadow text-center">
                <h1 class="text-2xl font-bold mb-2">Ευχαριστούμε για την Παραγγελία σας!</h1>
                <p class="text-stone-600 text-sm mb-6">Η πληρωμή σας ολοκληρώθηκε με επιτυχία.</p>
                <a href="/" class="block w-full bg-stone-900 text-white py-3 rounded text-sm uppercase">Επιστροφή στο Κατάστημα</a>
            </div>
        </body>
        </html>
    `);
});

// Security Headers & Response Compression
app.use(helmet({
    contentSecurityPolicy: false,
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

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Stripe Checkout Endpoint
app.post('/create-checkout-session', async (req, res) => {
    const { items, currency = 'eur' } = req.body;
    const origin = process.env.DOMAIN || `${req.protocol}://${req.get('host')}`;

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
            success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/?canceled=true`,
        });

        res.json({ url: session.url });
    } catch (e) {
        console.error('Stripe Session Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Bespoke Inquiry API Endpoint
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

    const dataDir = path.join(ROOT_DIR, 'data');
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

// Explicit Favicon Route Handler
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(ROOT_DIR, 'favicon.ico');
    if (fs.existsSync(faviconPath)) {
        res.sendFile(faviconPath);
    } else {
        res.status(204).end();
    }
});

// Redirect direct /index.html requests to root
app.get('/index.html', (req, res) => {
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(301, '/' + queryString);
});

// Serve static assets
app.use(express.static(ROOT_DIR, { maxAge: '1d' }));

// Express 5 compatible SPA fallback middleware
app.use((req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// Port Binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Aabora server running on port ${PORT}`);
});