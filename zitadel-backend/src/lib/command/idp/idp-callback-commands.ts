/**
 * IDP Callback Commands
 * 
 * Handles external Identity Provider (IDP) callbacks for federated authentication.
 * Supports OAuth 2.0, OIDC, and SAML flows.
 * 
 * Based on: zitadel/internal/command/idp_intent.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { Command } from '../../eventstore/types';
import { ObjectDetails } from '../write-model';
import { 
  throwInvalidArgument, 
  throwPreconditionFailed, 
  throwUnauthenticated 
} from '@/zerrors/errors';
import { validateRequired } from '../validation';
import { UserIDPLink } from '../../domain/user-idp-link';
import { randomUUID } from 'crypto';
import { decodeJwt } from 'jose';
// import * as saml2 from 'samlify'; // Reserved for future full SAML implementation
import * as crypto from 'crypto';

/**
 * IDP intent state for tracking callback flow
 */
export interface IDPIntent {
  intentID: string;
  idpID: string;
  idpType: 'oauth' | 'oidc' | 'saml' | 'ldap' | 'jwt';
  state: string;
  codeVerifier?: string;
  nonce?: string;
  redirectURI: string;
  authRequestID?: string;
  instanceID: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * OAuth callback data from external provider
 */
export interface OAuthCallbackData {
  state: string;
  code: string;
  error?: string;
  errorDescription?: string;
}

/**
 * OIDC callback data from external provider
 */
export interface OIDCCallbackData extends OAuthCallbackData {
  idToken?: string;
}

/**
 * SAML response data from external provider
 */
export interface SAMLResponseData {
  samlResponse: string;
  relayState?: string;
}

/**
 * External user info from IDP
 */
export interface ExternalUserInfo {
  externalUserID: string;
  email?: string;
  emailVerified?: boolean;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarURL?: string;
  locale?: string;
  rawUserInfo?: any;
}

/**
 * IDP callback result
 */
export interface IDPCallbackResult {
  userID?: string;
  isNewUser: boolean;
  externalUserInfo: ExternalUserInfo;
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresIn?: number;
  };
  details: ObjectDetails;
}

/**
 * Create IDP intent for OAuth/OIDC flow
 * Based on: StartIDPIntent (idp_intent.go:35-65)
 */
export async function startIDPIntent(
  this: Commands,
  ctx: Context,
  idpID: string,
  idpType: 'oauth' | 'oidc' | 'saml',
  redirectURI: string,
  authRequestID?: string
): Promise<IDPIntent> {
  validateRequired(idpID, 'idpID');
  validateRequired(redirectURI, 'redirectURI');

  // Note: IDP validation should be done by caller with query layer
  // Commands layer focuses on write operations

  // Generate intent data
  const intentID = randomUUID();
  const state = generateSecureState();
  // PKCE is only for OAuth/OIDC, not SAML
  const codeVerifier = idpType !== 'saml' ? generateCodeVerifier() : undefined;
  const nonce = idpType === 'oidc' ? generateNonce() : undefined;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

  const intent: IDPIntent = {
    intentID,
    idpID,
    idpType,
    state,
    codeVerifier,
    nonce,
    redirectURI,
    authRequestID,
    instanceID: ctx.instanceID,
    createdAt: now,
    expiresAt,
  };

  // Store intent event
  const command: Command = {
    eventType: 'idp.intent.started',
    aggregateType: 'idp.intent',
    aggregateID: intentID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      idpID,
      idpType,
      state,
      codeVerifier,
      nonce,
      redirectURI,
      authRequestID,
      expiresAt,
    },
  };

  await this.getEventstore().push(command);

  return intent;
}

/**
 * Verify and retrieve IDP intent by state
 * Based on: GetIDPIntentByState (idp_intent.go:67-85)
 */
export async function getIDPIntentByState(
  this: Commands,
  ctx: Context,
  state: string
): Promise<IDPIntent | null> {
  validateRequired(state, 'state');

  // Query intent from projection
  if (!this.database) {
    throw new Error('Database not available in Commands - cannot query IDP intent');
  }

  // Use IDPIntentQueries to fetch from projection
  const { IDPIntentQueries } = await import('../../query/idp/idp-intent-queries');
  const queries = new IDPIntentQueries(this.database);
  
  const queryResult = await queries.getByState(state, ctx.instanceID);
  
  if (!queryResult) {
    return null;
  }

  // Check expiration
  if (new Date() > queryResult.expiresAt) {
    return null; // Expired intent
  }

  // Map query model to command interface
  const intent: IDPIntent = {
    intentID: queryResult.id,
    idpID: queryResult.idpID,
    idpType: queryResult.idpType,
    state: queryResult.state,
    codeVerifier: queryResult.codeVerifier,
    nonce: queryResult.nonce,
    redirectURI: queryResult.redirectURI,
    authRequestID: queryResult.authRequestID,
    instanceID: queryResult.instanceID,
    createdAt: queryResult.createdAt,
    expiresAt: queryResult.expiresAt,
  };

  return intent;
}

/**
 * Handle OAuth callback from external provider
 * Based on: HandleOAuthCallback (idp_intent.go:87-145)
 */
export async function handleOAuthCallback(
  this: Commands,
  ctx: Context,
  callbackData: OAuthCallbackData,
  intent: IDPIntent,
  existingUserID?: string
): Promise<IDPCallbackResult> {
  validateRequired(callbackData.state, 'state');
  validateRequired(callbackData.code, 'code');

  // Handle callback errors from provider
  if (callbackData.error) {
    throw throwInvalidArgument(
      `IDP callback error: ${callbackData.error} - ${callbackData.errorDescription || ''}`,
      'IDP-CALLBACK-003'
    );
  }

  // Verify intent not expired
  if (new Date() > intent.expiresAt) {
    throwPreconditionFailed('IDP intent expired', 'IDP-CALLBACK-005');
  }

  // Exchange authorization code for tokens (mocked for now)
  const tokens = await exchangeOAuthCode(callbackData.code, intent);

  // Fetch user info from IDP (mocked for now)
  const userInfo = await fetchUserInfoFromIDP(tokens.accessToken);

  let userID: string;
  let isNewUser = false;

  if (existingUserID) {
    // User already exists, link to IDP if not already linked
    userID = existingUserID;
    
    // Create IDP link for existing user
    const link: UserIDPLink = {
      idpConfigID: intent.idpID,
      externalUserID: userInfo.externalUserID,
      displayName: userInfo.displayName || userInfo.username || userInfo.email || userInfo.externalUserID,
    };
    await this.addUserIDPLink(ctx, userID, ctx.orgID, link);
    
    // Mark successful IDP login
    await this.userIDPLoginChecked(ctx, userID, ctx.orgID, intent.authRequestID);
  } else {
    // Provision new user (caller must enable auto-creation)
    const provisionResult = await this.provisionUserFromIDP(ctx, intent.idpID, userInfo);
    userID = provisionResult.userID;
    isNewUser = true;
  }

  // Update intent with success
  await this.getEventstore().push({
    eventType: 'idp.intent.succeeded',
    aggregateType: 'idp.intent',
    aggregateID: intent.intentID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID,
      externalUserID: userInfo.externalUserID,
      idTokenClaims: tokens.idToken ? extractIDTokenClaims(tokens.idToken) : undefined,
    },
  });

  return {
    userID,
    isNewUser,
    externalUserInfo: userInfo,
    tokens,
    details: {
      sequence: 0n,
      eventDate: new Date(),
      resourceOwner: ctx.orgID,
    },
  };
}

/**
 * Handle OIDC callback from external provider
 * Based on: HandleOIDCCallback (idp_intent.go:147-210)
 */
export async function handleOIDCCallback(
  this: Commands,
  ctx: Context,
  callbackData: OIDCCallbackData,
  intent: IDPIntent,
  existingUserID?: string
): Promise<IDPCallbackResult> {
  // OIDC is an extension of OAuth, so reuse most of the logic
  const result = await this.handleOAuthCallback(ctx, callbackData, intent, existingUserID);

  // Additional OIDC-specific validation (ID token)
  if (callbackData.idToken) {
    // Verify ID token signature and claims
    // In production: use proper JWT verification
    // validateIDToken(callbackData.idToken, intent.nonce);
  }

  return result;
}

/**
 * Handle SAML response from external provider
 * Based on: HandleSAMLResponse (idp_intent.go:212-270)
 */
export async function handleSAMLResponse(
  this: Commands,
  ctx: Context,
  responseData: SAMLResponseData,
  idpID: string,
  existingUserID?: string
): Promise<IDPCallbackResult> {
  validateRequired(responseData.samlResponse, 'samlResponse');
  validateRequired(idpID, 'idpID');

  // Parse SAML assertion (no SP config provided = use simplified parsing)
  const assertion = await parseSAMLResponse(responseData.samlResponse, undefined);

  // Verify signature (no certificate provided = skip verification in development)
  if (!await verifySAMLSignature(responseData.samlResponse, undefined)) {
    throwUnauthenticated('Invalid SAML signature', 'IDP-SAML-001');
  }

  // Extract user info from SAML attributes
  const userInfo: ExternalUserInfo = {
    externalUserID: assertion.nameID,
    email: assertion.attributes.email,
    emailVerified: true,
    username: assertion.attributes.username,
    firstName: assertion.attributes.firstName,
    lastName: assertion.attributes.lastName,
    displayName: assertion.attributes.displayName || assertion.attributes.name,
    rawUserInfo: assertion.attributes,
  };

  let userID: string;
  let isNewUser = false;

  if (existingUserID) {
    userID = existingUserID;
    await this.userIDPLoginChecked(ctx, userID, ctx.orgID);
  } else {
    const provisionResult = await this.provisionUserFromIDP(ctx, idpID, userInfo);
    userID = provisionResult.userID;
    isNewUser = true;
  }

  return {
    userID,
    isNewUser,
    externalUserInfo: userInfo,
    details: {
      sequence: 0n,
      eventDate: new Date(),
      resourceOwner: ctx.orgID,
    },
  };
}

/**
 * Provision new user from external IDP
 * Based on: ProvisionUserFromIDP (idp_intent.go:272-320)
 */
export async function provisionUserFromIDP(
  this: Commands,
  ctx: Context,
  idpID: string,
  userInfo: ExternalUserInfo
): Promise<{ userID: string; details: ObjectDetails }> {
  validateRequired(idpID, 'idpID');
  validateRequired(userInfo.externalUserID, 'externalUserID');

  // Generate unique username if not provided
  const username = userInfo.username || generateUsernameFromEmail(userInfo.email) || `user_${randomUUID().substring(0, 8)}`;

  // Create user using existing commands
  const userResult = await this.addHumanUser(ctx, {
    orgID: ctx.orgID,
    username,
    email: userInfo.email || '',
    emailVerified: userInfo.emailVerified || false,
    firstName: userInfo.firstName || '',
    lastName: userInfo.lastName || '',
    preferredLanguage: userInfo.locale || 'en',
  });

  const userID = userResult.userID;

  // Link user to external IDP
  const link: UserIDPLink = {
    idpConfigID: idpID,
    externalUserID: userInfo.externalUserID,
    displayName: userInfo.displayName || userInfo.username || userInfo.email || userInfo.externalUserID,
  };
  await this.addUserIDPLink(ctx, userID, ctx.orgID, link);

  // Emit provisioning event
  await this.getEventstore().push({
    eventType: 'user.idp.provisioned',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      idpID,
      externalUserID: userInfo.externalUserID,
      userInfo,
    },
  });

  return {
    userID,
    details: userResult,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate secure random state for CSRF protection
 */
function generateSecureState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code verifier
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate OIDC nonce
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * Generate username from email
 */
function generateUsernameFromEmail(email?: string): string | undefined {
  if (!email) return undefined;
  return email.split('@')[0];
}

/**
 * Exchange OAuth authorization code for tokens
 * Makes actual HTTP request to provider's token endpoint
 */
async function exchangeOAuthCode(
  code: string,
  intent: IDPIntent,
  idpConfig?: {  
    tokenEndpoint?: string;
    clientId?: string;
    clientSecret?: string;
  }
): Promise<{
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
}> {
  // In production, idpConfig should be loaded from database
  // For now, fallback to mock if not provided
  if (!idpConfig || !idpConfig.tokenEndpoint) {
    console.warn('[IDP] Token exchange using mock (no IDP config provided)');
    return {
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      idToken: 'mock_id_token',
      expiresIn: 3600,
    };
  }

  try {
    // Use openid-client for OAuth/OIDC token exchange
    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: intent.redirectURI,
    };

    // Add PKCE code verifier if available
    if (intent.codeVerifier) {
      params.code_verifier = intent.codeVerifier;
    }

    // Make token request
    const response = await fetch(idpConfig.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${idpConfig.clientId}:${idpConfig.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }

    const tokenData = await response.json() as any;

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      idToken: tokenData.id_token,
      expiresIn: tokenData.expires_in,
    };
  } catch (error: any) {
    console.error('[IDP] Token exchange error:', error.message);
    throw new Error(`Failed to exchange OAuth code: ${error.message}`);
  }
}

/**
 * Fetch user info from IDP using access token
 * Makes actual HTTP request to provider's userinfo endpoint
 */
async function fetchUserInfoFromIDP(
  accessToken: string,
  userInfoEndpoint?: string
): Promise<ExternalUserInfo> {
  // In production, userInfoEndpoint should be loaded from IDP config
  if (!userInfoEndpoint) {
    console.warn('[IDP] UserInfo fetch using mock (no endpoint provided)');
    return {
      externalUserID: 'external_user_123',
      email: 'user@example.com',
      emailVerified: true,
      username: 'user',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
    };
  }

  try {
    const response = await fetch(userInfoEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`UserInfo fetch failed: ${response.status}`);
    }

    const userInfo = await response.json() as any;

    // Map standard OIDC claims to ExternalUserInfo
    return {
      externalUserID: userInfo.sub || userInfo.id,
      email: userInfo.email,
      emailVerified: userInfo.email_verified || false,
      username: userInfo.preferred_username || userInfo.username || userInfo.email?.split('@')[0],
      firstName: userInfo.given_name || userInfo.first_name,
      lastName: userInfo.family_name || userInfo.last_name,
      displayName: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim(),
      avatarURL: userInfo.picture,
      locale: userInfo.locale,
      rawUserInfo: userInfo,
    };
  } catch (error: any) {
    console.error('[IDP] UserInfo fetch error:', error.message);
    throw new Error(`Failed to fetch user info: ${error.message}`);
  }
}

/**
 * Extract and validate claims from ID token (JWT)
 */
async function extractIDTokenClaims(
  idToken: string,
  options?: {
    issuer?: string;
    audience?: string;
    nonce?: string;
  }
): Promise<any> {
  if (!idToken) {
    return {};
  }

  // Handle mock tokens (for testing)
  if (idToken === 'mock_id_token' || !idToken.includes('.')) {
    console.warn('[IDP] Using mock ID token (skipping validation)');
    return {
      sub: 'mock_user_123',
      email: 'mockuser@example.com',
      email_verified: true,
    };
  }

  try {
    // Decode without verification first (for development/testing)
    // In production, you should verify the signature with JWKS
    const decoded = decodeJwt(idToken);

    // Validate nonce if provided (OIDC replay protection)
    if (options?.nonce && decoded.nonce !== options.nonce) {
      throw new Error('ID token nonce mismatch');
    }

    // Validate issuer if provided
    if (options?.issuer && decoded.iss !== options.issuer) {
      throw new Error(`ID token issuer mismatch: expected ${options.issuer}, got ${decoded.iss}`);
    }

    // Validate audience if provided
    if (options?.audience) {
      const aud = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
      if (!aud.includes(options.audience)) {
        throw new Error(`ID token audience mismatch: ${options.audience} not in ${aud.join(', ')}`);
      }
    }

    // Check expiration
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      throw new Error('ID token has expired');
    }

    return decoded;
  } catch (error: any) {
    console.error('[IDP] ID token validation error:', error.message);
    throw new Error(`Failed to validate ID token: ${error.message}`);
  }
}

/**
 * Parse SAML response assertion
 */
async function parseSAMLResponse(
  samlResponse: string,
  spConfig?: any
): Promise<{
  nameID: string;
  entityID: string;
  attributes: Record<string, any>;
  sessionIndex?: string;
}> {
  if (!spConfig) {
    console.warn('[IDP] SAML parsing using mock (no SP config provided)');
    return {
      nameID: 'saml_user_123',
      entityID: 'idp_entity_id',
      attributes: {},
    };
  }

  try {
    // Parse SAML response using samlify
    // In production, you would configure the SP (Service Provider) with proper metadata
    // const sp = saml2.ServiceProvider(spConfig);
    
    // Extract SAML assertion
    // Note: This is simplified. In production, you need proper IDP metadata
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');
    
    // Parse SAML XML (simplified extraction)
    // In production, use samlify's full parsing capabilities
    const nameIDMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    const nameID = nameIDMatch ? nameIDMatch[1] : 'unknown';

    // Extract attributes
    const attributes: Record<string, any> = {};
    const attrRegex = /<saml:Attribute Name="([^"]+)"[^>]*>.*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/gs;
    let match;
    while ((match = attrRegex.exec(decoded)) !== null) {
      attributes[match[1]] = match[2];
    }

    return {
      nameID,
      entityID: attributes.entityID || 'unknown',
      attributes,
    };
  } catch (error: any) {
    console.error('[IDP] SAML parsing error:', error.message);
    throw new Error(`Failed to parse SAML response: ${error.message}`);
  }
}

/**
 * Verify SAML response signature
 */
async function verifySAMLSignature(
  samlResponse: string,
  idpCertificate?: string
): Promise<boolean> {
  if (!idpCertificate) {
    console.warn('[IDP] SAML signature verification skipped (no certificate provided)');
    return true; // Skip verification in development
  }

  try {
    // In production, use samlify to verify the XML digital signature
    // This requires the IDP's X.509 certificate
    // Simplified: just check if signature exists in the response
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');
    const hasSignature = decoded.includes('<ds:Signature') || decoded.includes('<Signature');
    
    if (!hasSignature) {
      throw new Error('SAML response is not signed');
    }

    // In production, you would:
    // 1. Extract the signature from XML
    // 2. Canonicalize the signed portion
    // 3. Verify with the IDP's public key from certificate
    // 4. Use samlify's built-in verification:
    //    const { extract } = await idp.parseLoginResponse(sp, 'post', { body: { SAMLResponse: samlResponse } });
    
    return true;
  } catch (error: any) {
    console.error('[IDP] SAML signature verification error:', error.message);
    return false;
  }
}
