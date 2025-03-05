// routes/captcha.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

// POST /fetchCaptcha
router.post('/fetchCaptcha', async (req, res) => {
  try {
    const { selectedBench } = req.body;
    if (!selectedBench) {
      return res.status(400).send('No bench selected');
    }

    req.session.selectedBench = selectedBench;

    // Fetch the captcha image from the official site.
    const captchaResponse = await axios.get(
      'https://hcservices.ecourts.gov.in/hcservices/securimage/securimage_show.php',
      { responseType: 'arraybuffer' }
    );

    // Convert image buffer to base64.
    const base64Image = Buffer.from(captchaResponse.data, 'binary').toString('base64');
    const contentType = captchaResponse.headers['content-type'] || 'image/png';

    // Combine cookies from the captcha response.
    const setCookie = captchaResponse.headers['set-cookie'] || [];
    const combinedCookies = setCookie.map(c => c.split(';')[0]).join('; ');

    req.session.captchaCookies = combinedCookies;

    res.render('index', {
      highcourts: req.session.highcourts || [],
      selectedHighcourt: req.session.selectedHighcourt || '',
      benches: req.session.benches || [],
      selectedBench,
      captchaImage: `data:${contentType};base64,${base64Image}`
    });
  } catch (error) {
    console.error('Captcha fetch error:', error);
    res.status(500).send('Failed to fetch captcha');
  }
});

module.exports = router;
