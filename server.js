require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors({
  origin: '*', 
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'someSecretKey', 
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'None'    
  }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const benchRoute = require('./routes/bench');
const captchaRoute = require('./routes/captcha');
const caseVerificationRoute = require('./routes/caseVerification');
const caseInformationRoute = require('./routes/caseInformation');


app.use('/', benchRoute);
app.use('/', captchaRoute);
app.use('/api/case', caseVerificationRoute);
app.use('/api/caseInformation', caseInformationRoute);

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