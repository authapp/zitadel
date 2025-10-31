/**
 * Middleware Exports
 * 
 * Centralized export of all middleware components
 */

// Rate Limiting
export {
  createRateLimiter,
  createAuthRateLimiter,
  createPublicRateLimiter,
  type RateLimitConfig,
} from './rate-limit';

// Security Headers
export {
  createSecurityHeaders,
  createDevelopmentSecurityHeaders,
  createProductionSecurityHeaders,
  type SecurityHeadersConfig,
} from './security-headers';

// CORS
export {
  createCorsMiddleware,
  createDevelopmentCors,
  createProductionCors,
  createDynamicCors,
  type EnhancedCorsConfig,
} from './cors';

// Request ID
export {
  createRequestIdMiddleware,
  getRequestId,
  createRequestIdWithPrefix,
  createStrictRequestIdMiddleware,
  type RequestIdConfig,
} from './request-id';

// Logging
export {
  createLoggingMiddleware,
  createDevelopmentLogging,
  createProductionLogging,
  createJsonLogging,
  createSelectiveLogging,
  type LogFormat,
  type LoggingConfig,
} from './logging';

// Error Handling
export {
  createErrorHandler,
  createDevelopmentErrorHandler,
  createProductionErrorHandler,
  notFoundHandler,
  asyncHandler,
  type ErrorHandlerConfig,
} from './error-handler';
