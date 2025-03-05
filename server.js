require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const app = express();

// Parse URL-encoded forms and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use a session to store user selections and cookies
app.use(session({
  secret: 'someSecretKey', // replace with a real secret in production
  resave: false,
  saveUninitialized: true
}));

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes for each step
const highcourtRoute = require('./routes/highcourt');
const benchRoute = require('./routes/bench');
const captchaRoute = require('./routes/captcha');
const caseVerificationRoute = require('./routes/caseVerification');

// Mount the routes
app.use('/', highcourtRoute);          // handles POST /fetchHighcourts
app.use('/', benchRoute);              // handles POST /fetchBenches
app.use('/', captchaRoute);            // handles POST /fetchCaptcha
app.use('/api/case', caseVerificationRoute); // handles final submission

// Serve static files if needed
app.use(express.static('public'));

// STEP 1: GET /
// Initial page showing a button to fetch high courts.
app.get('/', (req, res) => {
  res.render('index', {
    highcourts: req.session.highcourts || [],
    selectedHighcourt: req.session.selectedHighcourt || '',
    benches: req.session.benches || [],
    selectedBench: req.session.selectedBench || '',
    captchaImage: null
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
