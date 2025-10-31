/**
 * CORS Middleware Unit Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import {
  createCorsMiddleware,
  createDevelopmentCors,
  createProductionCors,
  createDynamicCors,
} from '../../../../src/api/middleware/cors';

// Mock cors module
jest.mock('cors', () => {
  return jest.fn((options: any) => {
    return (req: Request, res: Response, next: Function) => {
      // Store options for testing
      (req as any).__corsOptions = options;
      
      // Simulate CORS headers
      if (options.origin) {
        if (typeof options.origin === 'function') {
          const origin = req.headers.origin;
          options.origin(origin, (err: Error | null, allowed?: boolean) => {
            if (err) {
              (req as any).__corsError = err;
            } else {
              res.setHeader('Access-Control-Allow-Origin', origin || '*');
            }
          });
        } else if (options.origin === true) {
          res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        } else {
          res.setHeader('Access-Control-Allow-Origin', options.origin);
        }
      }
      
      if (options.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      
      next();
    };
  });
});

describe('CORS Middleware', () => {
  let mockReq: any; // Use any to avoid session property type conflicts
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      method: 'GET',
      url: '/test',
    };
    
    mockRes = {
      setHeader: jest.fn() as any,
    };
    
    mockNext = jest.fn() as any;
    
    jest.clearAllMocks();
  });

  describe('createCorsMiddleware', () => {
    it('should create CORS middleware with default config', () => {
      const middleware = createCorsMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const options = (mockReq as any).__corsOptions;
      expect(options).toBeDefined();
      expect(options.origin).toBe('*');
      expect(options.credentials).toBe(false);
    });

    it('should allow all origins by default', () => {
      const middleware = createCorsMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*'
      );
    });

    it('should support custom origins', () => {
      const allowedOrigin = 'https://example.com';
      const middleware = createCorsMiddleware({
        origin: allowedOrigin,
      });
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        allowedOrigin
      );
    });

    it('should support credentials when enabled', () => {
      const middleware = createCorsMiddleware({
        credentials: true,
      });
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
        'true'
      );
    });

    it('should configure default allowed headers', () => {
      const middleware = createCorsMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const options = (mockReq as any).__corsOptions;
      expect(options.allowedHeaders).toContain('Content-Type');
      expect(options.allowedHeaders).toContain('Authorization');
      expect(options.allowedHeaders).toContain('X-Request-ID');
    });

    it('should configure default methods', () => {
      const middleware = createCorsMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const options = (mockReq as any).__corsOptions;
      expect(options.methods).toContain('GET');
      expect(options.methods).toContain('POST');
      expect(options.methods).toContain('PUT');
      expect(options.methods).toContain('DELETE');
    });

    it('should expose rate limit headers', () => {
      const middleware = createCorsMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const options = (mockReq as any).__corsOptions;
      expect(options.exposedHeaders).toContain('X-Request-ID');
      expect(options.exposedHeaders).toContain('X-RateLimit-Limit');
    });
  });

  describe('createDevelopmentCors', () => {
    it('should allow all origins in development', () => {
      mockReq.headers = { origin: 'http://localhost:3000' };
      const middleware = createDevelopmentCors();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const options = (mockReq as any).__corsOptions;
      expect(options.origin).toBe(true);
    });

    it('should enable credentials in development', () => {
      const middleware = createDevelopmentCors();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const options = (mockReq as any).__corsOptions;
      expect(options.credentials).toBe(true);
    });

    it('should allow all headers in development', () => {
      const middleware = createDevelopmentCors();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const options = (mockReq as any).__corsOptions;
      expect(options.allowedHeaders).toBe('*');
      expect(options.exposedHeaders).toBe('*');
    });
  });

  describe('createProductionCors', () => {
    const allowedOrigins = [
      'https://app.example.com',
      'https://admin.example.com',
    ];

    it('should validate origins against whitelist', () => {
      mockReq.headers = { origin: 'https://app.example.com' };
      const middleware = createProductionCors(allowedOrigins);
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://app.example.com'
      );
    });

    it('should reject origins not in whitelist', () => {
      mockReq.headers = { origin: 'https://evil.com' };
      const middleware = createProductionCors(allowedOrigins);
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect((mockReq as any).__corsError).toBeDefined();
      expect((mockReq as any).__corsError.message).toContain('not allowed by CORS');
    });

    it('should allow requests with no origin', () => {
      const middleware = createProductionCors(allowedOrigins);
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      // Should not have CORS error for no-origin requests
      expect((mockReq as any).__corsError).toBeUndefined();
    });

    it('should enable credentials in production', () => {
      const middleware = createProductionCors(allowedOrigins);
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const options = (mockReq as any).__corsOptions;
      expect(options.credentials).toBe(true);
    });

    it('should have shorter maxAge in production', () => {
      const middleware = createProductionCors(allowedOrigins);
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const options = (mockReq as any).__corsOptions;
      expect(options.maxAge).toBe(600); // 10 minutes
    });
  });

  describe('createDynamicCors', () => {
    it('should use custom validator function', () => {
      const validator = jest.fn((origin: string | undefined) => {
        return origin?.includes('example.com') ?? false;
      }) as any;
      
      mockReq.headers = { origin: 'https://app.example.com' };
      const middleware = createDynamicCors(validator);
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(validator).toHaveBeenCalledWith('https://app.example.com');
    });

    it('should allow origin when validator returns true', () => {
      const validator = () => true;
      mockReq.headers = { origin: 'https://test.com' };
      
      const middleware = createDynamicCors(validator);
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://test.com'
      );
    });

    it('should reject origin when validator returns false', () => {
      const validator = () => false;
      mockReq.headers = { origin: 'https://evil.com' };
      
      const middleware = createDynamicCors(validator);
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect((mockReq as any).__corsError).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle missing origin header', () => {
      const middleware = createCorsMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() after setting headers', () => {
      const middleware = createCorsMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});
