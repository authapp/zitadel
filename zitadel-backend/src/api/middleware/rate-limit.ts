/**
 * Rate Limiting Middleware
 * 
 * Protects API from abuse by limiting requests per IP/user
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

export interface RateLimitConfig {
  windowMs?: number;           // Time window in milliseconds (default: 15 min)
  max?: number;                // Max requests per window (default: 100)
  message?: string;            // Custom error message
  standardHeaders?: boolean;   // Return rate limit info in headers (default: true)
  legacyHeaders?: boolean;     // Return X-RateLimit-* headers (default: false)
  skipSuccessfulRequests?: boolean;  // Don't count successful requests (default: false)
  skipFailedRequests?: boolean;       // Don't count failed requests (default: false)
}

/**
 * Create rate limiting middleware
 */
export function createRateLimiter(config?: RateLimitConfig): RateLimitRequestHandler {
  const defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,                   // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,      // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,       // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  };

  const mergedConfig = { ...defaultConfig, ...config };

  return rateLimit({
    windowMs: mergedConfig.windowMs,
    max: mergedConfig.max,
    message: mergedConfig.message,
    standardHeaders: mergedConfig.standardHeaders,
    legacyHeaders: mergedConfig.legacyHeaders,
    skipSuccessfulRequests: mergedConfig.skipSuccessfulRequests,
    skipFailedRequests: mergedConfig.skipFailedRequests,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'TooManyRequests',
        message: mergedConfig.message,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    },
  });
}

/**
 * Strict rate limiter for authentication endpoints
 */
export function createAuthRateLimiter(): RateLimitRequestHandler {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                     // Only 5 attempts per window
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true,  // Don't count successful logins
  });
}

/**
 * Lenient rate limiter for public endpoints
 */
export function createPublicRateLimiter(): RateLimitRequestHandler {
  return createRateLimiter({
    windowMs: 1 * 60 * 1000,   // 1 minute
    max: 30,                    // 30 requests per minute
    message: 'Too many requests, please slow down.',
  });
}
