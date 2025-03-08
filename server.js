require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');

const app = express();

// Enable trust proxy (required for Render when using secure cookies)
app.set('trust proxy', 1);

// Parse URL-encoded forms and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS configuration – set origin to your frontend domain in production
app.use(cors({
  origin: '*', 
  credentials: true
}));

// Session configuration – update for production on Render (HTTPS)
app.use(session({
  secret: process.env.SESSION_SECRET || 'someSecretKey', // use a strong secret via env variable
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,       // use true in production on Render (HTTPS)
    httpOnly: true,
    sameSite: 'None'    // allows cross-site cookies
    // domain: 'lawyerverifyandcases.onrender.com', // (optional) specify your backend domain if needed
  }
}));

// Set up EJS for server-side rendering (if needed)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes
const benchRoute = require('./routes/bench');
const captchaRoute = require('./routes/captcha');
const caseVerificationRoute = require('./routes/caseVerification');
const caseInformationRoute = require('./routes/caseInformation');

// Mount routes
app.use('/', benchRoute);
app.use('/', captchaRoute);
app.use('/api/case', caseVerificationRoute);
app.use('/api/caseInformation', caseInformationRoute);

// Test route to force session creation
app.get('/', (req, res) => {
  req.session.visitCount = (req.session.visitCount || 0) + 1;
  res.json({
    message: 'Welcome to the Case Verification API',
    visitCount: req.session.visitCount,
    sessionID: req.sessionID,
    highcourts: [
      { id: '13', name: 'Allahabad High Court' },
      { id: '1', name: 'Bombay High Court' },
      { id: '2', name: 'Calcutta High Court' }
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
