/**
 * Webhook Email Provider Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebhookEmailProvider, WebhookConfig } from '../../../src/lib/notification/webhook-email-provider';

// Mock fetch globally
const originalFetch = global.fetch;

describe('WebhookEmailProvider', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Configuration', () => {
    it('should create provider with minimal config', () => {
      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
      });

      expect(provider.name).toBe('webhook');
    });

    it('should throw error without URL', () => {
      expect(() => {
        new WebhookEmailProvider({} as WebhookConfig);
      }).toThrow('Webhook URL is required');
    });

    it('should use default values', () => {
      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
      });

      expect(provider).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
        method: 'PUT',
        timeout: 5000,
        retries: 3,
        headers: {
          'X-Custom-Header': 'value',
        },
      });

      expect(provider.name).toBe('webhook');
    });
  });

  describe('Sending Emails', () => {
    it('should send email via webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
      });

      const result = await provider.sendEmail(
        'test@example.com',
        'Test Subject',
        'Test Body'
      );

      expect(result.messageId).toBeDefined();
      expect(result.messageId).toContain('webhook_');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('https://example.com/webhook');
      
      const fetchOptions = fetchCall[1];
      expect(fetchOptions.method).toBe('POST');
      expect(fetchOptions.headers['Content-Type']).toBe('application/json');
      expect(fetchOptions.headers['X-Message-ID']).toBeDefined();
    });

    it('should include all email fields in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
      });

      await provider.sendEmail(
        ['test1@example.com', 'test2@example.com'],
        'Test Subject',
        'Test Body',
        '<p>Test HTML</p>',
        ['cc@example.com'],
        ['bcc@example.com']
      );

      const fetchCall = mockFetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);

      expect(payload.to).toEqual(['test1@example.com', 'test2@example.com']);
      expect(payload.subject).toBe('Test Subject');
      expect(payload.body).toBe('Test Body');
      expect(payload.html).toBe('<p>Test HTML</p>');
      expect(payload.cc).toEqual(['cc@example.com']);
      expect(payload.bcc).toEqual(['bcc@example.com']);
      expect(payload.timestamp).toBeDefined();
    });

    it('should use custom HTTP method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
        method: 'PUT',
      });

      await provider.sendEmail('test@example.com', 'Subject', 'Body');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].method).toBe('PUT');
    });

    it('should include custom headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
        headers: {
          'X-API-Key': 'secret-key',
          'X-Custom': 'value',
        },
      });

      await provider.sendEmail('test@example.com', 'Subject', 'Body');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers['X-API-Key']).toBe('secret-key');
      expect(fetchCall[1].headers['X-Custom']).toBe('value');
    });
  });

  describe('Error Handling', () => {
    it('should throw on HTTP error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error details',
      });

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
      });

      await expect(
        provider.sendEmail('test@example.com', 'Subject', 'Body')
      ).rejects.toThrow('Webhook request failed: 500');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
      });

      await expect(
        provider.sendEmail('test@example.com', 'Subject', 'Body')
      ).rejects.toThrow('Network error');
    });

    it('should handle timeout', async () => {
      // Mock fetch to reject with abort error after delay
      mockFetch.mockImplementationOnce(() => {
        const error: any = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
        timeout: 100,
        retries: 0,
      });

      await expect(
        provider.sendEmail('test@example.com', 'Subject', 'Body')
      ).rejects.toThrow('timeout');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
        retries: 2,
      });

      const result = await provider.sendEmail('test@example.com', 'Subject', 'Body');

      expect(result.messageId).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Always fails'));

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
        retries: 2,
      });

      await expect(
        provider.sendEmail('test@example.com', 'Subject', 'Body')
      ).rejects.toThrow('Always fails');

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    }, 10000);

    it('should not retry without retries configured', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed'));

      const provider = new WebhookEmailProvider({
        url: 'https://example.com/webhook',
        retries: 0,
      });

      await expect(
        provider.sendEmail('test@example.com', 'Subject', 'Body')
      ).rejects.toThrow('Failed');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
