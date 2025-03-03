const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const router = express.Router();

// POST /api/case
router.post('/', async (req, res) => {
  const { 
    court_code, 
    state_code, 
    court_complex_code, 
    caseStatusSearchType, 
    captcha, 
    f, 
    petres_name, 
    rgyear 
  } = req.body;

  // Validate all required fields
  if (!court_code || !state_code || !court_complex_code || !caseStatusSearchType || !captcha || !f || !petres_name || !rgyear) {
    return res.status(400).json({ 
      error: 'All fields (court_code, state_code, court_complex_code, caseStatusSearchType, captcha, f, petres_name, rgyear) are required.' 
    });
  }

  try {
    // Build the payload as URL-encoded data
    const payload = querystring.stringify({
      court_code,
      state_code,
      court_complex_code,
      caseStatusSearchType,
      captcha,
      f,
      petres_name,
      rgyear
    });

    // Define headers according to the provided curl command
    const headers = {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-US,en;q=0.5",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Cookie": "HCSERVICES_SESSID=9lsneebp7jgv3pe78o598fs33q; JSESSION=71121698; HCSERVICES_SESSID=9lsneebp7jgv3pe78o598fs33q",
      "origin": "https://hcservices.ecourts.gov.in",
      "priority": "u=1, i",
      "referer": "https://hcservices.ecourts.gov.in/",
      "sec-ch-ua": `"Not(A:Brand";v="99", "Brave";v="133", "Chromium";v="133"`,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": `"Windows"`,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sec-gpc": "1",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      "x-requested-with": "XMLHttpRequest"
    };

    // Make the POST request to the government website
    const response = await axios.post(
      "https://hcservices.ecourts.gov.in/hcservices/cases_qry/index_qry.php?action_code=showRecords",
      payload,
      { headers }
    );

    // Return the JSON response from the government website to the frontend
    res.json({ status: 'success', data: response.data });
  } catch (error) {
    console.error('Case verification error:', error);
    res.status(500).json({ error: 'Case verification failed' });
  }
});

module.exports = router;

