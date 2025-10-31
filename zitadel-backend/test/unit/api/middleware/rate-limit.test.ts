/**
 * Rate Limiting Middleware Unit Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import {
  createRateLimiter,
  createAuthRateLimiter,
  createPublicRateLimiter,
} from '../../../../src/api/middleware/rate-limit';

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  return jest.fn((config: any) => {
    // Return a middleware function that can be tested
    return (req: Request, res: Response, next: Function) => {
      // Store config for testing
      (req as any).__rateLimitConfig = config;
      
      // Simulate rate limit exceeded
      if ((req as any).__simulateRateLimit) {
        config.handler(req, res);
        return;
      }
      
      next();
    };
  });
});

describe('Rate Limiting Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      path: '/test',
      method: 'GET',
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
      setHeader: jest.fn() as any,
    };
    
    mockNext = jest.fn() as any;
    
    jest.clearAllMocks();
  });

  describe('createRateLimiter', () => {
    it('should create rate limiter with default config', () => {
      const limiter = createRateLimiter();
      
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should create rate limiter with custom config', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 50,
        message: 'Custom message',
      });
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__rateLimitConfig;
      expect(config.windowMs).toBe(60000);
      expect(config.max).toBe(50);
      expect(config.message).toBe('Custom message');
    });

    it('should allow requests under the limit', () => {
      const limiter = createRateLimiter();
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests over the limit', () => {
      const limiter = createRateLimiter({
        max: 5,
        message: 'Rate limit exceeded',
      });
      
      (mockReq as any).__simulateRateLimit = true;
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'TooManyRequests',
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use standard headers by default', () => {
      const limiter = createRateLimiter();
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__rateLimitConfig;
      expect(config.standardHeaders).toBe(true);
      expect(config.legacyHeaders).toBe(false);
    });

    it('should support skipping successful requests', () => {
      const limiter = createRateLimiter({
        skipSuccessfulRequests: true,
      });
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__rateLimitConfig;
      expect(config.skipSuccessfulRequests).toBe(true);
    });

    it('should support skipping failed requests', () => {
      const limiter = createRateLimiter({
        skipFailedRequests: true,
      });
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__rateLimitConfig;
      expect(config.skipFailedRequests).toBe(true);
    });
  });

  describe('createAuthRateLimiter', () => {
    it('should create strict rate limiter for auth', () => {
      const limiter = createAuthRateLimiter();
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__rateLimitConfig;
      expect(config.max).toBe(5);
      expect(config.windowMs).toBe(15 * 60 * 1000);  // 15 minutes
      expect(config.skipSuccessfulRequests).toBe(true);
      expect(config.message).toContain('authentication');
    });

    it('should have strict limits', () => {
      const limiter = createAuthRateLimiter();
      
      (mockReq as any).__simulateRateLimit = true;
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'TooManyRequests',
          code: 'RATE_LIMIT_EXCEEDED',
        })
      );
    });
  });

  describe('createPublicRateLimiter', () => {
    it('should create lenient rate limiter for public endpoints', () => {
      const limiter = createPublicRateLimiter();
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__rateLimitConfig;
      expect(config.max).toBe(30);
      expect(config.windowMs).toBe(1 * 60 * 1000);  // 1 minute
      expect(config.message).toContain('slow down');
    });

    it('should allow more requests than auth limiter', () => {
      const publicLimiter = createPublicRateLimiter();
      
      publicLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      const publicConfig = (mockReq as any).__rateLimitConfig;
      
      const authLimiter = createAuthRateLimiter();
      authLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      const authConfig = (mockReq as any).__rateLimitConfig;
      
      expect(publicConfig.max).toBeGreaterThan(authConfig.max);
    });
  });

  describe('error responses', () => {
    it('should return proper error structure', () => {
      const limiter = createRateLimiter({
        message: 'Too many requests',
      });
      
      (mockReq as any).__simulateRateLimit = true;
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'TooManyRequests',
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    });

    it('should return 429 status code', () => {
      const limiter = createRateLimiter();
      
      (mockReq as any).__simulateRateLimit = true;
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });
  });
});
