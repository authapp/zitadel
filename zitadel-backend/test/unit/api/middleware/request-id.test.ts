/**
 * Request ID Middleware Unit Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import {
  createRequestIdMiddleware,
  getRequestId,
  createRequestIdWithPrefix,
  createStrictRequestIdMiddleware,
} from '../../../../src/api/middleware/request-id';

describe('Request ID Middleware', () => {
  let mockReq: any; // Use any to avoid session property type conflicts
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      url: '/test',
      method: 'GET',
    };
    
    mockRes = {
      setHeader: jest.fn() as any,
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    
    mockNext = jest.fn() as any;
    
    jest.clearAllMocks();
  });

  describe('createRequestIdMiddleware', () => {
    it('should generate request ID if not provided', () => {
      const middleware = createRequestIdMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockReq.requestId).toBeDefined();
      expect(typeof mockReq.requestId).toBe('string');
      expect(mockReq.requestId?.length).toBeGreaterThan(0);
    });

    it('should use existing request ID from header', () => {
      const existingId = 'existing-request-id-123';
      mockReq.headers = { 'x-request-id': existingId };
      
      const middleware = createRequestIdMiddleware();
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockReq.requestId).toBe(existingId);
    });

    it('should set request ID in response header by default', () => {
      const middleware = createRequestIdMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        expect.any(String)
      );
    });

    it('should not set response header if disabled', () => {
      const middleware = createRequestIdMiddleware({
        setResponseHeader: false,
      });
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it('should use custom header name', () => {
      const customHeader = 'X-Correlation-ID';
      const middleware = createRequestIdMiddleware({
        headerName: customHeader,
      });
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        customHeader,
        expect.any(String)
      );
    });

    it('should use custom generator function', () => {
      const customId = 'custom-generated-id';
      const middleware = createRequestIdMiddleware({
        generator: () => customId,
      });
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockReq.requestId).toBe(customId);
    });

    it('should call next() after setting ID', () => {
      const middleware = createRequestIdMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle case-insensitive headers', () => {
      const existingId = 'test-id-456';
      mockReq.headers = { 'X-Request-ID': existingId };
      
      const middleware = createRequestIdMiddleware();
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockReq.requestId).toBe(existingId);
    });

    it('should generate UUID format by default', () => {
      const middleware = createRequestIdMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(mockReq.requestId).toMatch(uuidRegex);
    });
  });

  describe('getRequestId', () => {
    it('should return request ID from request object', () => {
      mockReq.requestId = 'test-request-id';
      
      const id = getRequestId(mockReq);
      
      expect(id).toBe('test-request-id');
    });

    it('should return undefined if no request ID', () => {
      const id = getRequestId(mockReq);
      
      expect(id).toBeUndefined();
    });
  });

  describe('createRequestIdWithPrefix', () => {
    it('should create middleware with custom prefix', () => {
      const prefix = 'api';
      const middleware = createRequestIdWithPrefix(prefix);
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockReq.requestId).toBeDefined();
      expect(mockReq.requestId?.startsWith(`${prefix}-`)).toBe(true);
    });

    it('should generate UUID after prefix', () => {
      const prefix = 'zitadel';
      const middleware = createRequestIdWithPrefix(prefix);
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      const parts = mockReq.requestId?.split('-');
      expect(parts?.[0]).toBe(prefix);
      expect(parts?.length).toBeGreaterThan(1);
    });
  });

  describe('createStrictRequestIdMiddleware', () => {
    it('should require request ID from client', () => {
      const middleware = createStrictRequestIdMiddleware();
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'BadRequest',
        message: 'Missing required header: X-Request-ID',
        code: 'MISSING_REQUEST_ID',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept client-provided request ID', () => {
      const clientId = 'client-request-id-789';
      mockReq.headers = { 'x-request-id': clientId };
      
      const middleware = createStrictRequestIdMiddleware();
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockReq.requestId).toBe(clientId);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should use custom header name', () => {
      const customHeader = 'X-Trace-ID';
      const middleware = createStrictRequestIdMiddleware(customHeader);
      
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Missing required header: ${customHeader}`,
        })
      );
    });

    it('should set response header when ID provided', () => {
      const clientId = 'valid-id';
      mockReq.headers = { 'x-request-id': clientId };
      
      const middleware = createStrictRequestIdMiddleware();
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', clientId);
    });
  });

  describe('edge cases', () => {
    it('should handle non-string header values', () => {
      mockReq.headers = { 'x-request-id': ['array', 'value'] as any };
      
      const middleware = createRequestIdMiddleware();
      middleware(mockReq, mockRes as Response, mockNext);
      
      // Should generate new ID
      expect(mockReq.requestId).toBeDefined();
      expect(typeof mockReq.requestId).toBe('string');
    });

    it('should handle empty string header', () => {
      mockReq.headers = { 'x-request-id': '' };
      
      const middleware = createRequestIdMiddleware();
      middleware(mockReq, mockRes as Response, mockNext);
      
      // Should generate new ID
      expect(mockReq.requestId).toBeDefined();
      expect(mockReq.requestId?.length).toBeGreaterThan(0);
    });

    it('should handle multiple calls with same request', () => {
      const middleware = createRequestIdMiddleware();
      
      // First call
      middleware(mockReq, mockRes as Response, mockNext);
      const firstId = mockReq.requestId;
      
      // Second call should not change ID
      middleware(mockReq, mockRes as Response, mockNext);
      
      expect(mockReq.requestId).toBe(firstId);
    });
  });
});
