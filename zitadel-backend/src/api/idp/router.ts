/**
 * IDP Callback Router
 * 
 * Express router for external Identity Provider callback endpoints
 * Handles OAuth 2.0, OIDC, and SAML responses from external providers
 */

import { Router } from 'express';
import {
  handleOAuthCallback,
  handleOIDCCallback,
  handleSAMLCallback,
  initiateOAuthLogin,
  initializeIDPHandlers,
} from './callback-handler';
import { Commands } from '@/lib/command';

/**
 * Create IDP callback router
 */
export function createIDPRouter(commands: Commands): Router {
  const router = Router();

  // Initialize handlers with commands instance
  initializeIDPHandlers(commands);

  // OAuth 2.0 callback (supports both GET and POST)
  router.get('/callback/oauth/:idpID', handleOAuthCallback);
  router.post('/callback/oauth/:idpID', handleOAuthCallback);

  // OIDC callback (supports both GET and POST)
  router.get('/callback/oidc/:idpID', handleOIDCCallback);
  router.post('/callback/oidc/:idpID', handleOIDCCallback);

  // SAML callback (POST only - SAML uses form POST)
  router.post('/callback/saml/:idpID', handleSAMLCallback);

  // Initiate OAuth/OIDC login flow
  router.get('/login/:idpID', initiateOAuthLogin);

  return router;
}

/**
 * Example usage in main server:
 * 
 * ```typescript
 * import { createIDPRouter } from './api/idp/router';
 * 
 * const idpRouter = createIDPRouter(commands);
 * app.use('/idp', idpRouter);
 * ```
 * 
 * This creates the following routes:
 * - GET  /idp/login/:idpID - Initiate OAuth/OIDC login
 * - GET  /idp/callback/oauth/:idpID - OAuth callback
 * - POST /idp/callback/oauth/:idpID - OAuth callback
 * - GET  /idp/callback/oidc/:idpID - OIDC callback
 * - POST /idp/callback/oidc/:idpID - OIDC callback
 * - POST /idp/callback/saml/:idpID - SAML callback
 */
