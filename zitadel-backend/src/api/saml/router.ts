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
   * TODO: Implement in future sprint
   */
  router.post('/logout', (req, res) => {
    // Log the request for future implementation
    console.log('SAML Logout request received from:', req.ip);
    
    res.status(501).json({
      error: 'Not Implemented',
      message: 'SAML Single Logout not yet implemented',
      hint: 'This endpoint will be implemented in a future release'
    });
  });

  return router;
}
