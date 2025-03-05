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
  resave: false,
  saveUninitialized: true
}));

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes for each step
// We will not use the highcourt.js route since we are hardcoding High Court list.
const benchRoute = require('./routes/bench');
const captchaRoute = require('./routes/captcha');
const caseVerificationRoute = require('./routes/caseVerification');

// Mount the routes
app.use('/', benchRoute);              // handles POST /fetchBenches
app.use('/', captchaRoute);            // handles POST /fetchCaptcha
app.use('/api/case', caseVerificationRoute); // handles final submission

// Serve static files if needed
app.use(express.static('public'));

// STEP 1: GET /
// Render the initial page with a static High Court dropdown.
app.get('/', (req, res) => {
  res.render('index', {
    // Hardcoded high court list – replicate exactly the official site options.
    highcourts: [
      { id: "13", name: "Allahabad High Court" },
      { id: "1", name: "Bombay High Court" },
      { id: "2", name: "Calcutta High Court" },
      // ... add additional options as needed.
    ],
    selectedHighcourt: req.session.selectedHighcourt || '',
    benches: req.session.benches || [],
    selectedBench: req.session.selectedBench || '',
    captchaImage: null
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
