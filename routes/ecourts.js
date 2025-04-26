const express = require("express");
const asyncHandler = require('express-async-handler'); // Keep using this for cleaner async error handling
const ecourtsService = require('../services/ecourtsService'); // Correct path to your service file

const router = express.Router();

// Middleware to check if session is initialized (optional but good practice)
// router.use((req, res, next) => {
//     if (!req.session) {
//         console.error('[Server] Session middleware not configured correctly!');
//         return res.status(500).json({ error: 'Session not available.' });
//     }
//     next();
// });

// --- 1. Get Initial Cookies and Token ---
router.get('/initial-data', asyncHandler(async (req, res) => {
    console.log('[Server] GET /initial-data');
    try {
        const { cookies, app_token } = await ecourtsService.getInitialData();

        // Store BOTH cookies and the first token in the session
        req.session.initialCookies = cookies;
        req.session.lastAppToken = app_token; // Store the token needed for the *next* step

        // Save session explicitly to ensure data is stored before responding
        req.session.save(err => {
            if (err) {
                console.error('[Server] Error saving session after initial data fetch:', err);
                return res.status(500).json({ error: 'Failed to save session' });
            }
            console.log('[Server] Session cookies stored:', req.session.initialCookies);
            console.log('[Server] Session initial app_token stored:', req.session.lastAppToken);
            // Send only the token the client needs for the *next* request (e.g., getting districts)
            res.json({ app_token });
        });

    } catch (error) {
        console.error('[Server] Error in /initial-data route:', error.message);
        // Send a generic error, service layer logged details
        res.status(500).json({ error: error.message || 'Failed to fetch initial eCourts data' });
    }
}));

// --- Utility Function for Session Checks ---
function checkSession(req) {
    if (!req.session.initialCookies) {
        console.warn('[Server] Missing initialCookies in session.');
        return { error: 'Session expired or not initialized. Please start over.', status: 401 };
    }
    if (!req.session.lastAppToken) {
        console.warn('[Server] Missing lastAppToken in session.');
        // This might happen if a previous step failed silently
         return { error: 'Missing required token in session. Please try the previous step again.', status: 400 };
    }
    return null; // No error
}


// --- 2. Get Districts ---
router.post('/districts', asyncHandler(async (req, res) => {
    console.log('[Server] POST /districts');
    const sessionError = checkSession(req);
    if (sessionError) {
        return res.status(sessionError.status).json({ error: sessionError.error });
    }

    const { state_code, app_token: clientToken } = req.body; // Get state_code and token from client

    // Basic validation
    if (!state_code) {
        return res.status(400).json({ error: 'Missing state_code in request body' });
    }
     if (!clientToken) {
        return res.status(400).json({ error: 'Missing app_token in request body' });
    }
    // Optional: Verify client token matches the one expected from the previous step in session?
    // if (clientToken !== req.session.lastAppToken) {
    //     console.warn(`[Server] Token mismatch: Client sent ${clientToken}, session expected ${req.session.lastAppToken}`);
    //     // Decide how strict to be - maybe allow if client has *a* token?
    //     // return res.status(400).json({ error: 'Token mismatch or out of sequence request.' });
    // }


    try {
        const sessionCookies = req.session.initialCookies;
        // Use the token provided by the client for *this* request
        const result = await ecourtsService.getDistricts({
            state_code,
            app_token: clientToken, // Use the token client sent (should be from /initial-data)
            cookies: sessionCookies
        });

        // IMPORTANT: Update the session with the *new* token received for the *next* step
        if (result.next_app_token) {
             req.session.lastAppToken = result.next_app_token;
             console.log('[Server] Updated session lastAppToken after /districts:', req.session.lastAppToken);
        } else {
             console.warn('[Server] No next_app_token received from getDistricts service call.');
             // If no token, the next call might fail. Keep the old one? Or clear it?
             // Let's keep the old one for now, maybe it's reusable? Or maybe next call doesn't need one?
        }

        req.session.save(err => {
             if (err) {
                 console.error('[Server] Error saving session after /districts:', err);
                 // Proceed but log error, or return 500? Let's proceed for now.
             }
             // Send district data AND the token needed for the *next* client request
             res.json({ districts: result.data, app_token: result.next_app_token || clientToken }); // Send back the new token
        });

    } catch (error) {
        console.error('[Server] Error in /districts route:', error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch districts' });
    }
}));


// --- 3. Get Complexes ---
router.post('/complexes', asyncHandler(async (req, res) => {
     console.log('[Server] POST /complexes');
    const sessionError = checkSession(req);
    if (sessionError) {
        return res.status(sessionError.status).json({ error: sessionError.error });
    }

    // Client needs to send state, district, and the token from the *previous* step (/districts)
    const { state_code, dist_code, app_token: clientToken } = req.body;

    if (!state_code || !dist_code || !clientToken) {
        return res.status(400).json({ error: 'Missing parameters: state_code, dist_code, or app_token' });
    }
    // Optional: Check clientToken against req.session.lastAppToken here too

    try {
        const sessionCookies = req.session.initialCookies;
        const result = await ecourtsService.getComplexes({
            state_code,
            dist_code,
            app_token: clientToken, // Use token from client (should be from /districts response)
            cookies: sessionCookies
        });

        if (result.next_app_token) {
            req.session.lastAppToken = result.next_app_token;
            console.log('[Server] Updated session lastAppToken after /complexes:', req.session.lastAppToken);
        } else {
             console.warn('[Server] No next_app_token received from getComplexes service call.');
        }

         req.session.save(err => {
             if (err) console.error('[Server] Error saving session after /complexes:', err);
             // Send complex data and the token for the *next* step
             res.json({ complexes: result.data, app_token: result.next_app_token || clientToken });
        });

    } catch (error) {
        console.error('[Server] Error in /complexes route:', error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch court complexes' });
    }
}));


// --- 4. Set Location ---
router.post('/set-location', asyncHandler(async (req, res) => {
    console.log('[Server] POST /set-location');
    const sessionError = checkSession(req);
    if (sessionError) {
        return res.status(sessionError.status).json({ error: sessionError.error });
    }

    // Client sends selected codes and the token from the *previous* step (/complexes)
    const { complex_code, selected_state_code, selected_dist_code, selected_est_code, app_token: clientToken } = req.body;

     if (!complex_code || !selected_state_code || !selected_dist_code || !clientToken) {
        return res.status(400).json({ error: 'Missing parameters: complex_code, selected_state_code, selected_dist_code, or app_token' });
    }
     // Note: selected_est_code might be optional or null

    try {
        const sessionCookies = req.session.initialCookies;
        const result = await ecourtsService.setLocation({
            complex_code,
            selected_state_code,
            selected_dist_code,
            selected_est_code, // Pass it along (can be null/undefined)
            app_token: clientToken, // Use token from client (should be from /complexes response)
            cookies: sessionCookies
        });

         if (result.next_app_token) {
            req.session.lastAppToken = result.next_app_token;
            console.log('[Server] Updated session lastAppToken after /set-location:', req.session.lastAppToken);
        } else {
             console.warn('[Server] No next_app_token received from setLocation service call.');
        }

        req.session.save(err => {
             if (err) console.error('[Server] Error saving session after /set-location:', err);
             // Send confirmation/data and the token for the *next* step (fetching captcha)
             res.json({ result: result.data, app_token: result.next_app_token || clientToken });
        });

    } catch (error) {
        console.error('[Server] Error in /set-location route:', error.message);
        res.status(500).json({ error: error.message || 'Failed to set location' });
    }
}));


// --- 5. Fetch Captcha (for User Input) ---
// Changed route name slightly for clarity
router.post('/fetch-user-captcha', asyncHandler(async (req, res) => {
     console.log('[Server] POST /fetch-user-captcha');
    const sessionError = checkSession(req);
    if (sessionError) {
        return res.status(sessionError.status).json({ error: sessionError.error });
    }

    // Client sends the token from the *previous* step (/set-location)
    const { app_token: clientToken } = req.body;
    if (!clientToken) {
         return res.status(400).json({ error: 'Missing app_token in request body' });
    }

    try {
        const sessionCookies = req.session.initialCookies;
        const result = await ecourtsService.fetchCaptcha({
             app_token: clientToken, // Use token from client (should be from /set-location response)
             cookies: sessionCookies
        });

        if (result.next_app_token) {
            req.session.lastAppToken = result.next_app_token;
            console.log('[Server] Updated session lastAppToken after /fetch-user-captcha:', req.session.lastAppToken);
        } else {
             console.warn('[Server] No next_app_token received from fetchCaptcha service call.');
             // This might be okay if the search uses the *same* token as captcha fetch,
             // but the cURL suggests getCaptcha provides the token FOR submitPartyName.
             // If no token received here, the final search might fail.
        }


        req.session.save(err => {
             if (err) console.error('[Server] Error saving session after /fetch-user-captcha:', err);
             // Send image URL and the token for the *final* search step
             if (!result.imageUrl) {
                 console.error('[Server] Failed to extract captcha image URL in route.');
                 return res.status(500).json({ error: 'Failed to retrieve captcha image URL' });
             }
             res.json({ imageUrl: result.imageUrl, app_token: result.next_app_token || clientToken });
        });

    } catch (error) {
        console.error('[Server] Error in /fetch-user-captcha route:', error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch captcha' });
    }
}));


// --- 6. Submit Party Search ---
router.post('/search-party', asyncHandler(async (req, res) => {
    console.log('[Server] POST /search-party');
    const sessionError = checkSession(req);
    if (sessionError) {
        return res.status(sessionError.status).json({ error: sessionError.error });
    }

    // Client sends search parameters, user captcha, and the token from the *previous* step (/fetch-user-captcha)
    const {
        petres_name, rgyearP, case_status, fcaptcha_code,
        state_code, dist_code, court_complex_code, // These should ideally match the set location
        app_token: clientToken
    } = req.body;

    // Validate required fields
    if (!petres_name || !rgyearP || !fcaptcha_code || !state_code || !dist_code || !court_complex_code || !clientToken) {
        return res.status(400).json({ error: 'Missing required parameters for party search' });
    }

    try {
        const sessionCookies = req.session.initialCookies;
        // Call the correct service function: submitPartySearch
        const result = await ecourtsService.submitPartySearch({
            petres_name,
            rgyearP,
            case_status: case_status || 'Pending', // Default if not provided
            fcaptcha_code,
            state_code,
            dist_code,
            court_complex_code,
            // est_code might be needed? Check cURL and API requirements
            app_token: clientToken, // Use token from client (should be from /fetch-user-captcha response)
            cookies: sessionCookies
        });

        // Do we get another token? Update session if so, though it might not be needed by client now.
         if (result.next_app_token) {
            req.session.lastAppToken = result.next_app_token;
            console.log('[Server] Updated session lastAppToken after /search-party:', req.session.lastAppToken);
            req.session.save(err => { // Save the potentially final token
                 if (err) console.error('[Server] Error saving session after /search-party:', err);
            });
        } else {
             console.log('[Server] No further app_token received from submitPartySearch.');
             // Clear the token maybe? Or leave the last one?
             // req.session.lastAppToken = null; // Optional cleanup
        }


        // Send back the final search results
        // The format of result.data needs inspection (HTML? JSON?)
        res.json({ results: result.data });

    } catch (error) {
        console.error('[Server] Error in /search-party route:', error.message);
        // Check if the error message contains useful info from eCourts (e.g., "Captcha code does not match")
        // The service layer already logged details. Send specific message if possible.
        if (error.message.includes('eCourts API error')) {
             res.status(502).json({ error: error.message }); // 502 Bad Gateway might be appropriate
        } else {
            res.status(500).json({ error: 'Failed to perform party search' });
        }
    }
}));


module.exports = router;