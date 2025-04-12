const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/view-order', async (req, res) => {
  const { link } = req.query;

  if (!link || !req.session.captchaCookies) {
    return res.status(400).send("Missing order link or session cookies");
  }

  try {
    const fullUrl = link.startsWith("http")
      ? link
      : `https://hcservices.ecourts.gov.in${link.startsWith("/") ? "" : "/"}${link}`;

    const response = await axios.get(fullUrl, {
      responseType: "stream",
      headers: {
        Cookie: req.session.captchaCookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://hcservices.ecourts.gov.in/',
        'Accept': 'application/pdf',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="order.pdf"'); // or attachment
    response.data.pipe(res);
  } catch (err) {
    console.error("PDF fetch error:", err.message);
    res.status(500).send("Failed to load order PDF.");
  }
});

module.exports = router;
