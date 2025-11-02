/**
 * SCIM 2.0 Router
 * RFC 7644 - SCIM Protocol
 * 
 * Base path: /scim/v2
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { scimAuthMiddleware } from './middleware/scim-auth';
import { scimErrorHandler } from './middleware/scim-error-handler';
import { discoveryHandler } from './handlers/discovery';
import { usersHandler } from './handlers/users';
import { groupsHandler } from './handlers/groups';
import { UserQueries } from '../../lib/query/user/user-queries';
import { OrgQueries } from '../../lib/query/org/org-queries';
import { DatabasePool } from '../../lib/database';
import { Commands } from '../../lib/command/commands';
import { Eventstore } from '../../lib/eventstore/types';
import { createMemoryCache } from '../../lib/cache/factory';
import { createLocalStorage } from '../../lib/static/factory';
import { SnowflakeGenerator } from '../../lib/id';
import { ProjectionWaitHelper } from '../helpers/projection-wait';

export interface SCIMContext {
  queries: {
    user: UserQueries;
    org: OrgQueries;
  };
  commands: Commands;
  instanceID: string;
  createContext: () => any;
  projectionWait: ProjectionWaitHelper;
}

export function createSCIMRouter(pool: DatabasePool, eventstore: Eventstore): Router {
  const router = Router();

  // Initialize queries
  const userQueries = new UserQueries(pool);
  const orgQueries = new OrgQueries(pool);

  // Initialize commands with required dependencies
  const cache = createMemoryCache();
  const storage = createLocalStorage({ basePath: '/tmp/scim-uploads' });
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
    undefined, // permissionChecker - uses default
    pool
  );

  // Initialize projection wait helper
  const projectionWait = new ProjectionWaitHelper(eventstore, pool);

  // ============================================================================
  // Middleware
  // ============================================================================

  // Set SCIM content type
  router.use((_req, res, next) => {
    res.setHeader('Content-Type', 'application/scim+json');
    next();
  });

  // Authentication middleware (Bearer token)
  router.use(scimAuthMiddleware);

  // Add SCIM context to requests
  router.use((req: Request, _res: Response, next: NextFunction) => {
    // Extract auth context from scim-auth middleware
    const authContext = (req as any).scimContext || {};
    const instanceID = authContext.instanceId || 'default';
    const userID = authContext.userId || 'system';
    const orgID = authContext.orgId || instanceID; // Use orgId from token, fallback to instanceID
    
    // Create context factory for commands
    const createContext = () => ({
      instanceID,
      userID,
      orgID,
    });
    
    (req as any).scimContext = {
      queries: {
        user: userQueries,
        org: orgQueries,
      },
      commands,
      instanceID,
      createContext,
      projectionWait,
    } as SCIMContext;
    
    next();
  });

  // ============================================================================
  // Discovery Endpoints (RFC 7643)
  // ============================================================================

  // GET /scim/v2/Schemas - Available schemas
  router.get('/Schemas', discoveryHandler.getSchemas);
  router.get('/Schemas/:id', discoveryHandler.getSchema);

  // GET /scim/v2/ServiceProviderConfig - Provider capabilities
  router.get('/ServiceProviderConfig', discoveryHandler.getServiceProviderConfig);

  // GET /scim/v2/ResourceTypes - Supported resource types
  router.get('/ResourceTypes', discoveryHandler.getResourceTypes);
  router.get('/ResourceTypes/:id', discoveryHandler.getResourceType);

  // ============================================================================
  // User Resource Endpoints (RFC 7644 Section 3.2)
  // ============================================================================

  // GET /scim/v2/Users - Search/list users
  router.get('/Users', usersHandler.listUsers);

  // POST /scim/v2/Users - Create user
  router.post('/Users', usersHandler.createUser);

  // GET /scim/v2/Users/:id - Get single user
  router.get('/Users/:id', usersHandler.getUser);

  // PUT /scim/v2/Users/:id - Replace user (full update)
  router.put('/Users/:id', usersHandler.replaceUser);

  // PATCH /scim/v2/Users/:id - Update user (partial)
  router.patch('/Users/:id', usersHandler.patchUser);

  // DELETE /scim/v2/Users/:id - Delete user
  router.delete('/Users/:id', usersHandler.deleteUser);

  // ============================================================================
  // Group Resource Endpoints (RFC 7644 Section 3.2)
  // ============================================================================

  // GET /scim/v2/Groups - Search/list groups
  router.get('/Groups', groupsHandler.listGroups);

  // POST /scim/v2/Groups - Create group
  router.post('/Groups', groupsHandler.createGroup);

  // GET /scim/v2/Groups/:id - Get single group
  router.get('/Groups/:id', groupsHandler.getGroup);

  // PUT /scim/v2/Groups/:id - Replace group
  router.put('/Groups/:id', groupsHandler.replaceGroup);

  // PATCH /scim/v2/Groups/:id - Update group
  router.patch('/Groups/:id', groupsHandler.patchGroup);

  // DELETE /scim/v2/Groups/:id - Delete group
  router.delete('/Groups/:id', groupsHandler.deleteGroup);

  // ============================================================================
  // Error Handler
  // ============================================================================

  router.use(scimErrorHandler);

  return router;
}

/**
 * Mount SCIM router to Express app
 */
export function mountSCIMRouter(app: express.Application, pool: DatabasePool, eventstore: Eventstore): void {
  const scimRouter = createSCIMRouter(pool, eventstore);
  app.use('/scim/v2', scimRouter);
  console.log('✅ SCIM 2.0 API mounted at /scim/v2');
}
