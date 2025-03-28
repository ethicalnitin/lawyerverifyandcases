const express = require("express");
const axios = require("axios");

const router = express.Router();

router.post("/fetchCaptcha", async (req, res) => {
  try {
    const { selectedBench } = req.body;
    if (!selectedBench) {
      return res.status(400).json({ error: "No bench selected" });
    }

    req.session.selectedBench = selectedBench;

    const captchaResponse = await axios.get(
      "https://hcservices.ecourts.gov.in/hcservices/securimage/securimage_show.php",
      { responseType: "arraybuffer" }
    );

    const base64Image = Buffer.from(captchaResponse.data, "binary").toString("base64");
    const contentType = captchaResponse.headers["content-type"] || "image/png";

    // Capture Cookies
    const setCookie = captchaResponse.headers["set-cookie"] || [];
    const combinedCookies = setCookie.map((c) => c.split(";")[0]).join("; ");

    if (!combinedCookies) {
      console.warn("⚠️ No cookies received from captcha response");
      return res.status(500).json({ error: "Failed to fetch captcha cookies" });
    }

    // Store cookies in session
    req.session.captchaCookies = combinedCookies;
    req.session.save((err) => {
      if (err) {
        console.error("⚠️ Error saving session:", err);
        return res.status(500).json({ error: "Session save failed" });
      }

      console.log("✅ Captcha Cookies Stored:", req.session.captchaCookies);

      res.json({
        sessionID: req.sessionID,
        captchaImage: `data:${contentType};base64,${base64Image}`,
      });
    });
  } catch (error) {
    console.error("Captcha fetch error:", error.message);
    res.status(500).json({ error: "Failed to fetch captcha" });
  }
});

module.exports = router;
