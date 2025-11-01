/**
 * API Server
 * 
 * Main HTTP server with all API routes and middleware
 */

import express, { Express } from 'express';
import { Commands } from '@/lib/command/commands';
import { createOrganizationRouter } from './grpc/org/v2/router';
import { createOIDCRouter } from './oidc';
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
  const isTest = config.environment === 'test';

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

  // Rate limiting (global) - disabled in test environment
  if (!isTest) {
    app.use(createRateLimiter({
      windowMs: config.rateLimit?.windowMs,
      max: config.rateLimit?.max,
    }));
  }

  // Health check (no rate limit)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // OIDC/OAuth2 routes (mounted at root for standard paths)
  app.use(createOIDCRouter(commands, commands.database));

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
      console.log(`🔐 OIDC Discovery: http://${config.host}:${config.port}/.well-known/openid-configuration`);
      console.log(`🔑 JWKS: http://${config.host}:${config.port}/.well-known/jwks.json`);
      console.log(`🔓 Authorize: http://${config.host}:${config.port}/oauth/v2/authorize`);
      console.log(`🎫 Token: http://${config.host}:${config.port}/oauth/v2/token`);
      console.log(`👤 UserInfo: http://${config.host}:${config.port}/oidc/v1/userinfo`);
      console.log(`🏢 Organizations: http://${config.host}:${config.port}/v2/organizations`);
      resolve();
    });
  });
}
