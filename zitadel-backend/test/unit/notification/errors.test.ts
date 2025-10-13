/**
 * Notification Error Types Tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  NotificationError,
  CancellableError,
  RetryableError,
  ProviderNotAvailableError,
  InvalidRecipientError,
  ConfigurationError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ServerError,
  NotificationErrorFactory,
} from '../../../src/lib/notification/errors';

describe('Notification Errors', () => {
  describe('NotificationError', () => {
    it('should create base notification error', () => {
      const error = new NotificationError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NotificationError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('NotificationError');
    });

    it('should support details', () => {
      const details = { key: 'value', count: 42 };
      const error = new NotificationError('Test', 'CODE', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('CancellableError', () => {
    it('should create cancellable error', () => {
      const error = new CancellableError('Cannot retry', 'CANCEL_CODE');

      expect(error).toBeInstanceOf(CancellableError);
      expect(error).toBeInstanceOf(NotificationError);
      expect(error.message).toBe('Cannot retry');
      expect(error.name).toBe('CancellableError');
    });

    it('should identify cancellable errors', () => {
      const cancellable = new CancellableError('Test');
      const regular = new Error('Test');

      expect(CancellableError.isCancellable(cancellable)).toBe(true);
      expect(CancellableError.isCancellable(regular)).toBe(false);
    });
  });

  describe('RetryableError', () => {
    it('should create retryable error', () => {
      const error = new RetryableError('Retry me', 5000, 'RETRY_CODE');

      expect(error).toBeInstanceOf(RetryableError);
      expect(error.retryAfter).toBe(5000);
      expect(error.name).toBe('RetryableError');
    });

    it('should identify retryable errors', () => {
      const retryable = new RetryableError('Test');
      const regular = new Error('Test');

      expect(RetryableError.isRetryable(retryable)).toBe(true);
      expect(RetryableError.isRetryable(regular)).toBe(false);
    });

    it('should work without retryAfter', () => {
      const error = new RetryableError('Test');

      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('ProviderNotAvailableError', () => {
    it('should create provider error', () => {
      const error = new ProviderNotAvailableError('twilio');

      expect(error).toBeInstanceOf(CancellableError);
      expect(error.message).toContain('twilio');
      expect(error.code).toBe('PROVIDER_NOT_AVAILABLE');
    });
  });

  describe('InvalidRecipientError', () => {
    it('should create invalid recipient error', () => {
      const error = new InvalidRecipientError('+invalid', 'wrong format');

      expect(error).toBeInstanceOf(CancellableError);
      expect(error.message).toContain('+invalid');
      expect(error.message).toContain('wrong format');
      expect(error.code).toBe('INVALID_RECIPIENT');
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Missing API key');

      expect(error).toBeInstanceOf(CancellableError);
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError(60000);

      expect(error).toBeInstanceOf(RetryableError);
      expect(error.retryAfter).toBe(60000);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const error = new NetworkError('Connection failed');

      expect(error).toBeInstanceOf(RetryableError);
      expect(error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError(30000);

      expect(error).toBeInstanceOf(RetryableError);
      expect(error.message).toContain('30000');
      expect(error.code).toBe('TIMEOUT');
      expect(error.details?.timeoutMs).toBe(30000);
    });
  });

  describe('ServerError', () => {
    it('should create server error', () => {
      const error = new ServerError('Internal server error', 500);

      expect(error).toBeInstanceOf(RetryableError);
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('SERVER_ERROR');
    });
  });

  describe('NotificationErrorFactory', () => {
    describe('fromHttpStatus', () => {
      it('should create cancellable error for 4xx status', () => {
        const error = NotificationErrorFactory.fromHttpStatus(
          400,
          'Bad request'
        );

        expect(error).toBeInstanceOf(CancellableError);
      });

      it('should create rate limit error for 429', () => {
        const error = NotificationErrorFactory.fromHttpStatus(
          429,
          'Too many requests'
        );

        expect(error).toBeInstanceOf(RateLimitError);
      });

      it('should create invalid recipient error for 400', () => {
        const error = NotificationErrorFactory.fromHttpStatus(
          400,
          'Invalid phone',
          { recipient: '+123' }
        );

        expect(error).toBeInstanceOf(InvalidRecipientError);
      });

      it('should create server error for 5xx status', () => {
        const error = NotificationErrorFactory.fromHttpStatus(
          500,
          'Server error'
        );

        expect(error).toBeInstanceOf(ServerError);
        expect((error as ServerError).statusCode).toBe(500);
      });

      it('should create generic error for other statuses', () => {
        const error = NotificationErrorFactory.fromHttpStatus(
          301,
          'Redirect'
        );

        expect(error).toBeInstanceOf(NotificationError);
        expect(error.code).toBe('HTTP_301');
      });
    });

    describe('fromTwilioError', () => {
      it('should handle Twilio HTTP status errors', () => {
        const twilioError = {
          status: 400,
          message: 'Invalid phone number',
          code: 21211,
        };

        const error = NotificationErrorFactory.fromTwilioError(twilioError);

        expect(error).toBeInstanceOf(InvalidRecipientError);
      });

      it('should handle Twilio error codes', () => {
        const twilioError = {
          code: 21614,
          message: 'Invalid To phone number',
        };

        const error = NotificationErrorFactory.fromTwilioError(twilioError);

        expect(error).toBeInstanceOf(NotificationError);
        expect(error.message).toContain('Invalid');
      });

      it('should handle authentication errors', () => {
        const twilioError = {
          code: 20003,
          message: 'Authentication failed',
        };

        const error = NotificationErrorFactory.fromTwilioError(twilioError);

        expect(error).toBeInstanceOf(NotificationError);
        expect(error.message).toContain('Authentication');
      });
    });

    describe('shouldRetry', () => {
      it('should not retry cancellable errors', () => {
        const error = new CancellableError('Test');

        expect(NotificationErrorFactory.shouldRetry(error)).toBe(false);
      });

      it('should retry retryable errors', () => {
        const error = new RetryableError('Test');

        expect(NotificationErrorFactory.shouldRetry(error)).toBe(true);
      });

      it('should not retry unknown errors', () => {
        const error = new Error('Unknown');

        expect(NotificationErrorFactory.shouldRetry(error)).toBe(false);
      });
    });

    describe('getRetryDelay', () => {
      it('should use retryAfter if provided', () => {
        const error = new RetryableError('Test', 5000);

        const delay = NotificationErrorFactory.getRetryDelay(error, 0);
        expect(delay).toBe(5000);
      });

      it('should use exponential backoff', () => {
        const error = new RetryableError('Test');

        expect(NotificationErrorFactory.getRetryDelay(error, 0)).toBe(1000);
        expect(NotificationErrorFactory.getRetryDelay(error, 1)).toBe(2000);
        expect(NotificationErrorFactory.getRetryDelay(error, 2)).toBe(4000);
        expect(NotificationErrorFactory.getRetryDelay(error, 3)).toBe(8000);
      });

      it('should cap at 10 seconds', () => {
        const error = new RetryableError('Test');

        const delay = NotificationErrorFactory.getRetryDelay(error, 10);
        expect(delay).toBe(10000);
      });
    });
  });

  describe('Error Hierarchy', () => {
    it('should maintain proper inheritance chain', () => {
      const cancellable = new InvalidRecipientError('+123');
      const retryable = new NetworkError('Failed');

      expect(cancellable).toBeInstanceOf(CancellableError);
      expect(cancellable).toBeInstanceOf(NotificationError);
      expect(cancellable).toBeInstanceOf(Error);

      expect(retryable).toBeInstanceOf(RetryableError);
      expect(retryable).toBeInstanceOf(NotificationError);
      expect(retryable).toBeInstanceOf(Error);
    });
  });
});
