// routes/captcha.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Request the captcha image
    const captchaResponse = await axios.get(
      'https://hcservices.ecourts.gov.in/hcservices/securimage/securimage_show.php',
      { responseType: 'arraybuffer' }
    );

    console.log("Captcha response headers:", captchaResponse.headers);
    // Log a snippet of the response to verify we're receiving image data
    console.log("Captcha response body snippet:", captchaResponse.data.slice(0, 100).toString('utf8'));

    // Convert the image buffer to base64
    const base64Image = Buffer.from(captchaResponse.data, 'binary').toString('base64');
    const contentType = captchaResponse.headers['content-type'] || 'image/jpeg';

    // Combine all cookies from the 'set-cookie' header into one string
    const setCookie = captchaResponse.headers['set-cookie'] || [];
    const combinedCookies = setCookie
      .map(cookie => cookie.split(';')[0])
      .join('; ');

    // Return the captcha image (as a data URL) and the combined cookies
    res.json({
      image: `data:${contentType};base64,${base64Image}`,
      cookie: combinedCookies
    });
  } catch (error) {
    console.error('Captcha fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch captcha' });
  }
});

module.exports = router;
