/**
 * Notification Error Types
 * Based on Zitadel Go: internal/notification/channels/errors.go
 */

/**
 * Base notification error
 */
export class NotificationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'NotificationError';
    Object.setPrototypeOf(this, NotificationError.prototype);
  }
}

/**
 * Cancellable error - indicates operation should not be retried
 * Based on Zitadel Go: internal/errors/cancellable.go
 */
export class CancellableError extends NotificationError {
  constructor(
    message: string,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message, code, details);
    this.name = 'CancellableError';
    Object.setPrototypeOf(this, CancellableError.prototype);
  }

  /**
   * Check if an error is cancellable
   */
  static isCancellable(error: any): boolean {
    return error instanceof CancellableError;
  }
}

/**
 * Retryable error - indicates operation can be retried
 */
export class RetryableError extends NotificationError {
  constructor(
    message: string,
    public readonly retryAfter?: number, // milliseconds
    code?: string,
    details?: Record<string, any>
  ) {
    super(message, code, details);
    this.name = 'RetryableError';
    Object.setPrototypeOf(this, RetryableError.prototype);
  }

  /**
   * Check if an error is retryable
   */
  static isRetryable(error: any): boolean {
    return error instanceof RetryableError;
  }
}

/**
 * Provider not available error
 */
export class ProviderNotAvailableError extends CancellableError {
  constructor(providerName: string, details?: Record<string, any>) {
    super(
      `Provider '${providerName}' is not available`,
      'PROVIDER_NOT_AVAILABLE',
      details
    );
    this.name = 'ProviderNotAvailableError';
    Object.setPrototypeOf(this, ProviderNotAvailableError.prototype);
  }
}

/**
 * Invalid recipient error (4xx - non-retryable)
 */
export class InvalidRecipientError extends CancellableError {
  constructor(recipient: string, reason?: string) {
    super(
      `Invalid recipient: ${recipient}${reason ? ` - ${reason}` : ''}`,
      'INVALID_RECIPIENT',
      { recipient, reason }
    );
    this.name = 'InvalidRecipientError';
    Object.setPrototypeOf(this, InvalidRecipientError.prototype);
  }
}

/**
 * Configuration error (non-retryable)
 */
export class ConfigurationError extends CancellableError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Rate limit error (retryable)
 */
export class RateLimitError extends RetryableError {
  constructor(retryAfter?: number, details?: Record<string, any>) {
    super(
      'Rate limit exceeded',
      retryAfter,
      'RATE_LIMIT_EXCEEDED',
      details
    );
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Network error (retryable)
 */
export class NetworkError extends RetryableError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, undefined, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Timeout error (retryable)
 */
export class TimeoutError extends RetryableError {
  constructor(timeoutMs: number, details?: Record<string, any>) {
    super(
      `Operation timed out after ${timeoutMs}ms`,
      undefined,
      'TIMEOUT',
      { timeoutMs, ...details }
    );
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Server error (retryable)
 */
export class ServerError extends RetryableError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    details?: Record<string, any>
  ) {
    super(message, undefined, 'SERVER_ERROR', { statusCode, ...details });
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Error factory for HTTP status codes
 * Based on Zitadel Go error handling patterns
 */
export class NotificationErrorFactory {
  /**
   * Create error from HTTP status code
   */
  static fromHttpStatus(
    status: number,
    message: string,
    details?: Record<string, any>
  ): NotificationError {
    // 4xx errors are client errors (non-retryable/cancellable)
    if (status >= 400 && status < 500) {
      if (status === 429) {
        return new RateLimitError(undefined, details);
      }
      if (status === 400 || status === 422) {
        return new InvalidRecipientError(
          details?.recipient || 'unknown',
          message
        );
      }
      return new CancellableError(message, `HTTP_${status}`, details);
    }

    // 5xx errors are server errors (retryable)
    if (status >= 500) {
      return new ServerError(message, status, details);
    }

    // Other errors
    return new NotificationError(message, `HTTP_${status}`, details);
  }

  /**
   * Create error from Twilio error
   */
  static fromTwilioError(error: any): NotificationError {
    const status = error.status || error.code;
    const message = error.message || 'Twilio error';
    const details = {
      twilioCode: error.code,
      moreInfo: error.moreInfo,
    };

    if (typeof status === 'number') {
      return this.fromHttpStatus(status, message, details);
    }

    // Twilio error codes
    // 20003 = Authentication Error (cancellable)
    // 21211 = Invalid phone number (cancellable)
    // 21614 = Invalid To phone number (cancellable)
    if (status === 20003 || status === 21211 || status === 21614) {
      return new InvalidRecipientError('phone', message);
    }

    return new NotificationError(message, String(status), details);
  }

  /**
   * Check if error should be retried
   */
  static shouldRetry(error: any): boolean {
    if (CancellableError.isCancellable(error)) {
      return false;
    }
    if (RetryableError.isRetryable(error)) {
      return true;
    }
    // Unknown errors should not be retried by default
    return false;
  }

  /**
   * Get retry delay for retryable errors
   */
  static getRetryDelay(error: any, attempt: number): number {
    if (error instanceof RetryableError && error.retryAfter) {
      return error.retryAfter;
    }
    // Exponential backoff: 1s, 2s, 4s, 8s (max 10s)
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }
}
