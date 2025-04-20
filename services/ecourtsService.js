const axios = require('axios');
require('dotenv').config();
const ECOURTS_BASE_URL = process.env.ECOURTS_BASE_URL || 'https://services.ecourts.gov.in/ecourtindia_v6/';

let cachedCookies = null;
let lastReceivedAppToken = null; // Variable to store the last received app_token

async function getFreshAppToken() {
    // First, check if we have a recently received app_token
    if (lastReceivedAppToken) {
        console.log('[eCourts Service] Using last received app_token.');
        return lastReceivedAppToken;
    }

    const initialUrl = 'https://services.ecourts.gov.in/ecourtindia_v6/';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

    try {
        const response = await axios.get(initialUrl, {
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Upgrade-Insecure-Requests': '1'
            },
            maxRedirects: 5,
        });

        const appTokenMatch = response.data.match(/<a class="scroll-to-top.*?app_token=(.*?)["&]/);
        if (appTokenMatch && appTokenMatch[1]) {
            const newToken = appTokenMatch[1];
            lastReceivedAppToken = newToken; // Store the newly fetched token
            console.log('[eCourts Service] Fetched new app_token from initial page.');
            return newToken;
        } else {
            console.warn('[eCourts Service] Could not automatically extract app_token from initial page.');
            return null;
        }
    } catch (error) {
        console.error('[eCourts Service] Error fetching fresh app token from initial page:', error.message);
        return null;
    }
}

async function getInitialCookies() {
    if (cachedCookies) {
        return cachedCookies;
    }
    const initialUrl = 'https://services.ecourts.gov.in/ecourtindia_v6/';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
    try {
        const initialResponse = await axios.get(initialUrl, {
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Upgrade-Insecure-Requests': '1'
            },
            maxRedirects: 5,
        });
        const cookiesArray = initialResponse.headers['set-cookie'] || [];
        cachedCookies = cookiesArray.map(cookie => cookie.split(';')[0]).join('; ');
        console.log(`[eCourts Service] Initial Cookies fetched: ${cachedCookies}`);
        return cachedCookies;
    } catch (error) {
        console.error('[eCourts Service] Error fetching initial cookies:', error.message);
        throw new Error('Failed to fetch initial cookies.');
    }
}

async function makeECourtsRequest(endpoint, data = {}, cookies, customAppToken = null) {
    const url = `${ECOURTS_BASE_URL}?p=${endpoint}`;
    data.ajax_req = 'true';

    const currentCookies = cookies || await getInitialCookies();
    const freshAppToken = customAppToken || await getFreshAppToken(); // Use custom token if provided

    if (!freshAppToken) {
        console.warn('[eCourts Service] Warning: Could not fetch a fresh app token. Requests might fail.');
        // You might want to handle this error more explicitly
    }
    data.app_token = freshAppToken;

    const headers = {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'en-US,en;q=0.5',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'origin': 'https://services.ecourts.gov.in',
        'referer': 'https://services.ecourts.gov.in/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        'Cookie': currentCookies || ''
    };

    console.log(`[eCourts Service] Requesting: ${url}`);
    console.log(`[eCourts Service] Data: ${new URLSearchParams(data).toString()}`);
    console.log(`[eCourts Service] Cookies: ${currentCookies}`);
    console.log(`[eCourts Service] App Token: ${freshAppToken}`);

    try {
        const response = await axios.post(url, new URLSearchParams(data).toString(), { headers });
        console.log(`[eCourts Service] Response Status from ${endpoint}: ${response.status}`);

        // Check if the response contains an app_token and store it
        if (response.data && response.data.app_token) {
            lastReceivedAppToken = response.data.app_token;
            console.log('[eCourts Service] Received and stored app_token from response.');
        }

        return response.data;
    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        console.error(`[eCourts Service] Error calling ${endpoint}: Status ${status}`, errorData || error.message);
        // Optionally, you might want to reset lastReceivedAppToken on error
        // lastReceivedAppToken = null;
        throw new Error(`eCourts API call to ${endpoint} failed with status ${status || 'N/A'}`);
    }
}

const getDistricts = async ({ state_code, cookies }) => {
    if (!state_code) throw new Error('Missing state_code for getDistricts');
    return makeECourtsRequest('casestatus/fillDistrict', { state_code }, cookies);
};

const getComplexes = async ({ state_code, dist_code, cookies }) => {
    if (!state_code || !dist_code) throw new Error('Missing parameters for getComplexes');
    return makeECourtsRequest('casestatus/fillcomplex', { state_code, dist_code }, cookies);
};

const setLocation = async ({ complex_code, selected_state_code, selected_dist_code, selected_est_code, cookies }) => {
    if (!complex_code || !selected_state_code || !selected_dist_code) throw new Error('Missing parameters for setLocation');
    const data = {
        complex_code: complex_code.split('@')[0], // Extract the main code
        selected_state_code,
        selected_dist_code,
        selected_est_code: selected_est_code || null // Keep as null for consistency
    };
    return makeECourtsRequest('casestatus/set_data', data, cookies);
};

const fetchCaptchaToken = async ({ cookies }) => {
    return makeECourtsRequest('casestatus/getCaptcha', {}, cookies);
};

const submitPartySearch = async (searchParams) => {
    const {
        petres_name, rgyearP, case_status = 'Pending', fcaptcha_code,
        state_code, dist_code, court_complex_code, est_code = null, // Keep as null for consistency
        cookies, app_token // Receive the captcha specific app_token
    } = searchParams;
    if (!petres_name || !rgyearP || !fcaptcha_code || !state_code || !dist_code || !court_complex_code) {
        throw new Error('Missing required parameters for party search submission');
    }
    const data = {
        petres_name, rgyearP, case_status, fcaptcha_code,
        state_code, dist_code, court_complex_code, est_code,app_token,    };

    console.log('[eCourts Service] submitPartySearch - Data being sent to makeECourtsRequest:', data);
    console.log('[eCourts Service] submitPartySearch - Using app_token:', app_token);

    // Explicitly use app_token for the submitPartyName endpoint
    const appTokenToUse = app_token;

    return makeECourtsRequest('casestatus/submitPartyName', data, cookies, appTokenToUse);
};

module.exports = {
    getDistricts,
    getComplexes,
    setLocation,
    submitPartySearch,
    getInitialCookies,
    getFreshAppToken, // Ensure this is exported
    fetchCaptchaToken
};