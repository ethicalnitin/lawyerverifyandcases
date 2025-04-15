const express = require("express");
const axios = require("axios");
const asyncHandler = require('express-async-handler');
const ecourtsService = require('../services/ecourtsService');

const router = express.Router();

router.post('/districts', asyncHandler(async (req, res) => {
    const { state_code, cookies } = req.body;
    const response = await ecourtsService.getDistricts({ state_code, cookies });
    res.json(response);
}));

router.post('/complexes', asyncHandler(async (req, res) => {
    const { state_code, dist_code, cookies } = req.body;
    const response = await ecourtsService.getComplexes({ state_code, dist_code, cookies });
    res.json(response);
}));

router.post('/set-location', asyncHandler(async (req, res) => {
    const { complex_code, selected_state_code, selected_dist_code, selected_est_code, cookies } = req.body;
    const response = await ecourtsService.setLocation({ complex_code, selected_state_code, selected_dist_code, selected_est_code, cookies });
    res.json(response);
}));

router.post("/fetchCaptcha", asyncHandler(async (req, res) => {
    try {
        const cookies = req.session.initialCookies;
        const captchaResponse = await ecourtsService.fetchCaptchaToken({ cookies });

        if (captchaResponse && captchaResponse.div_captcha) {
            const captchaHTML = captchaResponse.div_captcha;
            const imageSrcMatch = captchaHTML.match(/<img.*?src="(.*?)"/);

            if (imageSrcMatch && imageSrcMatch[1]) {
                const imageUrl = imageSrcMatch[1];
                const appToken = captchaResponse.app_token; // Extract app_token from captcha response
                return res.json({ imageUrl, appToken }); // Send back the appToken
            } else {
                console.warn("[eCourts API] Could not extract captcha image URL from response:", captchaResponse);
                return res.status(500).json({ error: "Failed to extract captcha image URL" });
            }
        } else {
            console.warn("[eCourts API] Unexpected captcha response format:", captchaResponse);
            return res.status(500).json({ error: "Failed to fetch captcha image URL" });
        }
    } catch (error) {
        console.error("Captcha fetch error:", error.message);
        res.status(500).json({ error: "Failed to fetch captcha" });
    }
}));

router.post('/search-party', asyncHandler(async (req, res) => {
    const searchParams = req.body;
    const response = await ecourtsService.submitPartySearch(searchParams);
    res.json(response);
}));

module.exports = router;