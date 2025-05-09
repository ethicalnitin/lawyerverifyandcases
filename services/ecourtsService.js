// File: services/ecourtsService.js
const axios = require('axios');
require('dotenv').config();
const cheerio = require('cheerio');
const { URLSearchParams } = require('url');

const ECOURTS_MAIN_PORTAL_URL = 'https://ecourts.gov.in/ecourts_home/index.php';

const commonHeaders = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image:/*;q=0.8',
    'accept-language': 'en-US,en;q=0.5',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'sec-gpc': '1',
};

function extractCookies(setCookieHeader) {
    if (!setCookieHeader) {
        return '';
    }
    return setCookieHeader.map(c => c.split(';')[0]).join('; ');
}


async function getStatesAndDistrictLinks() {
    console.log('[Service] Attempting to get states and district links...');
    const url = ECOURTS_MAIN_PORTAL_URL;

    try {
        const response = await axios.get(url, {
            headers: {
                 ...commonHeaders,
                 'cache-control': 'max-age=0',
                 'priority': 'u=0, i',
                 'Cookie': ''
            },
            maxRedirects: 5
        });

        console.log('[Service] Initial GET status:', response.status);

        const cookies = extractCookies(response.headers['set-cookie']);
        console.log('[Service] Initial cookies obtained:', cookies);

        const $ = cheerio.load(response.data);

        const states = [];
        $('a[href*="?p=dist_court/"]').each((i, el) => {
            const link = $(el).attr('href');
            const text = $(el).text().trim();
            if (link && text) {
                const stateCodeMatch = link.match(/\?p=dist_court\/([a-z]+)/i);
                if (stateCodeMatch && stateCodeMatch[1]) {
                     states.push({ name: text, link: `${ECOURTS_MAIN_PORTAL_URL}${link}`, state_code: stateCodeMatch[1] });
                }
            }
        });

        if (states.length === 0) {
            console.warn('[Service] Could not find any state links on the initial page.');
        } else {
             console.log(`[Service] Found ${states.length} states.`);
        }


        return { states, cookies };

    } catch (error) {
        console.error('[Service] Error in getStatesAndDistrictLinks:', error.message);
        // --- ADD THIS MORE DETAILED LOGGING ---
        if (error.code) {
             console.error('[Service] Error Code:', error.code); // e.g., ENOTFOUND, ECONNREFUSED, EPROTO
        }
         if (error.syscall) {
             console.error('[Service] Error Syscall:', error.syscall); // e.g., 'getaddrinfo', 'connect'
         }
         if (error.config) {
             console.error('[Service] Error Config URL:', error.config.url); // Log the URL being accessed
         }
         if (error.response) {
             console.error("eCourts Response Status:", error.response.status);
             // Avoid logging response.data here as it might be large HTML/error page
             // console.error("eCourts Response Data:", error.response.data);
         }
        // --- END ADDED LOGGING ---
        throw new Error(`Failed to fetch states and district links: ${error.message}`);
    }
}



async function getCaseSearchPageData(districtCourtBaseUrl, cookies) {
    console.log(`[Service] Fetching case search page data from: ${districtCourtBaseUrl}`);
    const url = `${districtCourtBaseUrl}/case-status-search-by-petitioner-respondent/`;

    try {
        const response = await axios.get(url, {
            headers: {
                ...commonHeaders,
                'accept-language': 'en-US,en;q=0.7',
                'referer': districtCourtBaseUrl,
                 'Cookie': cookies
            },
            maxRedirects: 5
        });

        console.log('[Service] Case search page status:', response.status);

        const updatedCookies = cookies + '; ' + extractCookies(response.headers['set-cookie']);
        console.log('[Service] Updated cookies after case search page:', updatedCookies);


        const $ = cheerio.load(response.data);

        const scid = $('input[name="scid"]').val();
        let tokenName = null;
        let tokenValue = null;

        $('input[type="hidden"]').each((i, el) => {
            const name = $(el).attr('name');
            const value = $(el).val();
            if (name && name.startsWith('tok_')) {
                tokenName = name;
                tokenValue = value;
                return false;
            }
        });

        if (!scid) {
            console.error('[Service] Could not find scid input on the case search page.');
            throw new Error('Could not extract scid from case search page.');
        }
         if (!tokenName || !tokenValue) {
            console.error('[Service] Could not find the token input (name starts with "tok_") on the case search page.');
            throw new Error('Could not extract token from case search page.');
        }

        console.log('[Service] Extracted scid:', scid);
        console.log('[Service] Extracted token:', { name: tokenName, value: tokenValue });


        return {
            scid,
            token: { name: tokenName, value: tokenValue },
            cookies: updatedCookies
        };

    } catch (error) {
        console.error(`[Service] Error in getCaseSearchPageData (${districtCourtBaseUrl}):`, error.message);
         if (error.response) {
             console.error("eCourts Response Status:", error.response.status);
             console.error("eCourts Response Data:", error.response.data);
         }
        throw new Error(`Failed to fetch case search page data: ${error.message}`);
    }
}

async function getCaptchaImage(districtCourtBaseUrl, scid, cookies) {
    console.log(`[Service] Fetching captcha image for scid: ${scid}`);
    const url = `${districtCourtBaseUrl}/?_siwp_captcha=null&id=${scid}`;


    try {
        const response = await axios.get(url, {
            headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.7',
                'Connection': 'keep-alive',
                'Referer': `${districtCourtBaseUrl}/case-status-search-by-petitioner-respondent/`,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-GPC': '1',
                'User-Agent': commonHeaders['user-agent'],
                'sec-ch-ua': commonHeaders['sec-ch-ua'],
                'sec-ch-ua-mobile': commonHeaders['sec-ch-ua-mobile'],
                'sec-ch-ua-platform': commonHeaders['sec-ch-ua-platform'],
                'Cookie': cookies
            },
            responseType: 'arraybuffer'
        });

        console.log('[Service] Captcha image status:', response.status);

        const updatedCookies = cookies + '; ' + extractCookies(response.headers['set-cookie']);
        console.log('[Service] Updated cookies after captcha request:', updatedCookies);

        return { imageData: response.data, cookies: updatedCookies };

    } catch (error) {
        console.error('[Service] Error in getCaptchaImage:', error.message);
         if (error.response) {
             console.error("eCourts Response Status:", error.response.status);
         }
        throw new Error(`Failed to fetch captcha image: ${error.message}`);
    }
}

async function submitCaseSearch(districtCourtBaseUrl, scid, token, captchaValue, searchParams, cookies) {
    console.log(`[Service] Submitting case search to: ${districtCourtBaseUrl}`);
    const url = `${districtCourtBaseUrl}/wp-admin/admin-ajax.php`;

    const params = new URLSearchParams();
    params.append('action', 'get_parties');
    params.append('es_ajax_request', '1');
    params.append('submit', 'Search');

    params.append('service_type', searchParams.service_type);
    params.append('est_code', searchParams.est_code);
    params.append('litigant_name', searchParams.litigant_name);
    params.append('reg_year', searchParams.reg_year);
    params.append('case_status', searchParams.case_status);

    params.append('scid', scid);
    params.append(token.name, token.value);


    params.append('siwp_captcha_value', captchaValue);


    try {
        const response = await axios.post(url, params.toString(), {
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.7',
                'Connection': 'keep-alive',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Origin': districtCourtBaseUrl,
                'Referer': `${districtCourtBaseUrl}/case-status-search-by-petitioner-respondent/`,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-GPC': '1',
                'User-Agent': commonHeaders['user-agent'],
                'X-Requested-With': 'XMLHttpRequest',
                'sec-ch-ua': commonHeaders['sec-ch-ua'],
                'sec-ch-ua-mobile': commonHeaders['sec-ch-ua-mobile'],
                'sec-ch-ua-platform': commonHeaders['sec-ch-ua-platform'],
                'Cookie': cookies
            },
            responseType: 'json'
        });

        console.log('[Service] Case search submit status:', response.status);

        const updatedCookies = cookies + '; ' + extractCookies(response.headers['set-cookie']);
        console.log('[Service] Updated cookies after search submit:', updatedCookies);


        return { results: response.data, cookies: updatedCookies };

    } catch (error) {
        console.error('[Service] Error in submitCaseSearch:', error.message);
         if (error.response) {
             console.error("eCourts Response Status:", error.response.status);
             console.error("eCourts Response Data:", error.response.data);
         }
        throw new Error(`Failed to submit case search: ${error.message}`);
    }
}


module.exports = {
    getStatesAndDistrictLinks,
    getCaseSearchPageData,
    getCaptchaImage,
    submitCaseSearch
};
