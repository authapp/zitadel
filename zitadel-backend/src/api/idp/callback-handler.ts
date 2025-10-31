/**
 * IDP Callback Handler
 * 
 * Express route handlers for external Identity Provider callbacks
 * Handles OAuth 2.0, OIDC, and SAML responses
 * 
 * Routes:
 * - GET/POST /idp/callback/oauth/:idpID
 * - GET/POST /idp/callback/oidc/:idpID
 * - POST /idp/callback/saml/:idpID
 */

import { Request, Response, NextFunction } from 'express';
import { Commands } from '@/lib/command';
import { Context } from '@/lib/command/context';
import { IDPCallbackResult, OAuthCallbackData, OIDCCallbackData, SAMLResponseData } from '@/lib/command/idp/idp-callback-commands';

// Commands will be injected via dependency injection
let commands: Commands;

export function initializeIDPHandlers(cmd: Commands) {
  commands = cmd;
}

/**
 * Handle OAuth callback from external provider
 * 
 * Query parameters:
 * - code: Authorization code from provider
 * - state: CSRF protection state parameter
 * - error: Optional error from provider
 * - error_description: Optional error description
 */
export async function handleOAuthCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, state, error, error_description } = req.query;
    const { idpID } = req.params;

    if (!idpID) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'IDP ID is required',
      });
    }

    // Build callback data
    const callbackData: OAuthCallbackData = {
      state: state as string,
      code: code as string,
      error: error as string | undefined,
      errorDescription: error_description as string | undefined,
    };

    // Validate callback data
    if (!callbackData.state) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'State parameter is required',
      });
    }

    if (!callbackData.code && !callbackData.error) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Code or error parameter is required',
      });
    }

    // Create context from request
    const ctx: Context = {
      userID: (req as any).user?.id,
      orgID: (req as any).org?.id || 'default',
      instanceID: 'default',
    };

    // Retrieve intent (mock for now - should query from projection)
    const intent = await commands.getIDPIntentByState(ctx, callbackData.state);
    if (!intent) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid or expired state parameter',
      });
    }

    // TODO: Check if user already linked via IDPQueries
    // For now, pass undefined to always provision new user
    const existingUserID = undefined;

    // Handle callback
    const result: IDPCallbackResult = await commands.handleOAuthCallback(
      ctx,
      callbackData,
      intent,
      existingUserID
    );

    // Redirect to success page or return tokens
    if (intent.authRequestID) {
      // Federated login flow - redirect to auth request completion
      return res.redirect(`/oauth/v2/authorize/callback?auth_request=${intent.authRequestID}&user_id=${result.userID}`);
    } else {
      // Direct callback - return result
      return res.json({
        success: true,
        user_id: result.userID,
        is_new_user: result.isNewUser,
        external_user: result.externalUserInfo,
      });
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    next(error);
  }
}

/**
 * Handle OIDC callback from external provider
 * Same as OAuth but with additional ID token validation
 */
export async function handleOIDCCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, state, error, error_description, id_token } = req.query;
    const { idpID } = req.params;

    if (!idpID) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'IDP ID is required',
      });
    }

    // Build callback data
    const callbackData: OIDCCallbackData = {
      state: state as string,
      code: code as string,
      idToken: id_token as string | undefined,
      error: error as string | undefined,
      errorDescription: error_description as string | undefined,
    };

    // Validate callback data
    if (!callbackData.state) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'State parameter is required',
      });
    }

    if (!callbackData.code && !callbackData.error) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Code or error parameter is required',
      });
    }

    // Create context from request
    const ctx: Context = {
      userID: (req as any).user?.id,
      orgID: (req as any).org?.id || 'default',
      instanceID: 'default',
    };

    // Retrieve intent
    const intent = await commands.getIDPIntentByState(ctx, callbackData.state);
    if (!intent) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid or expired state parameter',
      });
    }

    // TODO: Check if user already linked via IDPQueries
    // For now, pass undefined to always provision new user
    const existingUserID = undefined;

    // Handle callback
    const result: IDPCallbackResult = await commands.handleOIDCCallback(
      ctx,
      callbackData,
      intent,
      existingUserID
    );

    // Redirect to success page or return tokens
    if (intent.authRequestID) {
      // Federated login flow - redirect to auth request completion
      return res.redirect(`/oauth/v2/authorize/callback?auth_request=${intent.authRequestID}&user_id=${result.userID}`);
    } else {
      // Direct callback - return result
      return res.json({
        success: true,
        user_id: result.userID,
        is_new_user: result.isNewUser,
        external_user: result.externalUserInfo,
      });
    }
  } catch (error) {
    console.error('OIDC callback error:', error);
    next(error);
  }
}

/**
 * Handle SAML response from external provider
 * 
 * Form data:
 * - SAMLResponse: Base64-encoded SAML response
 * - RelayState: Optional state parameter
 */
export async function handleSAMLCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { SAMLResponse, RelayState } = req.body;
    const { idpID } = req.params;

    if (!idpID) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'IDP ID is required',
      });
    }

    if (!SAMLResponse) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'SAMLResponse is required',
      });
    }

    // Build SAML response data
    const responseData: SAMLResponseData = {
      samlResponse: SAMLResponse as string,
      relayState: RelayState as string | undefined,
    };

    // Create context from request
    const ctx: Context = {
      userID: (req as any).user?.id,
      orgID: (req as any).org?.id || 'default',
      instanceID: 'default',
    };

    // TODO: Check if user already linked via IDPQueries
    // For now, pass undefined to always provision new user
    const existingUserID = undefined;

    const result: IDPCallbackResult = await commands.handleSAMLResponse(
      ctx,
      responseData,
      idpID,
      existingUserID
    );

    // Redirect to success page
    if (RelayState) {
      // Relay state might contain auth request ID or redirect URL
      return res.redirect(`/saml/callback?relay_state=${RelayState}&user_id=${result.userID}`);
    } else {
      return res.json({
        success: true,
        user_id: result.userID,
        is_new_user: result.isNewUser,
        external_user: result.externalUserInfo,
      });
    }
  } catch (error) {
    console.error('SAML callback error:', error);
    next(error);
  }
}

/**
 * Initiate OAuth/OIDC login flow
 * Generates authorization URL and redirects user to external provider
 */
export async function initiateOAuthLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { idpID } = req.params;
    const { auth_request } = req.query;

    if (!idpID) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'IDP ID is required',
      });
    }

    // Create context from request
    const ctx: Context = {
      userID: (req as any).user?.id,
      orgID: (req as any).org?.id || 'default',
      instanceID: 'default',
    };

    // TODO: Get IDP configuration via IDPQueries
    // For now, use mock IDP data
    const idp: any = null;
    if (!idp) {
      return res.status(404).json({
        error: 'not_found',
        error_description: 'IDP not found',
      });
    }

    if (idp.state !== 'ACTIVE') {
      return res.status(400).json({
        error: 'idp_inactive',
        error_description: 'IDP is not active',
      });
    }

    // Determine IDP type
    const idpType = idp.type === 'OIDC' ? 'oidc' : 'oauth';

    // Create IDP intent
    const intent = await commands.startIDPIntent(
      ctx,
      idpID,
      idpType,
      `${req.protocol}://${req.get('host')}/idp/callback/${idpType}/${idpID}`,
      auth_request as string | undefined
    );

    // Build authorization URL
    const authorizationURL = buildAuthorizationURL(idp, intent);

    // Redirect to external provider
    return res.redirect(authorizationURL);
  } catch (error) {
    console.error('OAuth initiation error:', error);
    next(error);
  }
}

/**
 * Build authorization URL for external provider
 */
function buildAuthorizationURL(idp: any, intent: any): string {
  // TODO: Build actual authorization URL based on IDP configuration
  // This should construct the OAuth/OIDC authorization request with:
  // - authorization_endpoint from IDP config
  // - client_id
  // - redirect_uri
  // - response_type=code
  // - scope
  // - state (CSRF protection)
  // - code_challenge (PKCE)
  // - nonce (OIDC only)
  
  return `https://provider.example.com/authorize?client_id=${idp.clientID}&redirect_uri=${intent.redirectURI}&state=${intent.state}&response_type=code&scope=openid profile email`;
}
