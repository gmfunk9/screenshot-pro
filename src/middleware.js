import { ERROR_MESSAGES } from './constants.js';
import { logger } from './logger.js';

export function requestLogger(req, _res, next) {
    const time = new Date().toISOString();
    logger.info('http', `${req.method} ${req.originalUrl}`, { time });
    next();
}

export function errorHandler(err, _req, res, _next) {
    logger.error('http', 'Unhandled error', { error: err.message });
    res.status(500).json({ error: ERROR_MESSAGES.GENERIC_ERROR });
}

export function corsHeaders(_req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
}
