const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const querystring = require('querystring');

const router = express.Router();

function getSessionCookie(req) {
  return req.sessionID || null;
}

router.post('/fetchCaseDetails', async (req, res) => {
  try {
    const { court_code, state_code, court_complex_code, case_no, cino } = req.body;
    if (!court_code || !state_code || !court_complex_code || !case_no || !cino || !req.session.captchaCookies) {
      return res.status(400).json({ error: 'Missing required fields or session data' });
    }

    console.log('Fetching case details for:', { court_code, state_code, court_complex_code, case_no, cino });

    const payload = querystring.stringify({
      court_code,
      state_code,
      court_complex_code,
      case_no,
      cino,
      appFlag: ''
    });

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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest'
    };

    const response = await axios.post(
      'https://hcservices.ecourts.gov.in/hcservices/cases_qry/o_civil_case_history.php',
      payload,
      { headers }
    );

    console.log('Raw HTML response:', response.data);
    const $ = cheerio.load(response.data);
    const filingNumber = $('td:contains("Filing Number")').next().text().trim();
    const filingDate = $('td:contains("Filing Date")').next().text().trim();
    const registrationNumber = $('td:contains("Registration Number")').next().text().trim();
    const registrationDate = $('td:contains("Registration Date")').next().text().trim();
    const cnrNumber = $('td:contains("CNR Number")').next().text().trim();

    const parsedCaseData = {
      filingNumber,
      filingDate,
      registrationNumber,
      registrationDate,
      cnrNumber
    };

    res.json({
      sessionID: getSessionCookie(req),
      parsedCaseData
    });
  } catch (error) {
    console.error('Error fetching case details:', error);
    res.status(500).json({ error: 'Failed to fetch case details' });
  }
});

module.exports = router;
