/**
 * API types and interfaces
 */

import { AuthContext } from '../../lib/authz/types';

/**
 * API request with auth context
 */
export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, any>;
  body: any;
  context?: AuthContext;
}

/**
 * API response
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  requestId?: string;
  timestamp: Date;
  duration?: number;
}

/**
 * API error
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

/**
 * Route handler
 */
export type RouteHandler = (request: ApiRequest) => Promise<ApiResponse>;

/**
 * Middleware function
 */
export type Middleware = (
  request: ApiRequest,
  next: () => Promise<ApiResponse>
) => Promise<ApiResponse>;

/**
 * Route definition
 */
export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: RouteHandler;
  middlewares?: Middleware[];
}

/**
 * API router interface
 */
export interface ApiRouter {
  /**
   * Register route
   */
  register(route: Route): void;

  /**
   * Use middleware
   */
  use(middleware: Middleware): void;

  /**
   * Handle request
   */
  handle(request: ApiRequest): Promise<ApiResponse>;
}

/**
 * API errors
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'API_ERROR'
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export class UnauthorizedError extends ApiRequestError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiRequestError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiRequestError {
  constructor(message: string = 'Not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ApiRequestError {
  constructor(message: string, public errors: any[] = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
