/**
 * SAML Identity Provider Router
 * 
 * Routes for SAML 2.0 IdP functionality
 * Where Zitadel acts as the Identity Provider for external Service Providers
 */

import { Router } from 'express';
import { DatabasePool } from '../../lib/database';
import { Commands } from '../../lib/command/commands';
import { getMetadata } from './handlers/metadata';
import { handleSSO } from './handlers/sso';
import { handleLogout } from './handlers/logout';

/**
 * Create SAML IdP router
 */
export function createSAMLRouter(pool: DatabasePool, commands: Commands): Router {
  const router = Router();

  // ============================================================================
  // SAML IdP Metadata Endpoint
  // ============================================================================
  
  /**
   * GET /saml/metadata
   * 
   * Returns SAML IdP metadata XML for Service Provider configuration
   * This endpoint is used by SPs to automatically configure the IdP
   */
  router.get('/metadata', getMetadata);

  // ============================================================================
  // SAML SSO Endpoint (Single Sign-On)
  // ============================================================================
  
  /**
   * POST /saml/sso
   * 
   * Handles SAML AuthnRequest from Service Providers
   * Authenticates user and returns SAML Response with assertion
   * 
   * Body parameters:
   * - SAMLRequest: Base64 encoded SAML AuthnRequest
   * - RelayState: Optional state to return to SP
   * - userId: User ID to authenticate (for testing)
   * - instanceID: Instance ID (for testing)
   */
  router.post('/sso', async (req, res) => {
    const handler = await handleSSO(pool, commands);
    return handler(req, res);
  });

  // ============================================================================
  // SAML SLO Endpoint (Single Logout) - Future Implementation
  // ============================================================================
  
  /**
   * POST /saml/logout
   * 
   * Handles SAML LogoutRequest from Service Providers
   * Terminates active SAML sessions and returns LogoutResponse
   */
  router.post('/logout', async (req, res) => {
    const handler = await handleLogout(pool, commands);
    return handler(req, res);
  });

  return router;
}
