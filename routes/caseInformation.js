// routes/caseInformation.js
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const router = express.Router();

function getSessionCookie(req) {
  return req.sessionID || null; // Session ID for debugging/logging
}

router.post('/fetchCaseDetails', async (req, res) => {
  try {
    const { court_code, state_code, court_complex_code, case_no, cino } = req.body;

    // Ensure required fields and session cookies exist
    if (!court_code || !state_code || !court_complex_code || !case_no || !cino || !req.session.captchaCookies) {
      return res.status(400).json({ error: 'Missing required fields or session data' });
    }

    console.log('Fetching case details for:', { court_code, state_code, court_complex_code, case_no, cino });

    // Build the form payload
    const payload = querystring.stringify({
      court_code,
      state_code,
      court_complex_code,
      case_no,
      cino,
      appFlag: ''
    });

    // Build headers, using the stored captcha cookies from session
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': req.session.captchaCookies,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Origin': 'https://hcservices.ecourts.gov.in',
      'Referer': 'https://hcservices.ecourts.gov.in/',
      'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Brave";v="134"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'sec-gpc': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'x-requested-with': 'XMLHttpRequest'
    };

    // Make the POST request
    const response = await axios.post(
      'https://hcservices.ecourts.gov.in/hcservices/cases_qry/o_civil_case_history.php',
      payload,
      { headers }
    );

    console.log('Raw HTML response:', response.data);

    // Set a custom header with the session ID (optional)
    res.set('X-Session-ID', getSessionCookie(req));

    // Return the raw HTML (no JSON parsing, no Cheerio)
    // By default, Express might send it as text/html if we do res.send(response.data)
    // but let's be explicit:
    res.type('html').send(response.data);

  } catch (error) {
    console.error('Error fetching case details:', error);
    res.status(500).json({ error: 'Failed to fetch case details' });
  }
});

module.exports = router;
