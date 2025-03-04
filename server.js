require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as the view engine and specify the views folder
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const captchaRoute = require('./routes/captcha'); 
// Routes
const caseVerificationRoute = require('./routes/caseVerification');
// Mount the case verification route at /api/case
app.use('/api/case', caseVerificationRoute);

app.use('/api/captcha', captchaRoute); 

// Home route to render your index.ejs file
app.get('/', (req, res) => {
  res.render('index');
});

// Serve static files for your test frontend (e.g., CSS, client-side JS)
app.use(express.static('public'));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
