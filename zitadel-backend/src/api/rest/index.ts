/**
 * API module for Zitadel
 * 
 * Provides:
 * - REST API routing
 * - Request/response handling
 * - Middleware support
 * - Error handling
 */

export * from './types';
export * from './router';

// Re-export commonly used types
export type {
  ApiRequest,
  ApiResponse,
  ApiError,
  RouteHandler,
  Middleware,
  Route,
  ApiRouter,
} from './types';

export {
  ApiRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from './types';

export {
  InMemoryApiRouter,
  createApiRouter,
} from './router';
