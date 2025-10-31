/**
 * API Server
 * 
 * Main HTTP server with all API routes and middleware
 */

import express, { Express } from 'express';
import { Commands } from '@/lib/command/commands';
import { createOrganizationRouter } from './grpc/org/v2/router';
import {
  createRateLimiter,
  createSecurityHeaders,
  createCorsMiddleware,
  createRequestIdMiddleware,
  createLoggingMiddleware,
  createErrorHandler,
  notFoundHandler,
} from './middleware';

export interface ServerConfig {
  port: number;
  host: string;
  environment?: 'development' | 'production' | 'test';
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit?: {
    windowMs?: number;
    max?: number;
  };
}

/**
 * Create and configure API server
 */
export function createServer(commands: Commands, config: ServerConfig): Express {
  const app = express();
  const isDevelopment = config.environment === 'development';

  // Request ID tracking (must be first)
  app.use(createRequestIdMiddleware());

  // Security headers
  app.use(createSecurityHeaders({
    contentSecurityPolicy: isDevelopment ? false : undefined,
    hsts: isDevelopment ? false : undefined,
  }));

  // CORS
  app.use(createCorsMiddleware({
    origin: config.cors?.origin || '*',
    credentials: config.cors?.credentials ?? false,
  }));

  // Request logging
  app.use(createLoggingMiddleware({
    format: isDevelopment ? 'dev' : 'combined',
  }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting (global)
  app.use(createRateLimiter({
    windowMs: config.rateLimit?.windowMs,
    max: config.rateLimit?.max,
  }));

  // Health check (no rate limit)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/v2', createOrganizationRouter(commands));

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(createErrorHandler({
    includeStack: isDevelopment,
    logErrors: true,
  }));

  return app;
}

/**
 * Start the server
 */
export async function startServer(
  commands: Commands,
  config: ServerConfig
): Promise<void> {
  const app = createServer(commands, config);

  return new Promise((resolve) => {
    app.listen(config.port, config.host, () => {
      console.log(`🚀 Zitadel API Server running at http://${config.host}:${config.port}`);
      console.log(`📚 Health check: http://${config.host}:${config.port}/health`);
      console.log(`🏢 Organizations: http://${config.host}:${config.port}/v2/organizations`);
      resolve();
    });
  });
}
