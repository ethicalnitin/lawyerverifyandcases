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

// POST /fetchBenches
router.post('/fetchBenches', async (req, res) => {
  try {
    // Get the selected High Court from the form.
    const { selectedHighcourt } = req.body;
    if (!selectedHighcourt) {
      return res.status(400).send('No highcourt selected');
    }

    req.session.selectedHighcourt = selectedHighcourt;

    // (Optional) If you already have a cookie from a landing page or captcha step, retrieve it:
    const combinedCookie = req.session.captchaCookies || ''; 

    // Build the payload exactly as in your curl:
    // action_code=fillHCBench, state_code=<selectedHighcourt>, appFlag=web
    const payload = querystring.stringify({
      action_code: 'fillHCBench',
      state_code: selectedHighcourt,
      appFlag: 'web'
    });

    // Replicate the curl headers.
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': combinedCookie, // if needed
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

    const response = await axios.post(
      'https://hcservices.ecourts.gov.in/hcservices/cases_qry/index_qry.php',
      payload,
      { headers }
    );

    console.log('Bench raw:', response.data);

    // Parse the response string into an array of bench objects.
    const benches = parseBenchString(response.data);

    req.session.benches = benches;
    req.session.selectedBench = '';
    // Optionally, update session captcha cookies if the response includes any new Set-Cookie headers.

    res.render('index', {
      highcourts: req.session.highcourts || [],
      selectedHighcourt,
      benches,
      selectedBench: '',
      captchaImage: null
    });
  } catch (error) {
    console.error('Error fetching benches:', error);
    res.status(500).send('Failed to fetch benches');
  }
});

module.exports = router;
