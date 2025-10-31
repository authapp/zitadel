/**
 * Enhanced Error Handling Middleware
 * 
 * Centralized error handling with proper logging and response formatting
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { isZitadelError } from '@/zerrors/errors';

export interface ErrorHandlerConfig {
  includeStack?: boolean;
  logErrors?: boolean;
  logger?: (error: Error, req: Request) => void;
}

/**
 * Create enhanced error handling middleware
 */
export function createErrorHandler(config?: ErrorHandlerConfig): ErrorRequestHandler {
  const includeStack = config?.includeStack ?? process.env.NODE_ENV === 'development';
  const logErrors = config?.logErrors ?? true;
  const logger = config?.logger || defaultErrorLogger;

  return (err: any, req: Request, res: Response, _next: NextFunction): void => {
    // Log error if enabled
    if (logErrors) {
      logger(err, req);
    }

    // Handle Zitadel-specific errors
    if (isZitadelError(err)) {
      res.status(err.httpStatus).json({
        error: err.name,
        message: err.message,
        code: err.code,
        requestId: req.requestId,
        ...(includeStack && { stack: err.stack }),
      });
      return;
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      res.status(400).json({
        error: 'ValidationError',
        message: err.message,
        code: 'VALIDATION_FAILED',
        requestId: req.requestId,
        ...(err.errors && { details: err.errors }),
        ...(includeStack && { stack: err.stack }),
      });
      return;
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        code: 'TOKEN_INVALID',
        requestId: req.requestId,
      });
      return;
    }

    // Handle rate limit errors
    if (err.status === 429 || err.code === 'RATE_LIMIT_EXCEEDED') {
      res.status(429).json({
        error: 'TooManyRequests',
        message: err.message || 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
        requestId: req.requestId,
      });
      return;
    }

    // Default error handler
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
      error: err.name || 'InternalError',
      message: statusCode === 500 ? 'Internal server error' : err.message,
      code: err.code || 'INTERNAL_ERROR',
      requestId: req.requestId,
      ...(includeStack && { stack: err.stack }),
    });
  };
}

/**
 * Default error logger
 */
function defaultErrorLogger(error: Error, req: Request): void {
  console.error('[Error Handler]', {
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    error: error.message,
    stack: error.stack,
  });
}

/**
 * Create error handler for development (verbose)
 */
export function createDevelopmentErrorHandler(): ErrorRequestHandler {
  return createErrorHandler({
    includeStack: true,
    logErrors: true,
  });
}

/**
 * Create error handler for production (secure)
 */
export function createProductionErrorHandler(
  logger?: (error: Error, req: Request) => void
): ErrorRequestHandler {
  return createErrorHandler({
    includeStack: false,
    logErrors: true,
    logger,
  });
}

/**
 * Not Found (404) handler middleware
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
    requestId: req.requestId,
  });
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
