import { ERROR_MESSAGES } from './constants.js';

// Middleware for logging incoming requests
function requestLogger(req, res, next) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
}

// Middleware for handling errors
function errorHandler(err, req, res, next) {
    console.error(err.stack); // This line logs the error details
    res.status(500).json({ error: ERROR_MESSAGES.GENERIC_ERROR });
}


export { requestLogger, errorHandler };
