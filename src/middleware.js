import { ERROR_MESSAGES } from './constants.js';

// Middleware for logging incoming requests
function requestLogger(req, res, next) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
}

function corsHeaders(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.end();
        return;
    }
    next();
}

// Middleware for handling errors
function errorHandler(err, req, res, next) {
    console.error(err.stack); // This line logs the error details
    res.status(500).json({ error: ERROR_MESSAGES.GENERIC_ERROR });
}


export { requestLogger, errorHandler, corsHeaders };
