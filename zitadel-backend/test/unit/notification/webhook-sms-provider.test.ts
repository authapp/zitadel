/**
 * Webhook SMS Provider Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WebhookSMSProvider, WebhookSMSConfig } from '../../../src/lib/notification/webhook-sms-provider';
import { SMSMetadata } from '../../../src/lib/notification/sms-service';

// Mock fetch globally
const originalFetch = global.fetch;

describe('WebhookSMSProvider', () => {
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
      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
      });

      expect(provider.name).toBe('webhook');
    });

    it('should throw error without URL', () => {
      expect(() => {
        new WebhookSMSProvider({} as WebhookSMSConfig);
      }).toThrow('Webhook URL is required');
    });

    it('should accept custom configuration', () => {
      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
        method: 'PUT',
        timeout: 5000,
        retries: 3,
        headers: {
          'X-API-Key': 'secret',
        },
      });

      expect(provider.name).toBe('webhook');
    });
  });

  describe('Sending SMS', () => {
    it('should send SMS via webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
      });

      const result = await provider.sendSMS(
        '+1234567890',
        'Test message'
      );

      expect(result.messageId).toBeDefined();
      expect(result.messageId).toContain('webhook_sms_');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('https://example.com/sms/webhook');
      
      const fetchOptions = fetchCall[1];
      expect(fetchOptions.method).toBe('POST');
      expect(fetchOptions.headers['Content-Type']).toBe('application/json');
      expect(fetchOptions.headers['X-Message-ID']).toBeDefined();
    });

    it('should include SMS data in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
      });

      await provider.sendSMS('+1234567890', 'Test message');

      const fetchCall = mockFetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);

      expect(payload.to).toBe('+1234567890');
      expect(payload.message).toBe('Test message');
      expect(payload.timestamp).toBeDefined();
    });

    it('should include metadata in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
      });

      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
      };

      await provider.sendSMS('+1234567890', 'Test message', metadata);

      const fetchCall = mockFetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);

      expect(payload.metadata).toEqual(metadata);
    });

    it('should use custom HTTP method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
        method: 'PUT',
      });

      await provider.sendSMS('+1234567890', 'Test');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].method).toBe('PUT');
    });

    it('should include custom headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
        headers: {
          'X-API-Key': 'secret-key',
          'X-Custom': 'value',
        },
      });

      await provider.sendSMS('+1234567890', 'Test');

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

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
      });

      await expect(
        provider.sendSMS('+1234567890', 'Test')
      ).rejects.toThrow('Webhook request failed: 500');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
      });

      await expect(
        provider.sendSMS('+1234567890', 'Test')
      ).rejects.toThrow('Network error');
    });

    it('should handle timeout', async () => {
      mockFetch.mockImplementationOnce(() => {
        const error: any = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
        timeout: 100,
        retries: 0,
      });

      await expect(
        provider.sendSMS('+1234567890', 'Test')
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

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
        retries: 2,
      });

      const result = await provider.sendSMS('+1234567890', 'Test');

      expect(result.messageId).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Always fails'));

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
        retries: 2,
      });

      await expect(
        provider.sendSMS('+1234567890', 'Test')
      ).rejects.toThrow('Always fails');

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    }, 10000);

    it('should not retry without retries configured', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed'));

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
        retries: 0,
      });

      await expect(
        provider.sendSMS('+1234567890', 'Test')
      ).rejects.toThrow('Failed');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Metadata Support', () => {
    it('should send SMS without metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
      });

      const result = await provider.sendSMS('+1234567890', 'Test');

      expect(result.messageId).toBeDefined();

      const fetchCall = mockFetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.metadata).toBeUndefined();
    });

    it('should preserve all metadata fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const provider = new WebhookSMSProvider({
        url: 'https://example.com/sms/webhook',
      });

      const metadata: SMSMetadata = {
        instanceID: 'inst_123',
        jobID: 'job_456',
        userID: 'user_789',
        verificationID: 'verify_abc',
      };

      await provider.sendSMS('+1234567890', 'Test', metadata);

      const fetchCall = mockFetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);

      expect(payload.metadata.instanceID).toBe('inst_123');
      expect(payload.metadata.jobID).toBe('job_456');
      expect(payload.metadata.userID).toBe('user_789');
      expect(payload.metadata.verificationID).toBe('verify_abc');
    });
  });
});
