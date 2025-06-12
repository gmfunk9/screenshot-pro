import { ERROR_MESSAGES } from './constants.js';

export function requestLogger(req, _res, next) {
    const time = new Date().toISOString();
    console.log(`[${time}] ${req.method} ${req.originalUrl}`);
    next();
}

export function errorHandler(err, _req, res, _next) {
    console.error(err.stack);
    res.status(500).json({ error: ERROR_MESSAGES.GENERIC_ERROR });
}

export function corsHeaders(_req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
}

