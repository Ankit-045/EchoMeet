const rateLimit = require('express-rate-limit');

// Auth endpoints — stricter limit to prevent brute force
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts per minute
  message: { error: 'Too many attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Summary generation — expensive operation
const summaryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Summary generation rate limit reached. Wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter, summaryLimiter };
