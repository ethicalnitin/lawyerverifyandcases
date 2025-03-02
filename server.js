require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB (if needed)
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// Routes
const caseVerificationRoute = require('./routes/caseVerification');
// If you already have a verification route, you can mount it too.
// const lawyerVerificationRoute = require('./routes/verification');
// app.use('/api/verify', lawyerVerificationRoute);

app.use('/api/case', caseVerificationRoute);

// Serve static files for your test frontend
app.use(express.static('public'));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
