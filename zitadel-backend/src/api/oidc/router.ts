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
import { handleClientRegistration, handleClientUpdate, handleClientDeletion } from './client-registration';
import { handlePAR } from './par';
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
  // Pass commands for PAR support (RFC 9126)
  router.get('/oauth/v2/authorize', asyncHandler(async (req, res, next) => {
    await authorizeHandler(req, res, next, commands, pool);
  }));
  router.post('/oauth/v2/authorize', asyncHandler(async (req, res, next) => {
    await authorizeHandler(req, res, next, commands, pool);
  }));

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
  // Dynamic Client Registration (RFC 7591)
  // Pushed Authorization Requests (RFC 9126)
  // Only register routes if commands and pool are provided
  if (commands && pool) {
    router.post('/oauth/device_authorization', async (req, res) => {
      await handleDeviceAuthorization(req, res, commands, pool);
    });

    router.post('/oauth/device', async (req, res) => {
      await handleDeviceUserApproval(req, res, commands, pool);
    });

    // Dynamic Client Registration (RFC 7591)
    router.post('/oauth/register', async (req, res) => {
      await handleClientRegistration(req, res, commands, pool);
    });

    // Dynamic Client Management (RFC 7592)
    router.put('/oauth/register/:client_id', async (req, res) => {
      await handleClientUpdate(req, res, commands, pool);
    });

    router.delete('/oauth/register/:client_id', async (req, res) => {
      await handleClientDeletion(req, res, commands, pool);
    });

    // Pushed Authorization Requests (RFC 9126)
    router.post('/oauth/par', async (req, res) => {
      await handlePAR(req, res, commands, pool);
    });
  }

  return router;
}
