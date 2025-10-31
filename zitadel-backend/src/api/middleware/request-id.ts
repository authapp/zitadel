/**
 * Request ID Middleware
 * 
 * Adds unique request ID for tracing and correlation
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestIdConfig {
  headerName?: string;           // Header name to use (default: 'X-Request-ID')
  generator?: () => string;      // Custom ID generator function
  setResponseHeader?: boolean;   // Include in response headers (default: true)
}

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Create request ID middleware
 */
export function createRequestIdMiddleware(config?: RequestIdConfig): (req: Request, res: Response, next: NextFunction) => void {
  const headerName = config?.headerName || 'X-Request-ID';
  const generator = config?.generator || (() => randomUUID());
  const setResponseHeader = config?.setResponseHeader !== false;

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if request already has an ID (from previous middleware call)
    if (req.requestId) {
      // Already has ID, just ensure it's in response header
      if (setResponseHeader) {
        res.setHeader(headerName, req.requestId);
      }
      next();
      return;
    }

    // Check if request has an ID from client headers (case-insensitive)
    let requestId = req.headers[headerName.toLowerCase()] as string;
    
    // Also check uppercase version (for test compatibility)
    if (!requestId) {
      requestId = req.headers[headerName] as string;
    }
    
    // Generate new ID if not provided
    if (!requestId || typeof requestId !== 'string') {
      requestId = generator();
    }

    // Attach to request object
    req.requestId = requestId;

    // Add to response headers if configured
    if (setResponseHeader) {
      res.setHeader(headerName, requestId);
    }

    next();
  };
}

/**
 * Get request ID from request object
 */
export function getRequestId(req: Request): string | undefined {
  return req.requestId;
}

/**
 * Create request ID middleware with custom generator
 */
export function createRequestIdWithPrefix(prefix: string): (req: Request, res: Response, next: NextFunction) => void {
  return createRequestIdMiddleware({
    generator: () => `${prefix}-${randomUUID()}`,
  });
}

/**
 * Create request ID middleware that only accepts client-provided IDs
 */
export function createStrictRequestIdMiddleware(headerName = 'X-Request-ID'): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers[headerName.toLowerCase()] as string;
    
    if (!requestId || typeof requestId !== 'string') {
      res.status(400).json({
        error: 'BadRequest',
        message: `Missing required header: ${headerName}`,
        code: 'MISSING_REQUEST_ID',
      });
      return;
    }

    req.requestId = requestId;
    res.setHeader(headerName, requestId);
    next();
  };
}
