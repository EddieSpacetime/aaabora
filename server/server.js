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

// Determine absolute project root folder dynamically
const ROOT_DIR = fs.existsSync(path.join(__dirname, 'index.html'))
    ? __dirname
    : path.resolve(__dirname, '..');

// Security Headers & Response Compression
app.use(helmet({ contentSecurityPolicy: false }));
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

// Self-Contained Explicit Route for success.html (Guaranteed 200 OK)
app.get('/success.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="el">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Επιτυχής Παραγγελία · Aabora</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body { font-family: 'Inter', sans-serif; }
                .font-cinzel { font-family: 'Cinzel', serif; }
            </style>
        </head>
        <body class="bg-stone-50 text-stone-800 min-h-screen flex flex-col justify-between">
            <header class="bg-white border-b border-stone-200 py-4 px-6 text-center">
                <a href="/" class="font-cinzel text-2xl tracking-widest font-bold text-stone-900 uppercase">AABORA</a>
            </header>
            <main class="flex-grow flex items-center justify-center px-4 py-16">
                <div class="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border border-stone-200 text-center">
                    <div class="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                        <i class="fas fa-check"></i>
                    </div>
                    <h1 class="font-cinzel text-2xl font-bold text-stone-900 mb-2">Ευχαριστούμε για την Παραγγελία σας!</h1>
                    <p class="text-stone-600 text-sm mb-6">
                        Η πληρωμή σας ολοκληρώθηκε με επιτυχία. Ένα email επιβεβαίωσης και λεπτομερειών αποστολής έχει αποσταλεί.
                    </p>
                    <div class="border-t border-b border-stone-100 py-4 mb-6 text-left text-xs text-stone-500 space-y-1">
                        <p><span class="font-semibold text-stone-700">Κατάσταση:</span> Επεξεργάζεται</p>
                        <p><span class="font-semibold text-stone-700">Μέθοδος:</span> Stripe Secure Checkout</p>
                    </div>
                    <a href="/" class="block w-full bg-stone-900 text-white py-3 px-4 rounded text-sm uppercase tracking-wider font-medium hover:bg-stone-800 transition">
                        Επιστροφή στο Κατάστημα
                    </a>
                </div>
            </main>
            <footer class="bg-white border-t border-stone-200 py-4 text-center text-xs text-stone-500">
                © 2026 Aabora. Με επιφύλαξη παντός δικαιώματος.
            </footer>
        </body>
        </html>
    `);
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

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided in cart.' });
    }

    const lineItems = items.map(item => {
        const targetPriceVal = item.price !== undefined ? item.price : (item.cost !== undefined ? item.cost : item.amount);
        
        let rawPrice = 0;
        if (typeof targetPriceVal === 'string') {
            rawPrice = parseFloat(targetPriceVal.replace(/[^0-9.]/g, ''));
        } else if (typeof targetPriceVal === 'number') {
            rawPrice = targetPriceVal;
        }

        const unitAmount = Math.round((isNaN(rawPrice) ? 0 : rawPrice) * 100);

        const itemData = {
            price_data: {
                currency: currency.toLowerCase(),
                product_data: {
                    name: item.name || 'Jewelry Item',
                },
                unit_amount: unitAmount > 0 ? unitAmount : 1500,
            },
            quantity: parseInt(item.qty || item.quantity || 1, 10),
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

        res.status(200).json({ success: true, message: 'Inquiry received successfully.' });
    } catch (error) {
        console.error('Inquiry Processing Error:', error);
        res.status(500).json({ error: 'Failed to process inquiry.' });
    }
});

// Favicon Handler
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(ROOT_DIR, 'favicon.ico');
    if (fs.existsSync(faviconPath)) {
        return res.sendFile(faviconPath);
    }
    res.status(204).end();
});

// Redirect direct /index.html requests to root
app.get('/index.html', (req, res) => {
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(301, '/' + queryString);
});

// Serve static assets from Root Directory
app.use(express.static(ROOT_DIR, { maxAge: '1d' }));

// SPA Fallback Handler
app.use((req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// Port Binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Aabora server running on port ${PORT}`);
});