/**
 * OIDC Router
 * 
 * Routes for OpenID Connect and OAuth 2.0 endpoints
 */

import { Router } from 'express';
import { discoveryHandler } from './discovery';
import { jwksHandler } from './jwks';
import { authorizeHandler } from './authorize';
import { tokenHandler } from './token';
import { userinfoHandler } from './userinfo';
import { introspectHandler } from './introspect';
import { revokeHandler } from './revoke';
import { handleDeviceAuthorization, handleDeviceUserApproval } from './device-authorization';
import { asyncHandler } from '../middleware';
import { Commands } from '@/lib/command/commands';
import { DatabasePool } from '@/lib/database';

/**
 * Create OIDC router
 */
export function createOIDCRouter(commands?: Commands, pool?: DatabasePool): Router {
  const router = Router();

  // OpenID Connect Discovery
  router.get('/.well-known/openid-configuration', discoveryHandler);
  
  // JWKS (JSON Web Key Set)
  router.get('/.well-known/jwks.json', asyncHandler(jwksHandler));

  // Authorization endpoint (supports both GET and POST)
  router.get('/oauth/v2/authorize', asyncHandler(authorizeHandler));
  router.post('/oauth/v2/authorize', asyncHandler(authorizeHandler));

  // Token endpoint
  router.post('/oauth/v2/token', asyncHandler(tokenHandler));

  // UserInfo endpoint (supports both GET and POST)
  router.get('/oidc/v1/userinfo', asyncHandler(userinfoHandler));
  router.post('/oidc/v1/userinfo', asyncHandler(userinfoHandler));

  // Token introspection
  router.post('/oauth/v2/introspect', asyncHandler(introspectHandler));

  // Token revocation
  router.post('/oauth/v2/revoke', asyncHandler(revokeHandler));

  // Device Authorization Flow (RFC 8628)
  // Only register routes if commands and pool are provided
  if (commands && pool) {
    router.post('/oauth/device_authorization', async (req, res) => {
      await handleDeviceAuthorization(req, res, commands, pool);
    });

    router.post('/oauth/device', async (req, res) => {
      await handleDeviceUserApproval(req, res, commands, pool);
    });
  }

  return router;
}
