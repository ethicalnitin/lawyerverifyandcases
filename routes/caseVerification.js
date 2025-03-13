const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const router = express.Router();

function getSessionCookie(req) {
  return req.sessionID || null;
}

router.post('/', async (req, res) => {
  try {
    const { captcha, petres_name, rgyear, caseStatusSearchType, f } = req.body;
    // Use session-stored values for court details if not provided in request
    const court_code = req.body.court_code || req.session.selectedHighcourt;
    const state_code = req.body.state_code || req.session.selectedBench;
    const court_complex_code = req.body.court_complex_code || req.session.selectedBench;

    if (!captcha || !petres_name || !rgyear || !caseStatusSearchType || !f ||
        !court_code || !state_code || !court_complex_code || !req.session.captchaCookies) {
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
      'Cookie': req.session.captchaCookies
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
        // Leave as string if JSON.parse fails
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
      sessionID: getSessionCookie(req),
      data: govData
    });
  } catch (error) {
    console.error('Case verification error:', error);
    res.status(500).json({ error: 'Case verification failed' });
  }
});

module.exports = router;