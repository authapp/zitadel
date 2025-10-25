/**
 * Provider Helper Functions
 * 
 * Convenience wrappers for popular IDP providers with pre-configured defaults
 * Based on Go: internal/command/idp_config.go provider-specific helpers
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { ObjectDetails } from '../write-model';
import { OIDCIDPData } from '../org/org-idp-commands';

/**
 * Google IDP Configuration Data
 */
export interface GoogleIDPData {
  idpID?: string;
  name: string;
  clientID: string;
  clientSecret: string;
  scopes?: string[];
  stylingType?: number;
  isCreationAllowed?: boolean;
  isLinkingAllowed?: boolean;
  isAutoCreation?: boolean;
  isAutoUpdate?: boolean;
}

/**
 * Azure AD IDP Configuration Data
 */
export interface AzureADIDPData {
  idpID?: string;
  name: string;
  clientID: string;
  clientSecret: string;
  tenant: string;  // Azure AD tenant ID or domain
  scopes?: string[];
  isEmailVerified?: boolean;
  stylingType?: number;
  isCreationAllowed?: boolean;
  isLinkingAllowed?: boolean;
  isAutoCreation?: boolean;
  isAutoUpdate?: boolean;
}

/**
 * Apple IDP Configuration Data
 */
export interface AppleIDPData {
  idpID?: string;
  name: string;
  clientID: string;    // Apple Services ID
  teamID: string;      // Apple Team ID
  keyID: string;       // Apple Key ID
  privateKey: Buffer;  // Apple private key for client secret generation
  scopes?: string[];
  stylingType?: number;
  isCreationAllowed?: boolean;
  isLinkingAllowed?: boolean;
  isAutoCreation?: boolean;
  isAutoUpdate?: boolean;
}

/**
 * Add Google IDP to Organization
 * Convenience wrapper over addOIDCIDPToOrg with Google-specific defaults
 * Based on Go: AddGoogleIDP (idp_config.go)
 */
export async function addGoogleIDPToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: GoogleIDPData
): Promise<ObjectDetails> {
  // Build OIDC config with Google defaults
  const oidcConfig: OIDCIDPData = {
    idpID: data.idpID,
    name: data.name,
    issuer: 'https://accounts.google.com',
    clientID: data.clientID,
    clientSecret: data.clientSecret,
    scopes: data.scopes || ['openid', 'profile', 'email'],
    stylingType: data.stylingType,
    isCreationAllowed: data.isCreationAllowed,
    isLinkingAllowed: data.isLinkingAllowed,
    isAutoCreation: data.isAutoCreation,
    isAutoUpdate: data.isAutoUpdate,
  };

  // Call existing OIDC command
  return await this.addOIDCIDPToOrg(ctx, orgID, oidcConfig);
}

/**
 * Add Azure AD IDP to Organization
 * Convenience wrapper over addOIDCIDPToOrg with Azure-specific defaults
 * Based on Go: AddAzureADIDP (idp_config.go)
 */
export async function addAzureADIDPToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: AzureADIDPData
): Promise<ObjectDetails> {
  // Construct tenant-specific issuer
  // Azure AD v2.0 endpoint: https://login.microsoftonline.com/{tenant}/v2.0
  const issuer = `https://login.microsoftonline.com/${data.tenant}/v2.0`;
  
  // Default scopes for Azure AD
  const defaultScopes = ['openid', 'profile', 'email'];
  
  // Build OIDC config with Azure AD defaults
  const oidcConfig: OIDCIDPData = {
    idpID: data.idpID,
    name: data.name,
    issuer,
    clientID: data.clientID,
    clientSecret: data.clientSecret,
    scopes: data.scopes || defaultScopes,
    stylingType: data.stylingType,
    isCreationAllowed: data.isCreationAllowed,
    isLinkingAllowed: data.isLinkingAllowed,
    isAutoCreation: data.isAutoCreation,
    isAutoUpdate: data.isAutoUpdate,
  };

  // Call existing OIDC command
  return await this.addOIDCIDPToOrg(ctx, orgID, oidcConfig);
}

/**
 * Generate Apple Client Secret
 * Apple requires a JWT signed with the private key as the client secret
 * This is a simplified version - in production, use a proper JWT library
 */
function generateAppleClientSecret(
  teamID: string,
  clientID: string,
  keyID: string,
  _privateKey: Buffer  // TODO: use for JWT signing with ES256
): string {
  // In a real implementation, this would:
  // 1. Create JWT header with kid (key ID) and alg (ES256)
  // 2. Create JWT payload with iss (team ID), iat (issued at), exp (expiry), aud, sub (client ID)
  // 3. Sign with ES256 using the private key
  // 4. Return the signed JWT
  
  // For now, return a placeholder
  // TODO: Implement proper JWT signing with ES256
  return `apple_client_secret_${teamID}_${clientID}_${keyID}`;
}

/**
 * Add Apple IDP to Organization
 * Convenience wrapper over addOIDCIDPToOrg with Apple-specific defaults
 * Based on Go: AddAppleIDP (idp_config.go)
 */
export async function addAppleIDPToOrg(
  this: Commands,
  ctx: Context,
  orgID: string,
  data: AppleIDPData
): Promise<ObjectDetails> {
  // Generate Apple client secret (JWT signed with private key)
  const clientSecret = generateAppleClientSecret(
    data.teamID,
    data.clientID,
    data.keyID,
    data.privateKey
  );

  // Build OIDC config with Apple defaults
  const oidcConfig: OIDCIDPData = {
    idpID: data.idpID,
    name: data.name,
    issuer: 'https://appleid.apple.com',
    clientID: data.clientID,
    clientSecret,
    scopes: data.scopes || ['openid', 'email', 'name'],
    stylingType: data.stylingType,
    isCreationAllowed: data.isCreationAllowed,
    isLinkingAllowed: data.isLinkingAllowed,
    isAutoCreation: data.isAutoCreation,
    isAutoUpdate: data.isAutoUpdate,
  };

  // Call existing OIDC command
  return await this.addOIDCIDPToOrg(ctx, orgID, oidcConfig);
}
