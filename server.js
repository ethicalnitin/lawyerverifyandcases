require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');

const app = express();

// --- Express App Configuration ---
app.set('trust proxy', 1);

// Body Parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS Setup
app.use(
    cors({
        origin: [
            'https://jr-portal.vercel.app',
            'https://frontend-lawyer.onrender.com',
            'https://ecourt-ftest.onrender.com',
            'http://localhost:3000',
            'http://localhost:3001',
        ],
        credentials: true,
    })
);

// Session Setup (in-memory store used by default in development)
app.use(  
    session({
        secret: process.env.SESSION_SECRET || 'your-default-secret-key-change-me',
        resave: false,
        saveUninitialized: true,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 1000 * 60 * 30, // 30 minutes
        },
    })
);

// --- Routers ---
const benchRoute = require('./routes/bench');
const captchaRoute = require('./routes/captcha');
const caseVerificationRoute = require('./routes/caseVerification');
const caseInformationRoute = require('./routes/caseInformation');
const vieworderroute = require('./routes/vieworder');
const ecourtsRoute = require('./routes/ecourts');

app.use('/', benchRoute);
app.use('/', captchaRoute);
app.use('/api/case', caseVerificationRoute);
app.use('/api/caseInformation', caseInformationRoute);
app.use('/api/vieworder', vieworderroute);
app.use('/api/ecourts', ecourtsRoute);

// --- Root Route ---
app.get('/', (req, res) => {
    req.session.visitCount = (req.session.visitCount || 0) + 1;
    res.json({
        message: 'Welcome to the Case Verification API',
        visitCount: req.session.visitCount,
        sessionID: req.sessionID,
    });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error('[Global Error Handler]', err.stack);
    const errorMessage =
        process.env.NODE_ENV === 'production'
            ? 'An internal server error occurred'
            : err.message;
    res.status(err.status || 500).json({ error: errorMessage });
})

// --- Server Start ---
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
