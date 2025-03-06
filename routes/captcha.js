// routes/captcha.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

// Helper function to extract the connect.sid cookie from request headers
function getSessionCookie(req) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/connect\.sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// POST /fetchCaptcha
router.post('/fetchCaptcha', async (req, res) => {
  try {
    const { selectedBench } = req.body;
    if (!selectedBench) {
      return res.status(400).json({ error: 'No bench selected' });
    }

    req.session.selectedBench = selectedBench;

    const captchaResponse = await axios.get(
      'https://hcservices.ecourts.gov.in/hcservices/securimage/securimage_show.php',
      { responseType: 'arraybuffer' }
    );

    const base64Image = Buffer.from(captchaResponse.data, 'binary').toString('base64');
    const contentType = captchaResponse.headers['content-type'] || 'image/png';

    const setCookie = captchaResponse.headers['set-cookie'] || [];
    const combinedCookies = setCookie.map(c => c.split(';')[0]).join('; ');

    req.session.captchaCookies = combinedCookies;

    res.json({
      sessionCookie: getSessionCookie(req),
      selectedBench,
      captchaImage: `data:${contentType};base64,${base64Image}`
    });
  } catch (error) {
    console.error('Captcha fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch captcha' });
  }
});

module.exports = router;