/**
 * API router implementation
 */

import { generateId } from '../../lib/id/snowflake';
import {
  ApiRouter,
  Route,
  Middleware,
  ApiRequest,
  ApiResponse,
  NotFoundError,
  ApiRequestError,
} from './types';

/**
 * Simple in-memory API router
 */
export class InMemoryApiRouter implements ApiRouter {
  private routes: Route[] = [];
  private globalMiddlewares: Middleware[] = [];

  /**
   * Register route
   */
  register(route: Route): void {
    this.routes.push(route);
  }

  /**
   * Use global middleware
   */
  use(middleware: Middleware): void {
    this.globalMiddlewares.push(middleware);
  }

  /**
   * Handle request
   */
  async handle(request: ApiRequest): Promise<ApiResponse> {
    const startTime = Date.now();
    const requestId = generateId();

    try {
      // Find matching route
      const route = this.findRoute(request.method, request.path);
      if (!route) {
        throw new NotFoundError(`Route not found: ${request.method} ${request.path}`);
      }

      // Build middleware chain
      const middlewares = [...this.globalMiddlewares, ...(route.middlewares || [])];

      // Execute middleware chain and handler
      const response = await this.executeMiddlewareChain(
        request,
        middlewares,
        route.handler
      );

      // Add metadata
      return {
        ...response,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, requestId, startTime);
    }
  }

  /**
   * Find route matching request
   */
  private findRoute(method: string, path: string): Route | null {
    return this.routes.find(
      route => route.method === method && this.matchPath(route.path, path)
    ) || null;
  }

  /**
   * Match path with route pattern (simple implementation)
   */
  private matchPath(pattern: string, path: string): boolean {
    // Simple exact match for now
    // In production, use a proper path matcher with parameters
    return pattern === path;
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddlewareChain(
    request: ApiRequest,
    middlewares: Middleware[],
    handler: (req: ApiRequest) => Promise<ApiResponse>
  ): Promise<ApiResponse> {
    let index = 0;

    const next = async (): Promise<ApiResponse> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        return middleware(request, next);
      }
      return handler(request);
    };

    return next();
  }

  /**
   * Handle error and convert to response
   */
  private handleError(error: any, requestId: string, startTime: number): ApiResponse {
    if (error instanceof ApiRequestError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: (error as any).errors,
        },
        metadata: {
          requestId,
          timestamp: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      metadata: {
        requestId,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Get all routes (for testing)
   */
  getRoutes(): Route[] {
    return this.routes;
  }
}

/**
 * Create API router
 */
export function createApiRouter(): ApiRouter {
  return new InMemoryApiRouter();
}
