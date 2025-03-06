require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');

const app = express();

// Parse URL-encoded forms and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// Use a session to store user selections and cookies
app.use(session({
  secret: 'someSecretKey', // replace with a strong secret in production
  resave: false,
  saveUninitialized: false
}));

// Set up EJS (for development or fallback)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes
const benchRoute = require('./routes/bench');
const captchaRoute = require('./routes/captcha');
const caseVerificationRoute = require('./routes/caseVerification');

// Mount routes
app.use('/', benchRoute);               // POST /fetchBenches
app.use('/', captchaRoute);             // POST /fetchCaptcha
app.use('/api/case', caseVerificationRoute); // POST /api/case

// Optional: simple GET endpoint to test session creation
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Case Verification API',
    highcourts: [
      { id: "13", name: "Allahabad High Court" },
      { id: "1", name: "Bombay High Court" },
      { id: "2", name: "Calcutta High Court" }
    ],
    sessionCookie: req.headers.cookie || "No cookie received"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
