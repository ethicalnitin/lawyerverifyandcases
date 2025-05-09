const express = require("express");
const asyncHandler = require('express-async-handler');
const ecourtsService = require('../services/ecourtsService');

const router = express.Router();

// --- Utility Function for Session Checks and Cookie Management ---
function checkSession(req) {
     if (!req.session.ecourtsState) {
        console.warn('[Server] Missing ecourtsState in session. Session not initialized.');
        return { error: 'Session expired or not initialized. Please start over.', status: 401 };
    }
    return null;
}

// --- 1. Get States (Replicates Curl 1) ---
router.get('/states', asyncHandler(async (req, res) => {
    console.log('[Server] GET /states');
    try {
        // Call the new service function
        const { states, cookies } = await ecourtsService.getStatesAndDistrictLinks();

        // Store state data and initial cookies in session
        req.session.ecourtsState = {
            cookies: cookies,
            states: states, // Store the list of states and their links
            selectedStateLink: null, // To be set later
            selectedDistrictCourtUrl: null, // To be set later
            scid: null, // To be set later
            token: null, // To be set later
            captchaValue: null, // To be provided by client
            searchResults: null // To be set later
        };


        req.session.save(err => {
            if (err) {
                console.error('[Server] Error saving session after state fetch:', err);
                return res.status(500).json({ error: 'Failed to save session' });
            }
            console.log('[Server] Session initialized with states and cookies.');
            // Return just the state names and codes/links to the client
            res.json({ states: states.map(s => ({ name: s.name, state_code: s.state_code })) });
        });

    } catch (error) {
        console.error('[Server] Error in /states route:', error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch states from eCourts' });
    }
}));

// --- 2. Get Districts (Replicates Curl 2) ---
router.post('/districts', asyncHandler(async (req, res) => {
    console.log('[Server] POST /districts');
     const sessionError = checkSession(req);
     if (sessionError) {
         return res.status(sessionError.status).json({ error: sessionError.error });
     }

     const { state_code } = req.body; // Client sends the state code selected

    if (!state_code) {
        return res.status(400).json({ error: 'Missing state_code in request body' });
    }

    // Find the state link from the session data
    const selectedState = req.session.ecourtsState.states.find(s => s.state_code === state_code);

     if (!selectedState) {
         console.warn(`[Server] Invalid state_code received: ${state_code}`);
         return res.status(400).json({ error: 'Invalid state_code' });
     }

    try {
        // Call the new service function using the state link and current cookies
        const { districts, cookies } = await ecourtsService.getDistrictsForState(selectedState.link, req.session.ecourtsState.cookies);

         // Store the selected state link and updated cookies in session
         req.session.ecourtsState.selectedStateLink = selectedState.link;
         req.session.ecourtsState.cookies = cookies;
         req.session.ecourtsState.districts = districts; // Store districts for potential later use (e.g., mapping district code to URL)


        req.session.save(err => {
            if (err) {
                 console.error('[Server] Error saving session after district fetch:', err);
                 return res.status(500).json({ error: 'Failed to save session' });
            }
            console.log('[Server] Session updated with districts and selected state link.');
            // Return the list of districts to the client
            res.json({ districts: districts });
        });

    } catch (error) {
        console.error('[Server] Error in /districts route:', error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch districts for state' });
    }
}));

// --- 3. Initialize Case Search (Replicates Curl 3) ---
// This step requires the client to provide the selected district code.
// We need to figure out the district court's base URL (e.g., https://lucknow.dcourts.gov.in)
// based on the selected district. This mapping is NOT present in the curls 1 and 2 response.
// You might need a separate mapping or another step to get this URL.
// For now, let's assume the client sends the `districtCourtBaseUrl`.
router.post('/case-search-init', asyncHandler(async (req, res) => {
     console.log('[Server] POST /case-search-init');
     const sessionError = checkSession(req);
     if (sessionError) {
         return res.status(sessionError.status).json({ error: sessionError.error });
     }

     // Assume client sends the base URL of the selected district court website
     // In a real app, you might need to lookup this URL based on the district code selected previously
     const { districtCourtBaseUrl } = req.body;

     if (!districtCourtBaseUrl) {
         return res.status(400).json({ error: 'Missing districtCourtBaseUrl in request body' });
     }

    try {
        // Call the new service function to get scid and token
        const { scid, token, cookies } = await ecourtsService.getCaseSearchPageData(districtCourtBaseUrl, req.session.ecourtsState.cookies);

         // Store extracted data and updated cookies in session
         req.session.ecourtsState.selectedDistrictCourtUrl = districtCourtBaseUrl;
         req.session.ecourtsState.scid = scid;
         req.session.ecourtsState.token = token; // Store token name and value
         req.session.ecourtsState.cookies = cookies;


        req.session.save(err => {
            if (err) {
                 console.error('[Server] Error saving session after case search init:', err);
                 return res.status(500).json({ error: 'Failed to save session' });
            }
            console.log('[Server] Session updated with scid, token, and district court URL.');
            // Return scid and token name (value is kept on server) to the client, client needs scid to request captcha
            res.json({ scid: scid, tokenName: token.name }); // Client needs scid to request captcha image
        });

    } catch (error) {
        console.error('[Server] Error in /case-search-init route:', error.message);
         res.status(500).json({ error: error.message || 'Failed to initialize case search' });
    }
}));


// --- 4. Get Captcha Image (Replicates Curl 4) ---
// Client requests this after getting scid from /case-search-init
router.get('/captcha/:scid', asyncHandler(async (req, res) => {
     console.log('[Server] GET /captcha');
     const sessionError = checkSession(req);
     if (sessionError) {
         return res.status(sessionError.status).json({ error: sessionError.error });
     }

     const { scid } = req.params; // Get scid from URL parameter

     // Verify scid matches the one in session (optional but good practice)
     if (req.session.ecourtsState.scid !== scid) {
         console.warn('[Server] Captcha request scid mismatch with session.');
          // Decide how to handle mismatch - could be session issue or invalid request
          // For now, let's use the one from the session to proceed if session exists
          console.warn('[Server] Using scid from session instead of request param.');
          // return res.status(400).json({ error: 'Invalid scid' }); // Strict check
     }

     const currentScid = req.session.ecourtsState.scid;
     const districtCourtBaseUrl = req.session.ecourtsState.selectedDistrictCourtUrl;


     if (!currentScid || !districtCourtBaseUrl) {
          console.warn('[Server] Missing scid or districtCourtBaseUrl in session for captcha request.');
          return res.status(400).json({ error: 'Case search not initialized. Please go back and select district.' });
     }


    try {
        // Call the new service function to get image data
        const { imageData, cookies } = await ecourtsService.getCaptchaImage(districtCourtBaseUrl, currentScid, req.session.ecourtsState.cookies);

         // Update cookies in session
         req.session.ecourtsState.cookies = cookies;

        req.session.save(err => {
            if (err) {
                 console.error('[Server] Error saving session after captcha fetch:', err);
                 // Continue anyway, captcha might still work with old cookies
            }
             console.log('[Server] Session updated after captcha request.');
             // Set content type to image and send the binary data
             res.setHeader('Content-Type', 'image/png'); // Assuming PNG, verify actual type
             res.send(imageData);
        });


    } catch (error) {
        console.error('[Server] Error in /captcha route:', error.message);
         res.status(500).json({ error: error.message || 'Failed to fetch captcha image' });
    }
}));


// --- 5. Submit Case Search Form (Replicates Curl 5) ---
// Client sends search parameters and the solved captcha value
router.post('/search-case', asyncHandler(async (req, res) => {
     console.log('[Server] POST /search-case');
     const sessionError = checkSession(req);
     if (sessionError) {
         return res.status(sessionError.status).json({ error: sessionError.error });
     }

     // Client provides the search criteria and the solved captcha
     const { captchaValue, ...searchParams } = req.body;

     const { selectedDistrictCourtUrl, scid, token, cookies } = req.session.ecourtsState;

     // Check if required session data is present
     if (!selectedDistrictCourtUrl || !scid || !token || !cookies) {
         console.warn('[Server] Missing required data in session for search submission.');
         return res.status(400).json({ error: 'Case search not initialized or session incomplete. Please start over.' });
     }

    if (!captchaValue || Object.keys(searchParams).length === 0) {
        return res.status(400).json({ error: 'Missing captcha value or search parameters in request body' });
    }


    try {
        // Call the new service function to submit the form
        const { results, cookies: updatedCookies } = await ecourtsService.submitCaseSearch(
            selectedDistrictCourtUrl,
            scid,
            token, // Pass the token object {name, value}
            captchaValue,
            searchParams, // Pass the search parameters from client
            cookies
        );

         // Store results and updated cookies in session (optional, depends on app flow)
         req.session.ecourtsState.searchResults = results;
         req.session.ecourtsState.cookies = updatedCookies;

        req.session.save(err => {
            if (err) {
                 console.error('[Server] Error saving session after search submit:', err);
                 // Continue anyway, client has the results
            }
             console.log('[Server] Session updated after search submit.');
             // Return the search results to the client
             res.json({ results: results });
        });


    } catch (error) {
        console.error('[Server] Error in /search-case route:', error.message);
         res.status(500).json({ error: error.message || 'Failed to submit case search' });
    }
}));


// Remove old routes or logic not matching the curl flow
// router.get('/initial-data', ...) - Replaced by /states
// router.post('/districts', ...) - Replaced by /districts
// router.post('/complexes', ...) - This step is not in the curl flow, remove or adjust if needed for district URL mapping
// router.post('/set-location', ...) - This step is not in the curl flow, remove


module.exports = router;