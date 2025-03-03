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
  if (!court_code || !state_code || !court_complex_code || !caseStatusSearchType ||
      !captcha || !f || !petres_name || !rgyear) {
    return res.status(400).json({ 
      error: 'All fields are required.' 
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

    // Define headers as required by the remote API
    const headers = {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-US,en;q=0.5",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Cookie": "HCSERVICES_SESSID=q53vo1527702fevpbauo1857ki; JSESSION=13344432; HCSERVICES_SESSID=q53vo1527702fevpbauo1857ki",
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

    // 1) Log the raw response for debugging
    console.log("Raw response from government site:", response.data);

    // 2) Attempt to parse the overall response if it's a JSON string
    let govData = response.data;
    if (typeof govData === 'string') {
      try {
        govData = JSON.parse(govData);
      } catch (err) {
        console.error('Error parsing raw response as JSON:', err);
        // If parsing fails, we'll just keep govData as the raw string
      }
    }

    // 3) If govData.con is an array whose first element is a JSON string, parse it
    if (
      govData.con &&
      Array.isArray(govData.con) &&
      typeof govData.con[0] === 'string'
    ) {
      try {
        govData.con = JSON.parse(govData.con[0]);
        console.log('Parsed govData.con successfully.');
      } catch (err) {
        console.error('Error parsing govData.con:', err);
      }
    }

    // If the data is in govData.data.con instead, uncomment and use this logic:
    /*
    if (
      govData.data &&
      govData.data.con &&
      Array.isArray(govData.data.con) &&
      typeof govData.data.con[0] === 'string'
    ) {
      try {
        govData.data.con = JSON.parse(govData.data.con[0]);
        console.log('Parsed govData.data.con successfully.');
      } catch (err) {
        console.error('Error parsing govData.data.con:', err);
      }
    }
    */

    // 4) Render the "results" EJS view with the cleaned data
    //    "data" is what you'll reference in results.ejs (e.g. data.con)
    res.render('results', { data: govData });

  } catch (error) {
    console.error('Case verification error:', error);
    res.status(500).render('error', { error: 'Case verification failed' });
  }
});

module.exports = router;
