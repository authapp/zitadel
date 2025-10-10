/**
 * Organization Router (v2)
 * 
 * HTTP/REST router for organization service
 * Maps REST endpoints to gRPC service methods
 */

import { Router, Request, Response } from 'express';
import { OrganizationService } from './org_service';
import { Commands } from '@/lib/command/commands';
import { Context } from '@/lib/command/context';
import { isZitadelError } from '@/zerrors/errors';

/**
 * Create organization router
 */
export function createOrganizationRouter(commands: Commands): Router {
  const router = Router();
  const service = new OrganizationService(commands);

  // Middleware to extract context from request
  const getContext = (req: Request): Context => {
    // Extract from headers or auth middleware
    const userID = req.headers['x-user-id'] as string;
    const instanceID = req.headers['x-instance-id'] as string || 'default';
    const orgID = req.headers['x-org-id'] as string;

    return {
      userID,
      instanceID,
      orgID: orgID || instanceID,
    };
  };

  // Error handler
  const handleError = (err: any, res: Response) => {
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
  };

  /**
   * POST /v2/organizations
   * Create a new organization
   */
  router.post('/organizations', async (req: Request, res: Response) => {
    try {
      const ctx = getContext(req);
      const response = await service.addOrganization(ctx, req.body);
      res.status(201).json(response);
    } catch (err) {
      handleError(err, res);
    }
  });

  /**
   * POST /v2/organizations/_search
   * Search for organizations
   */
  router.post('/organizations/_search', async (req: Request, res: Response) => {
    try {
      const ctx = getContext(req);
      const response = await service.listOrganizations(ctx, req.body);
      res.json(response);
    } catch (err) {
      handleError(err, res);
    }
  });

  /**
   * GET /v2/organizations/:id
   * Get organization by ID
   */
  router.get('/organizations/:id', async (req: Request, res: Response) => {
    try {
      const ctx = getContext(req);
      const response = await service.getOrganization(ctx, {
        organizationId: req.params.id,
      });
      res.json(response);
    } catch (err) {
      handleError(err, res);
    }
  });

  /**
   * PUT /v2/organizations/:id
   * Update organization
   */
  router.put('/organizations/:id', async (req: Request, res: Response) => {
    try {
      const ctx = getContext(req);
      const response = await service.updateOrganization(ctx, {
        organizationId: req.params.id,
        name: req.body.name,
      });
      res.json(response);
    } catch (err) {
      handleError(err, res);
    }
  });

  /**
   * POST /v2/organizations/:id/_deactivate
   * Deactivate organization
   */
  router.post('/organizations/:id/_deactivate', async (req: Request, res: Response) => {
    try {
      const ctx = getContext(req);
      const response = await service.deactivateOrganization(ctx, {
        organizationId: req.params.id,
      });
      res.json(response);
    } catch (err) {
      handleError(err, res);
    }
  });

  /**
   * POST /v2/organizations/:id/_reactivate
   * Reactivate organization
   */
  router.post('/organizations/:id/_reactivate', async (req: Request, res: Response) => {
    try {
      const ctx = getContext(req);
      const response = await service.reactivateOrganization(ctx, {
        organizationId: req.params.id,
      });
      res.json(response);
    } catch (err) {
      handleError(err, res);
    }
  });

  /**
   * DELETE /v2/organizations/:id
   * Remove organization
   */
  router.delete('/organizations/:id', async (req: Request, res: Response) => {
    try {
      const ctx = getContext(req);
      const response = await service.removeOrganization(ctx, {
        organizationId: req.params.id,
      });
      res.json(response);
    } catch (err) {
      handleError(err, res);
    }
  });

  return router;
}
