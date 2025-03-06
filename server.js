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
  secret: 'someSecretKey', // replace with a real secret in production
  saveUninitialized: true
}));

// Set up EJS (you may keep these for development, but our endpoints now return JSON)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes for each step
const benchRoute = require('./routes/bench');
const captchaRoute = require('./routes/captcha');
const caseVerificationRoute = require('./routes/caseVerification');

// Mount the routes
app.use('/', benchRoute);              // handles POST /fetchBenches
app.use('/', captchaRoute);            // handles POST /fetchCaptcha
app.use('/api/case', caseVerificationRoute); // handles final submission

// Optionally, provide a GET endpoint that returns the static High Court list in JSON
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Case Verification API',
    highcourts: [
      { id: "13", name: "Allahabad High Court" },
      { id: "1", name: "Bombay High Court" },
      { id: "2", name: "Calcutta High Court" }
      // ... add additional options as needed.
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
