/**
 * API Server
 * 
 * Main HTTP server with all API routes
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { Commands } from '@/lib/command/commands';
import { createOrganizationRouter } from './grpc/org/v2/router';
import { isZitadelError } from '@/zerrors/errors';

export interface ServerConfig {
  port: number;
  host: string;
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
}

/**
 * Create and configure API server
 */
export function createServer(commands: Commands, config: ServerConfig): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS
  if (config.cors) {
    app.use((req, res, next) => {
      const origin = Array.isArray(config.cors!.origin)
        ? config.cors!.origin[0]
        : config.cors!.origin;
      
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-ID, X-Instance-ID, X-Org-ID');
      res.header('Access-Control-Allow-Credentials', config.cors!.credentials ? 'true' : 'false');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }

      next();
    });
  }

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/v2', createOrganizationRouter(commands));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'NotFound',
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND',
    });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (isZitadelError(err)) {
      return res.status(err.httpStatus).json({
        error: err.name,
        message: err.message,
        code: err.code,
      });
    }

    console.error('Unhandled error:', err);
    return res.status(500).json({
      error: 'Internal',
      message: 'Internal server error',
      code: 'INTERNAL',
    });
  });

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
