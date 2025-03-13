const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const router = express.Router();

// Helper function to extract the session ID
function getSessionCookie(req) {
  return req.sessionID || null;
}

// Parses raw bench string like "0~Select Bench#1~Allahabad High Court#2~Allahabad High Court Lucknow Bench#"
function parseBenchString(raw) {
  const parts = raw.split('#').filter(Boolean);
  return parts.map(chunk => {
    const [id, name] = chunk.split('~');
    return { id, name };
  });
}

router.post('/fetchBenches', async (req, res) => {
  try {
    const { selectedHighcourt } = req.body;
    if (!selectedHighcourt) {
      return res.status(400).json({ error: 'No highcourt selected' });
    }

    req.session.selectedHighcourt = selectedHighcourt;
    // Use stored captcha cookies; if not available, empty string
    const combinedCookie = req.session.captchaCookies || '';

    const payload = querystring.stringify({
      action_code: 'fillHCBench',
      state_code: selectedHighcourt,
      appFlag: 'web'
    });

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': combinedCookie,
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0'
    };

    const response = await axios.post(
      'https://hcservices.ecourts.gov.in/hcservices/cases_qry/index_qry.php',
      payload,
      { headers }
    );

    console.log('Bench raw:', response.data);
    const benches = parseBenchString(response.data);

    req.session.benches = benches;
    req.session.selectedBench = '';

    res.json({
      sessionID: getSessionCookie(req),
      benches
    });
  } catch (error) {
    console.error('Error fetching benches:', error);
    res.status(500).json({ error: 'Failed to fetch benches' });
  }
});

module.exports = router;