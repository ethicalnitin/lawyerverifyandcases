const axios = require('axios');
require('dotenv').config();
const cheerio = require('cheerio');
const { URLSearchParams } = require('url');

// Use a consistent base URL
const ECOURTS_BASE_URL = process.env.ECOURTS_BASE_URL || 'https://services.ecourts.gov.in/ecourtindia_v6/';

// Common headers based on cURL examples (adjust User-Agent if needed)
const commonHeaders = {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'en-US,en;q=0.5',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'origin': 'https://services.ecourts.gov.in',
    'referer': 'https://services.ecourts.gov.in/',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'sec-gpc': '1',
    // Using the mobile user agent from cURL examples as it might be relevant
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'x-requested-with': 'XMLHttpRequest',
    // Priority headers are less likely needed for backend requests
    // 'priority': 'u=0, i',
};

// --- 1. Initial Data Fetch ---
async function getInitialData() {
    console.log('[Service] Attempting to get initial data...');
    // Target the main page or a known starting point like the first cURL
    // Let's try the base URL first to get initial cookies and token
    const initialUrl = ECOURTS_BASE_URL; // Or 'https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index&app_token=some_initial_or_known_good_token_if_needed'

    try {
        const response = await axios.get(initialUrl, {
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.5',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin', // Or 'none' if it's the very first request
                'sec-fetch-user': '?1',
                'sec-gpc': '1',
                'upgrade-insecure-requests': '1',
                'user-agent': commonHeaders['user-agent'], // Keep user agent consistent
            },
            // Allow axios to handle redirects to potentially get the final session cookies
            maxRedirects: 5
        });

        console.log('[Service] Initial GET status:', response.status);

        // Extract cookies
        const setCookieHeader = response.headers['set-cookie'];
        if (!setCookieHeader) {
            console.error('[Service] No set-cookie header received in initial response.');
            throw new Error('Failed to obtain session cookies.');
        }
        // Combine multiple Set-Cookie headers correctly
        const cookies = setCookieHeader.map(c => c.split(';')[0]).join('; ');
        console.log('[Service] Initial cookies obtained:', cookies);

        // Extract app_token from the HTML body
        const $ = cheerio.load(response.data);
        const app_token = $('input#app_token').val(); // Assuming it's in an input field

        if (!app_token) {
            console.error('[Service] Could not find app_token input in initial HTML.');
            // Fallback: try regex if needed, check the actual HTML structure
            // const appTokenMatch = response.data.match(/app_token["']?\s*[:=]\s*["']([^"']+)["']/);
            // if (appTokenMatch && appTokenMatch[1]) {
            //     app_token = appTokenMatch[1];
            // } else {
               throw new Error('Could not extract initial app_token from page.');
            // }
        }
        console.log('[Service] Initial app_token obtained:', app_token);

        return { cookies, app_token };

    } catch (error) {
        console.error('[Service] Error in getInitialData:', error.message);
        if (error.response) {
            console.error("eCourts Response Status:", error.response.status);
            console.error("eCourts Response Data:", error.response.data); // Log HTML/error for debugging
        }
        // Re-throw a more specific error for the router to handle
        throw new Error(`Failed to fetch initial data from eCourts: ${error.message}`);
    }
}


// --- 2. Fetch Districts ---
// Corresponds to: curl ... ?p=casestatus/fillDistrict
async function getDistricts({ state_code, app_token, cookies }) {
    console.log(`[Service] Fetching districts for state: ${state_code} with token: ${app_token}`);
    const url = `${ECOURTS_BASE_URL}?p=casestatus/fillDistrict`;
    const params = new URLSearchParams();
    params.append('state_code', state_code);
    params.append('ajax_req', 'true');
    params.append('app_token', app_token); // Use the token passed from the previous step

    try {
        const response = await axios.post(url, params.toString(), {
            headers: {
                ...commonHeaders,
                'Cookie': cookies // Pass cookies in the header
            }
        });
        console.log('[Service] fillDistrict response status:', response.status);
        // IMPORTANT: Extract the *next* app_token from the response body
        // Adjust 'app_token' if the key name is different in the actual JSON response
        const responseData = response.data;
        const next_app_token = responseData.app_token || null; // Assuming the key is 'app_token'
        if (!next_app_token) {
             console.warn('[Service] No app_token found in fillDistrict response body:', responseData);
             // Decide if this is critical. Maybe the old token is still valid?
             // Or maybe it's nested differently? Log the whole data to check.
        } else {
            console.log('[Service] Received next app_token from fillDistrict:', next_app_token);
        }

        // Return both the district data and the token for the next step
        return { data: responseData, next_app_token };

    } catch (error) {
        console.error("Error fetching districts from eCourts Service:", error.message);
        if (error.response) {
            console.error("eCourts Response Status:", error.response.status);
            console.error("eCourts Response Data:", error.response.data);
        }
        throw new Error(`eCourts API error during getDistricts: ${error.message}`); // Propagate error
    }
}

// --- 3. Fetch Complexes ---
// Corresponds to: curl ... ?p=casestatus/fillcomplex
async function getComplexes({ state_code, dist_code, app_token, cookies }) {
    console.log(`[Service] Fetching complexes for state: ${state_code}, dist: ${dist_code} with token: ${app_token}`);
    const url = `${ECOURTS_BASE_URL}?p=casestatus/fillcomplex`;
    const params = new URLSearchParams();
    params.append('state_code', state_code);
    params.append('dist_code', dist_code);
    params.append('ajax_req', 'true');
    params.append('app_token', app_token); // Use the token passed from the previous step

    try {
        const response = await axios.post(url, params.toString(), {
            headers: {
                ...commonHeaders,
                'Cookie': cookies
            }
        });
         console.log('[Service] fillcomplex response status:', response.status);
         const responseData = response.data;
         const next_app_token = responseData.app_token || null;
         if (!next_app_token) {
              console.warn('[Service] No app_token found in fillcomplex response body:', responseData);
         } else {
             console.log('[Service] Received next app_token from fillcomplex:', next_app_token);
         }

        return { data: responseData, next_app_token };

    } catch (error) {
        console.error('Error fetching complexes from eCourts Service:', error.message);
         if (error.response) {
            console.error("eCourts Response Status:", error.response.status);
            console.error("eCourts Response Data:", error.response.data);
        }
        throw new Error(`eCourts API error during getComplexes: ${error.message}`);
    }
}

// --- 4. Set Location ---
// Corresponds to: curl ... ?p=casestatus/set_data
async function setLocation({ complex_code, selected_state_code, selected_dist_code, selected_est_code, app_token, cookies }) {
     console.log(`[Service] Setting location for complex: ${complex_code} with token: ${app_token}`);
     const url = `${ECOURTS_BASE_URL}?p=casestatus/set_data`;
     const params = new URLSearchParams();
     // The cURL shows complex_code like '1130054@8@N'. Ensure this format is passed or handled.
     // If your input `complex_code` doesn't have '@8@N', you might need to adjust.
     // Assuming `complex_code` is passed correctly from the client based on previous step's data.
     params.append('complex_code', complex_code);
     params.append('selected_state_code', selected_state_code);
     params.append('selected_dist_code', selected_dist_code);
     // Handle null or undefined est_code appropriately for the form data
     if (selected_est_code !== null && selected_est_code !== undefined) {
         params.append('selected_est_code', selected_est_code);
     } else {
         // The cURL example explicitly sends 'null' as a string for est_code, replicate if necessary
         // params.append('selected_est_code', 'null'); // Or omit if API handles missing param
         // Let's assume omitting is fine if null/undefined
     }
     params.append('ajax_req', 'true');
     params.append('app_token', app_token);

     try {
        const response = await axios.post(url, params.toString(), {
            headers: {
                ...commonHeaders,
                'Cookie': cookies
            }
        });
        console.log('[Service] set_data response status:', response.status);
        const responseData = response.data;
        const next_app_token = responseData.app_token || null;
        if (!next_app_token) {
             console.warn('[Service] No app_token found in set_data response body:', responseData);
        } else {
            console.log('[Service] Received next app_token from set_data:', next_app_token);
        }

        return { data: responseData, next_app_token };

    } catch (error) {
        console.error('Error setting location via eCourts Service:', error.message);
        if (error.response) {
            console.error("eCourts Response Status:", error.response.status);
            console.error("eCourts Response Data:", error.response.data);
        }
        throw new Error(`eCourts API error during setLocation: ${error.message}`);
    }
}


// --- 5. Fetch Captcha Image (for User) ---
// Corresponds to: curl ... ?p=casestatus/getCaptcha
const fetchCaptcha = async ({ app_token, cookies }) => {
    console.log(`[Service] Fetching captcha image with token: ${app_token}`);
    const url = `${ECOURTS_BASE_URL}?p=casestatus/getCaptcha`;
    const payload = new URLSearchParams({
        ajax_req: 'true',
        app_token: app_token // Use the token passed from the previous step
    });

    try {
        const response = await axios.post(url, payload.toString(), {
            headers: {
                ...commonHeaders,
                'Cookie': cookies
            },
            // Consider timeout if this request sometimes hangs
            // timeout: 10000,
        });
         console.log('[Service] getCaptcha response status:', response.status);
        const responseData = response.data; // e.g., { div_captcha: "...", app_token: "..." }

        // Extract image URL from the HTML snippet
        let imageUrl = null;
        if (responseData && responseData.div_captcha) {
            const captchaHTML = responseData.div_captcha;
            const imageSrcMatch = captchaHTML.match(/<img.*?src="(.*?)"/);
            if (imageSrcMatch && imageSrcMatch[1]) {
                // Prepend base URL if the src is relative (e.g., /path/to/image.jpg)
                // Check the actual src format in responseData.div_captcha
                if (imageSrcMatch[1].startsWith('/')) {
                     imageUrl = new URL(imageSrcMatch[1], ECOURTS_BASE_URL).href;
                } else {
                    imageUrl = imageSrcMatch[1]; // Assume it's absolute or data URI
                }
                console.log('[Service] Extracted captcha image URL:', imageUrl);
            } else {
                 console.warn("[Service] Could not extract captcha image URL from div_captcha:", captchaHTML);
            }
        } else {
             console.warn("[Service] Unexpected captcha response format or missing div_captcha:", responseData);
        }

        const next_app_token = responseData.app_token || null;
         if (!next_app_token) {
              console.warn('[Service] No app_token found in getCaptcha response body:', responseData);
         } else {
             console.log('[Service] Received next app_token from getCaptcha:', next_app_token);
         }

        return { imageUrl, next_app_token }; // Return URL and the crucial next token

    } catch (error) {
        console.error('[Service] Error fetching captcha:', error.message);
        if (error.response) {
            console.error("eCourts Response Status:", error.response.status);
            console.error("eCourts Response Data:", error.response.data);
        }
        throw new Error(`eCourts API error during fetchCaptcha: ${error.message}`);
    }
};

// --- 6. Submit Party Name Search ---
// Corresponds to: curl ... ?p=casestatus/submitPartyName
const submitPartySearch = async ({
    petres_name, rgyearP, case_status = 'Pending', fcaptcha_code, // User input captcha
    state_code, dist_code, court_complex_code, // Should match the location set previously
    // est_code = null, // This seems to be sent as 'null' string in cURL, check if needed
    app_token, // The token received AFTER fetching the captcha image
    cookies
}) => {
     console.log(`[Service] Submitting party search for: ${petres_name}, year: ${rgyearP} with token: ${app_token}`);
    const url = `${ECOURTS_BASE_URL}?p=casestatus/submitPartyName`; // Correct endpoint

    const params = new URLSearchParams();
    params.append('petres_name', petres_name);
    params.append('rgyearP', rgyearP);
    params.append('case_status', case_status); // Usually 'Pending' or 'Disposed'
    params.append('fcaptcha_code', fcaptcha_code); // Captcha entered by user
    params.append('state_code', state_code);
    params.append('dist_code', dist_code);
    params.append('court_complex_code', court_complex_code);
    // params.append('est_code', 'null'); // Replicate cURL's 'null' string if required by API
    params.append('ajax_req', 'true');
    params.append('app_token', app_token);

    try {
        const response = await axios.post(url, params.toString(), {
            headers: {
                ...commonHeaders,
                'Cookie': cookies
            }
        });
        console.log('[Service] submitPartyName response status:', response.status);
        // This is likely the final data response. It might or might not contain a new app_token.
        // Check the actual response structure.
        const responseData = response.data;
        const next_app_token = responseData.app_token || null; // Check if provided
         if (next_app_token) {
             console.log('[Service] Received next app_token from submitPartyName:', next_app_token);
             // Store this potentially, although it might not be needed immediately by client
         }

        // Return the search results
        // The actual results might be HTML ('showPDet') or JSON. Inspect the actual response.
        return { data: responseData, next_app_token }; // Return results and any token

    } catch (error) {
        console.error('Error submitting party search via eCourts Service:', error.message);
        if (error.response) {
            console.error("eCourts Response Status:", error.response.status);
            console.error("eCourts Response Data:", error.response.data); // Often contains error HTML/message
        }
        throw new Error(`eCourts API error during submitPartySearch: ${error.message}`);
    }
};


module.exports = {
    getInitialData,
    getDistricts,
    getComplexes,
    setLocation,
    fetchCaptcha,
    submitPartySearch
    // Removed getFreshAppToken as initial fetch should handle it
};