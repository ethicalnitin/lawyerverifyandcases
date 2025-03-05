// routes/highcourt.js
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const router = express.Router();

// Parse a string like "0~Select High Court#1~Allahabad High Court#2~Bombay High Court#"
function parseHighcourtString(raw) {
  const parts = raw.split('#').filter(Boolean);
  return parts.map(chunk => {
    const [id, name] = chunk.split('~');
    return { id, name };
  });
}

// POST /fetchHighcourts
router.post('/fetchHighcourts', async (req, res) => {
  try {
    const payload = querystring.stringify({
      action_code: 'fillHC',
      appFlag: 'web'
    });

    const response = await axios.post(
      'https://hcservices.ecourts.gov.in/hcservices/cases_qry/index_qry.php',
      payload,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const rawString = response.data;
    console.log('Highcourt raw:', rawString);

    const highcourts = parseHighcourtString(rawString);

    // Save in session and reset other steps
    req.session.highcourts = highcourts;
    req.session.selectedHighcourt = '';
    req.session.benches = [];
    req.session.selectedBench = '';
    req.session.captchaCookies = '';

    // Render the index with highcourts dropdown
    res.render('index', {
      highcourts,
      selectedHighcourt: '',
      benches: [],
      selectedBench: '',
      captchaImage: null
    });
  } catch (error) {
    console.error('Error fetching highcourts:', error);
    res.status(500).send('Failed to fetch highcourts');
  }
});

module.exports = router;
