// routes/bench.js
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const router = express.Router();

/**
 * Parses a raw bench string like:
 * "0~Select Bench#1~Allahabad High Court#2~Allahabad High Court Lucknow Bench#"
 */
function parseBenchString(raw) {
  const parts = raw.split('#').filter(Boolean);
  return parts.map(chunk => {
    const [id, name] = chunk.split('~');
    return { id, name };
  });
}

// Helper function to extract the connect.sid cookie value from request headers
function getSessionCookie(req) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/connect\.sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// POST /fetchBenches
router.post('/fetchBenches', async (req, res) => {
  try {
    const { selectedHighcourt } = req.body;
    if (!selectedHighcourt) {
      return res.status(400).json({ error: 'No highcourt selected' });
    }

    // Store in session
    req.session.selectedHighcourt = selectedHighcourt;
    const combinedCookie = req.session.captchaCookies || '';

    // Build payload
    const payload = querystring.stringify({
      action_code: 'fillHCBench',
      state_code: selectedHighcourt,
      appFlag: 'web'
    });

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': combinedCookie,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Origin': 'https://hcservices.ecourts.gov.in',
      'Referer': 'https://hcservices.ecourts.gov.in/',
      'sec-ch-ua': '"Not(A:Brand";v="99", "Brave";v="133", "Chromium";v="133"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'sec-gpc': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest'
    };

    // Make the external request
    const response = await axios.post(
      'https://hcservices.ecourts.gov.in/hcservices/cases_qry/index_qry.php',
      payload,
      { headers }
    );

    console.log('Bench raw:', response.data);
    const benches = parseBenchString(response.data);

    req.session.benches = benches;
    req.session.selectedBench = '';

    // 1) Extract session cookie from request
    const sessionCookie = getSessionCookie(req);

    // 2) Send it in a custom header, e.g. X-Session-Cookie
    if (sessionCookie) {
      res.set('X-Session-Cookie', sessionCookie);
    }

    // 3) Return the rest of your data in JSON (no sessionCookie in the body)
    res.json({
      highcourts: req.session.highcourts || [],
      selectedHighcourt,
      benches,
      selectedBench: '',
      captchaImage: null
    });
  } catch (error) {
    console.error('Error fetching benches:', error);
    res.status(500).json({ error: 'Failed to fetch benches' });
  }
});

module.exports = router;
