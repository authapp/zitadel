/**
 * OAuth Token Commands (Phase 3 - Sprint 2)
 * 
 * Implements OAuth 2.0 token management following Zitadel Go patterns
 * Reference: internal/command/oauth_token.go
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { ObjectDetails, WriteModel, writeModelToObjectDetails } from '../write-model';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command, Event } from '../../eventstore/types';

/**
 * OAuth Token State
 */
export enum OAuthTokenState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REVOKED = 2,
  EXPIRED = 3,
}

/**
 * OAuth Token Type
 */
export enum OAuthTokenType {
  ACCESS_TOKEN = 'access_token',
  REFRESH_TOKEN = 'refresh_token',
}

/**
 * OAuth Token Write Model
 */
export class OAuthTokenWriteModel extends WriteModel {
  state: OAuthTokenState = OAuthTokenState.UNSPECIFIED;
  tokenType: OAuthTokenType = OAuthTokenType.ACCESS_TOKEN;
  clientID: string = '';
  userID: string = '';
  scope: string[] = [];
  audience: string[] = [];
  issuedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;

  constructor() {
    super('oauth_token');
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'oauth.token.added':
        this.state = OAuthTokenState.ACTIVE;
        this.tokenType = event.payload?.tokenType || OAuthTokenType.ACCESS_TOKEN;
        this.clientID = event.payload?.clientID || '';
        this.userID = event.payload?.userID || '';
        this.scope = event.payload?.scope || [];
        this.audience = event.payload?.audience || [];
        this.issuedAt = event.payload?.issuedAt ? new Date(event.payload.issuedAt) : undefined;
        this.expiresAt = event.payload?.expiresAt ? new Date(event.payload.expiresAt) : undefined;
        break;

      case 'oauth.token.revoked':
        this.state = OAuthTokenState.REVOKED;
        this.revokedAt = event.payload?.revokedAt ? new Date(event.payload.revokedAt) : undefined;
        break;
    }
  }

  exists(): boolean {
    return this.state === OAuthTokenState.ACTIVE || this.state === OAuthTokenState.EXPIRED;
  }
}

/**
 * OAuth Token Introspection Result
 */
export interface TokenIntrospection {
  active: boolean;
  scope?: string[];
  clientID?: string;
  username?: string;
  tokenType?: OAuthTokenType;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string[];
  iss?: string;
  jti?: string;
}

/**
 * Revoke OAuth token command
 * 
 * Revokes an OAuth 2.0 access or refresh token
 * Reference: RFC 7009 - OAuth 2.0 Token Revocation
 */
export async function revokeOAuthToken(
  this: Commands,
  ctx: Context,
  tokenID: string,
  orgID: string,
  revokedBy?: string
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!tokenID) {
    throwInvalidArgument('tokenID is required', 'COMMAND-OAuth01');
  }
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-OAuth02');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'oauth.token', 'revoke', orgID);

  // 3. Load token write model
  const wm = new OAuthTokenWriteModel();
  await wm.load(this.getEventstore(), tokenID, orgID);

  if (wm.state === OAuthTokenState.UNSPECIFIED) {
    throwNotFound('token not found', 'COMMAND-OAuth03');
  }
  if (wm.state === OAuthTokenState.REVOKED) {
    throwPreconditionFailed('token already revoked', 'COMMAND-OAuth04');
  }

  // 4. Create revocation event
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'oauth.token.revoked',
    aggregateType: 'oauth_token',
    aggregateID: tokenID,
    owner: orgID,
    creator: ctx.userID || 'system',
    payload: {
      revokedAt: new Date(),
      revokedBy: revokedBy || ctx.userID || 'system',
    },
  };

  await this.getEventstore().push(command);

  return writeModelToObjectDetails(wm);
}

/**
 * Introspect OAuth token command
 * 
 * Returns metadata about an OAuth 2.0 token
 * Reference: RFC 7662 - OAuth 2.0 Token Introspection
 */
export async function introspectOAuthToken(
  this: Commands,
  ctx: Context,
  tokenID: string,
  orgID: string
): Promise<TokenIntrospection> {
  // 1. Validate input
  if (!tokenID) {
    throwInvalidArgument('tokenID is required', 'COMMAND-OAuth10');
  }
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-OAuth11');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'oauth.token', 'introspect', orgID);

  // 3. Load token write model
  const wm = new OAuthTokenWriteModel();
  await wm.load(this.getEventstore(), tokenID, orgID);

  // 4. If token doesn't exist or is revoked, return inactive
  if (wm.state === OAuthTokenState.UNSPECIFIED || wm.state === OAuthTokenState.REVOKED) {
    return { active: false };
  }

  // 5. Check if token is expired
  const now = Date.now();
  const isExpired = wm.expiresAt && wm.expiresAt.getTime() < now;
  
  if (isExpired) {
    return { active: false };
  }

  // 6. Return introspection data
  return {
    active: true,
    scope: wm.scope,
    clientID: wm.clientID,
    username: wm.userID,
    tokenType: wm.tokenType,
    exp: wm.expiresAt ? Math.floor(wm.expiresAt.getTime() / 1000) : undefined,
    iat: wm.issuedAt ? Math.floor(wm.issuedAt.getTime() / 1000) : undefined,
    sub: wm.userID,
    aud: wm.audience,
    iss: ctx.instanceID,
    jti: tokenID,
  };
}
