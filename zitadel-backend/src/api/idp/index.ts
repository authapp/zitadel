/**
 * IDP API Module
 * 
 * External Identity Provider integration API
 * Handles OAuth 2.0, OIDC, and SAML callbacks
 */

export { createIDPRouter } from './router';
export {
  handleOAuthCallback,
  handleOIDCCallback,
  handleSAMLCallback,
  initiateOAuthLogin,
  initializeIDPHandlers,
} from './callback-handler';
