/**
 * Email Verification REST API
 * 
 * Simple REST endpoints for email verification
 * Can be used by external applications or web interfaces
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Commands } from '../../lib/command/commands';
import { Eventstore } from '../../lib/eventstore/types';
import { DatabasePool } from '../../lib/database';
import { createMemoryCache } from '../../lib/cache/factory';
import { createLocalStorage } from '../../lib/static/factory';
import { SnowflakeGenerator } from '../../lib/id';

/**
 * Convert ObjectDetails to JSON-safe format
 * Converts BigInt to string for JSON serialization
 */
function serializeObjectDetails(details: any): any {
  return {
    sequence: details.sequence.toString(), // Convert BigInt to string
    eventDate: details.eventDate,
    resourceOwner: details.resourceOwner,
  };
}

/**
 * Email verification context
 */
export interface EmailVerificationContext {
  commands: Commands;
  createContext: () => any;
}

/**
 * Create email verification router
 */
export function createEmailVerificationRouter(
  pool: DatabasePool,
  eventstore: Eventstore
): Router {
  const router = Router();

  // Initialize commands
  const cache = createMemoryCache();
  const storage = createLocalStorage({ basePath: '/tmp/email-uploads' });
  const idGenerator = new SnowflakeGenerator({ machineId: 1 });
  const commandsConfig = {
    externalDomain: 'localhost',
    externalSecure: false,
    externalPort: 3000,
  };

  const commands = new Commands(
    eventstore,
    cache,
    storage,
    idGenerator,
    commandsConfig,
    undefined,
    pool
  );

  // Middleware to add context
  router.use((req: Request, _res: Response, next: NextFunction) => {
    // Extract auth context (in production, get from JWT or session)
    const instanceID = (req.headers['x-instance-id'] as string) || 'default';
    const userID = (req.headers['x-user-id'] as string) || 'system';
    const orgID = (req.headers['x-org-id'] as string) || instanceID;

    const createContext = () => ({
      instanceID,
      userID,
      orgID,
    });

    (req as any).emailContext = {
      commands,
      createContext,
    } as EmailVerificationContext;

    next();
  });

  /**
   * POST /api/v1/email/change
   * Change user email and send verification code
   * 
   * Body: {
   *   userId: string;
   *   email: string;
   *   returnCode?: boolean;  // For testing
   *   urlTemplate?: string;  // Optional verification link template
   * }
   */
  router.post('/change', async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { userId, email, returnCode = false, urlTemplate } = req.body;

      if (!userId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'userId is required',
        });
      }

      if (!email) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'email is required',
        });
      }

      const { commands, createContext } = (req as any).emailContext as EmailVerificationContext;
      const ctx = createContext();

      const result = await commands.changeUserEmail(
        ctx,
        userId,
        email,
        returnCode,
        urlTemplate
      );

      return res.json({
        success: true,
        details: serializeObjectDetails(result.details),
        code: result.plainCode, // Only present if returnCode was true
        message: returnCode
          ? 'Email changed, verification code returned'
          : 'Email changed, verification code sent',
      });
    } catch (error: any) {
      return next(error);
    }
  });

  /**
   * POST /api/v1/email/resend
   * Resend email verification code
   * 
   * Body: {
   *   userId: string;
   *   returnCode?: boolean;
   *   urlTemplate?: string;
   * }
   */
  router.post('/resend', async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { userId, returnCode = false, urlTemplate } = req.body;

      if (!userId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'userId is required',
        });
      }

      const { commands, createContext } = (req as any).emailContext as EmailVerificationContext;
      const ctx = createContext();

      const result = await commands.resendUserEmailCode(
        ctx,
        userId,
        returnCode,
        urlTemplate
      );

      return res.json({
        success: true,
        details: serializeObjectDetails(result.details),
        code: result.plainCode, // Only present if returnCode was true
        message: returnCode
          ? 'Verification code generated'
          : 'Verification code sent',
      });
    } catch (error: any) {
      return next(error);
    }
  });

  /**
   * POST /api/v1/email/verify
   * Verify email with code
   * 
   * Body: {
   *   userId: string;
   *   code: string;
   * }
   */
  router.post('/verify', async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { userId, code } = req.body;

      if (!userId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'userId is required',
        });
      }

      if (!code) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'code is required',
        });
      }

      const { commands, createContext } = (req as any).emailContext as EmailVerificationContext;
      const ctx = createContext();

      const result = await commands.verifyUserEmail(ctx, userId, code);

      return res.json({
        success: true,
        details: serializeObjectDetails(result),
        message: 'Email verified successfully',
      });
    } catch (error: any) {
      return next(error);
    }
  });

  // Error handler
  router.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    // ZitadelError uses 'httpStatus' property, fallback to 'status' for other errors
    const status = error.httpStatus || error.status || 500;
    const message = error.message || 'Internal Server Error';
    const code = error.code || 'INTERNAL_ERROR';

    res.status(status).json({
      error: error.name || 'Error',
      message,
      code,
    });
  });

  return router;
}

/**
 * Mount email verification router
 */
export function mountEmailVerificationRouter(
  app: any,
  pool: DatabasePool,
  eventstore: Eventstore
): void {
  const router = createEmailVerificationRouter(pool, eventstore);
  app.use('/api/v1/email', router);
  console.log('✅ Email Verification API mounted at /api/v1/email');
}
