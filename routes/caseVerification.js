// routes/caseVerification.js
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // Read user input from the final form
    const { captcha, petres_name, rgyear, caseStatusSearchType, f, court_code, state_code, court_complex_code } = req.body;

    // For debugging:
    console.log('Received values:');
    console.log('court_code:', court_code);
    console.log('state_code:', state_code);
    console.log('court_complex_code:', court_complex_code);
    console.log('captcha:', captcha);
    console.log('petres_name:', petres_name);
    console.log('rgyear:', rgyear);
    console.log('caseStatusSearchType:', caseStatusSearchType);
    console.log('f:', f);

    // Retrieve the captcha cookies from session
    const combinedCookie = req.session.captchaCookies;
    if (!captcha || !petres_name || !rgyear || !caseStatusSearchType || !f ||
        !court_code || !state_code || !court_complex_code || !combinedCookie) {
      return res.status(400).send('Missing required fields or session data');
    }

    // Build the payload
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

    res.render('results', { data: govData });
  } catch (error) {
    console.error('Case verification error:', error);
    res.status(500).send('Case verification failed');
  }
});

module.exports = router;
