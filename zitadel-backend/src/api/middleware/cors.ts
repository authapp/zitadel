/**
 * Enhanced CORS Middleware
 * 
 * Configurable CORS with support for multiple origins and credentials
 */

import cors, { CorsOptions } from 'cors';
import { RequestHandler } from 'express';

export interface EnhancedCorsConfig {
  origin?: string | string[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

/**
 * Create enhanced CORS middleware
 */
export function createCorsMiddleware(config?: EnhancedCorsConfig): RequestHandler {
  const defaultConfig: CorsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-User-ID',
      'X-Instance-ID',
      'X-Org-ID',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    credentials: false,
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 204,
  };

  const mergedConfig = { ...defaultConfig, ...config };

  return cors(mergedConfig);
}

/**
 * Create CORS middleware for development (lenient)
 */
export function createDevelopmentCors(): RequestHandler {
  return cors({
    origin: true,  // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: '*',
    exposedHeaders: '*',
  });
}

/**
 * Create CORS middleware for production (strict)
 */
export function createProductionCors(allowedOrigins: string[]): RequestHandler {
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-User-ID',
      'X-Instance-ID',
      'X-Org-ID',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
    ],
    maxAge: 600, // 10 minutes in production
    optionsSuccessStatus: 204,
  });
}

/**
 * Create CORS middleware with dynamic origin validation
 */
export function createDynamicCors(
  originValidator: (origin: string | undefined) => boolean
): RequestHandler {
  return cors({
    origin: (origin, callback) => {
      if (originValidator(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  });
}
