// routes/caseVerification.js
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const router = express.Router();

// Helper function to extract the connect.sid cookie from request headers
function getSessionCookie(req) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/connect\.sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

router.post('/', async (req, res) => {
  try {
    // Read user input from the final form
    const { captcha, petres_name, rgyear, caseStatusSearchType, f, court_code, state_code, court_complex_code } = req.body;

    console.log('Received values:', {
      court_code,
      state_code,
      court_complex_code,
      captcha,
      petres_name,
      rgyear,
      caseStatusSearchType,
      f
    });

    // Retrieve captcha cookies from session
    const combinedCookie = req.session.captchaCookies;
    if (!captcha || !petres_name || !rgyear || !caseStatusSearchType || !f ||
        !court_code || !state_code || !court_complex_code || !combinedCookie) {
      return res.status(400).json({ error: 'Missing required fields or session data' });
    }

    const payload = querystring.stringify({
      action_code: 'showRecords',
      court_code,
      state_code,
      court_complex_code,
      captcha,
      petres_name,
      rgyear,
      caseStatusSearchType,
      f,
      appFlag: 'web'
    });

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': combinedCookie
    };

    const response = await axios.post(
      'https://hcservices.ecourts.gov.in/hcservices/cases_qry/index_qry.php',
      payload,
      { headers }
    );

    let govData = response.data;
    console.log('Raw response from govt site:', govData);

    if (typeof govData === 'string') {
      try {
        govData = JSON.parse(govData);
      } catch {
        // leave as string if JSON.parse fails
      }
    }

    if (govData.con && Array.isArray(govData.con) && typeof govData.con[0] === 'string') {
      try {
        govData.con = JSON.parse(govData.con[0]);
      } catch (err) {
        console.error('Error parsing govData.con:', err);
      }
    }

    res.json({ 
      sessionCookie: getSessionCookie(req),
      data: govData
    });
  } catch (error) {
    console.error('Case verification error:', error);
    res.status(500).json({ error: 'Case verification failed' });
  }
});

module.exports = router;