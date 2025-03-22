const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const router = express.Router();

function getSessionCookie(req) {
  return req.sessionID || null;
}

router.post('/', async (req, res) => {
  try {
    console.log("Request Cookies:", req.cookies);
    console.log("Session Data Before Update:", req.session);

    // Ensure captchaCookies is set in the session
    if (req.body.captchaCookies) {
      req.session.captchaCookies = req.body.captchaCookies;
    }

    console.log("Updated captchaCookies:", req.session.captchaCookies);

    // Extract fields from request body
    const { captcha, petres_name, rgyear, caseStatusSearchType, f } = req.body;
    const court_code = req.body.court_code || req.session.selectedHighcourt;
    const state_code = req.body.state_code || req.session.selectedBench;
    const court_complex_code = req.body.court_complex_code || req.session.selectedBench;
    const captchaCookies = req.session.captchaCookies; // Retrieve stored cookies

    // Debugging missing fields
    console.log({
      captcha, petres_name, rgyear, caseStatusSearchType, f, 
      court_code, state_code, court_complex_code, captchaCookies
    });

    // Validate required fields
    if (!captcha || !petres_name || !rgyear || !caseStatusSearchType || !f || 
        !court_code || !state_code || !court_complex_code || !captchaCookies) {
      return res.status(400).json({ error: 'Missing required fields or session data' });
    }

    // Construct payload
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

    // Set request headers
    const headers = {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.5",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Connection": "keep-alive",
      "Cookie": captchaCookies, // Ensure captchaCookies is correctly set
      "Origin": "http://localhost:3000",
      "Referer": "http://localhost:3000/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "Sec-GPC": "1",
      "Sec-Ch-Ua": "\"Chromium\";v=\"134\", \"Not:A-Brand\";v=\"24\", \"Brave\";v=\"134\"",
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": "\"Windows\"",
      "X-Requested-With": "XMLHttpRequest"
    };

    // Make the request to the government site
    const response = await axios.post(
      'https://hcservices.ecourts.gov.in/hcservices/cases_qry/index_qry.php',
      payload,
      { headers }
    );

    let govData = response.data;
    console.log('Raw response from govt site:', govData);

    // Attempt JSON parsing if response is a string
    if (typeof govData === 'string') {
      try {
        govData = JSON.parse(govData);
      } catch {
        // Leave as string if JSON.parse fails
      }
    }

    // Handle special parsing for `govData.con`
    if (govData.con && Array.isArray(govData.con) && typeof govData.con[0] === 'string') {
      try {
        govData.con = JSON.parse(govData.con[0]);
      } catch (err) {
        console.error('Error parsing govData.con:', err);
      }
    }

    // Send final response
    res.json({
      sessionID: getSessionCookie(req),
      data: govData
    });

  } catch (error) {
    console.error('Case verification error:', error);
    res.status(500).json({ error: 'Case verification failed' });
  }
});

module.exports = router;
