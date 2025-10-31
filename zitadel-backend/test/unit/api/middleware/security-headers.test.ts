/**
 * Security Headers Middleware Unit Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import {
  createSecurityHeaders,
  createDevelopmentSecurityHeaders,
  createProductionSecurityHeaders,
} from '../../../../src/api/middleware/security-headers';

// Mock helmet
jest.mock('helmet', () => {
  return jest.fn((config: any) => {
    return (req: Request, res: Response, next: Function) => {
      // Store config for testing
      (req as any).__helmetConfig = config;
      
      // Simulate setting headers
      if (config.hsts !== false) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      }
      if (config.frameguard) {
        res.setHeader('X-Frame-Options', 'DENY');
      }
      if (config.hidePoweredBy !== false) {
        res.removeHeader?.('X-Powered-By');
      }
      
      next();
    };
  });
});

describe('Security Headers Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      url: '/test',
      method: 'GET',
    };
    
    mockRes = {
      setHeader: jest.fn() as any,
      removeHeader: jest.fn() as any,
    };
    
    mockNext = jest.fn() as any;
    
    jest.clearAllMocks();
  });

  describe('createSecurityHeaders', () => {
    it('should create security headers middleware', () => {
      const middleware = createSecurityHeaders();
      
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should set security headers', () => {
      const middleware = createSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalled();
    });

    it('should configure CSP by default', () => {
      const middleware = createSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.contentSecurityPolicy).toBeDefined();
      expect(config.contentSecurityPolicy.directives).toBeDefined();
    });

    it('should configure HSTS by default', () => {
      const middleware = createSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.hsts).toBeDefined();
      expect(config.hsts.maxAge).toBe(31536000);
    });

    it('should hide X-Powered-By header', () => {
      const middleware = createSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.hidePoweredBy).toBe(true);
    });

    it('should set frameguard to deny', () => {
      const middleware = createSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.frameguard).toBeDefined();
      expect(config.frameguard.action).toBe('deny');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        hsts: { maxAge: 86400 },
        frameguard: { action: 'sameorigin' },
      };
      
      const middleware = createSecurityHeaders(customConfig);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.hsts.maxAge).toBe(86400);
    });

    it('should enable XSS filter', () => {
      const middleware = createSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.xssFilter).toBe(true);
    });

    it('should set referrer policy', () => {
      const middleware = createSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.referrerPolicy).toBeDefined();
    });
  });

  describe('createDevelopmentSecurityHeaders', () => {
    it('should create lenient headers for development', () => {
      const middleware = createDevelopmentSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.contentSecurityPolicy).toBe(false);
      expect(config.hsts).toBe(false);
    });

    it('should allow cross-origin resources', () => {
      const middleware = createDevelopmentSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.crossOriginResourcePolicy).toBeDefined();
      expect(config.crossOriginResourcePolicy.policy).toBe('cross-origin');
    });

    it('should not require HTTPS in development', () => {
      const middleware = createDevelopmentSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.hsts).toBe(false);
    });
  });

  describe('createProductionSecurityHeaders', () => {
    it('should create strict headers for production', () => {
      const middleware = createProductionSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.contentSecurityPolicy).toBeDefined();
      expect(config.hsts).toBeDefined();
    });

    it('should enforce strict CSP', () => {
      const middleware = createProductionSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      const csp = config.contentSecurityPolicy.directives;
      
      expect(csp.defaultSrc).toEqual(["'self'"]);
      expect(csp.objectSrc).toEqual(["'none'"]);
      expect(csp.frameSrc).toEqual(["'none'"]);
    });

    it('should upgrade insecure requests', () => {
      const middleware = createProductionSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      const csp = config.contentSecurityPolicy.directives;
      
      expect(csp.upgradeInsecureRequests).toBeDefined();
    });

    it('should set strict HSTS', () => {
      const middleware = createProductionSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.hsts.maxAge).toBe(31536000);
      expect(config.hsts.includeSubDomains).toBe(true);
      expect(config.hsts.preload).toBe(true);
    });

    it('should deny frame embedding', () => {
      const middleware = createProductionSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      const config = (mockReq as any).__helmetConfig;
      expect(config.frameguard.action).toBe('deny');
    });
  });

  describe('header application', () => {
    it('should call next() after setting headers', () => {
      const middleware = createSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should set multiple security headers', () => {
      const middleware = createSecurityHeaders();
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalled();
    });
  });
});
