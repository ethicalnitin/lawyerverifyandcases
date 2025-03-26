const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');


const router = express.Router();

function getSessionCookie(req) {
  return req.sessionID || null; // Session ID for debugging
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

    // Make the POST request
    const response = await axios.post(
      'https://hcservices.ecourts.gov.in/hcservices/cases_qry/o_civil_case_history.php',
      payload,
      { headers }
    );

    const html = response.data;


    const $ = cheerio.load(html);

    const caseDetails = {};
    const $caseDetailsRows = $('.case_details_table tr');
    $caseDetailsRows.each((i, row) => {
      const tds = $(row).find('td');
      
      if (tds.length >= 2) {
        const key = $(tds[0]).text().trim();
        const value = $(tds[1]).text().trim();
 
        caseDetails[key] = value;
      }
    });

   
    const caseStatus = {};
    const $caseStatusTable = $('.table_r');
    const $caseStatusRows = $caseStatusTable.find('tr');
    $caseStatusRows.each((i, row) => {
      const tds = $(row).find('td');
      if (tds.length >= 2) {
        const key = $(tds[0]).text().trim();
        const value = $(tds[1]).text().trim();
        caseStatus[key] = value;
      }
    });

    const petitionerAdvocateText = $('.Petitioner_Advocate_table').text().trim();
   
    const petitionerAdvocate = petitionerAdvocateText.split('\n').map(x => x.trim()).filter(Boolean);

    
    const respondentAdvocateText = $('.Respondent_Advocate_table').text().trim();
    const respondentAdvocate = respondentAdvocateText.split('\n').map(x => x.trim()).filter(Boolean);

    
    const hearingHistory = [];
    const $hearingTable = $('.history_table');
    $hearingTable.find('tr').each((i, row) => {
      
      if (i === 0) return; 
      const tds = $(row).find('td');
      if (tds.length >= 5) {
        hearingHistory.push({
          causeListType: $(tds[0]).text().trim(),
          judge: $(tds[1]).text().trim(),
          businessOnDate: $(tds[2]).text().trim(),
          hearingDate: $(tds[3]).text().trim(),
          purpose: $(tds[4]).text().trim(),
        });
      }
    });

    
    const orders = [];
    const $orderTable = $('.order_table');
    $orderTable.find('tr').each((i, row) => {

      if (i === 0) return; 
      const tds = $(row).find('td');
      if (tds.length >= 5) {
        orders.push({
          orderNumber: $(tds[0]).text().trim(),
          orderOn: $(tds[1]).text().trim(),
          judge: $(tds[2]).text().trim(),
          orderDate: $(tds[3]).text().trim(),
          orderLink: $(tds[4]).find('a').attr('href') || null
        });
      }
    });

    // Build final JSON
    const parsedData = {
      caseDetails,
      caseStatus,
      petitionerAdvocate,
      respondentAdvocate,
      hearingHistory,
      orders
    };

    
    res.json(parsedData);

  } catch (error) {
    console.error('Error fetching case details:', error);
    res.status(500).json({ error: 'Failed to fetch case details' });
  }
});

module.exports = router;
