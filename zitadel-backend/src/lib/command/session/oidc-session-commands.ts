/**
 * OIDC Session Commands (Phase 3 - Week 19-20)
 * 
 * Implements OIDC-specific session management following Zitadel Go patterns
 * Reference: internal/command/oidc_session.go
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { SessionWriteModel, SessionState } from './session-write-model';
import { UserWriteModel, UserState } from '../user/user-write-model';
import { Command } from '../../eventstore/types';

/**
 * OIDC session creation data
 */
export interface CreateOIDCSessionData {
  sessionID?: string;
  userID: string;
  orgID: string;
  clientID: string;
  redirectURI: string;
  scope: string[];
  audience?: string[];
  nonce?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'plain' | 'S256';
  responseType?: string[];
  grantType?: string[];
  maxAge?: number;
  userAgent?: string;
  clientIP?: string;
}

/**
 * OIDC session update data
 */
export interface UpdateOIDCSessionData {
  authTime?: Date;
  amr?: string[];  // Authentication Methods References
  accessTokenID?: string;
  refreshTokenID?: string;
  idTokenID?: string;
  expiresAt?: Date;
  userAgent?: string;
  clientIP?: string;
}

/**
 * Create OIDC session command
 * 
 * Creates an OIDC-specific session with OAuth/OIDC parameters
 */
export async function createOIDCSession(
  this: Commands,
  ctx: Context,
  data: CreateOIDCSessionData
): Promise<ObjectDetails & { sessionID: string }> {
  // 1. Validate input
  if (!data.userID) {
    throwInvalidArgument('userID is required', 'COMMAND-OIDCSession01');
  }
  if (!data.orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-OIDCSession02');
  }
  if (!data.clientID) {
    throwInvalidArgument('clientID is required', 'COMMAND-OIDCSession03');
  }
  if (!data.redirectURI) {
    throwInvalidArgument('redirectURI is required', 'COMMAND-OIDCSession04');
  }
  if (!data.scope || data.scope.length === 0) {
    throwInvalidArgument('scope is required', 'COMMAND-OIDCSession05');
  }
  
  // Validate PKCE if provided
  if (data.codeChallenge && !data.codeChallengeMethod) {
    throwInvalidArgument('codeChallengeMethod required with codeChallenge', 'COMMAND-OIDCSession06');
  }
  if (data.codeChallengeMethod && !data.codeChallenge) {
    throwInvalidArgument('codeChallenge required with codeChallengeMethod', 'COMMAND-OIDCSession07');
  }

  // 2. Generate session ID if not provided
  if (!data.sessionID) {
    data.sessionID = await this.nextID();
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'oidc.session', 'create', data.orgID);

  // 4. Validate user exists and is active
  const userWM = new UserWriteModel();
  await userWM.load(this.getEventstore(), data.userID, data.orgID);
  
  if (userWM.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-OIDCSession08');
  }
  if (userWM.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-OIDCSession09');
  }
  if (userWM.state === UserState.INACTIVE) {
    throwPreconditionFailed('user inactive', 'COMMAND-OIDCSession10');
  }

  // 5. Create session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), data.sessionID, data.orgID);

  if (wm.state !== SessionState.UNSPECIFIED) {
    throwPreconditionFailed('session already exists', 'COMMAND-OIDCSession11');
  }

  // 6. Create session event with OIDC data
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'session.created',
    aggregateType: 'session',
    aggregateID: data.sessionID,
    owner: data.orgID,
    creator: ctx.userID || 'system',
    payload: {
      userID: data.userID,
      orgID: data.orgID,
      clientID: data.clientID,
      redirectURI: data.redirectURI,
      scope: data.scope,
      audience: data.audience || [],
      nonce: data.nonce,
      state: data.state,
      codeChallenge: data.codeChallenge,
      codeChallengeMethod: data.codeChallengeMethod,
      responseType: data.responseType || ['code'],
      grantType: data.grantType || ['authorization_code'],
      maxAge: data.maxAge,
      userAgent: data.userAgent,
      clientIP: data.clientIP,
      createdAt: new Date(),
    },
  };

  await this.getEventstore().push(command);

  return {
    sessionID: data.sessionID,
    ...writeModelToObjectDetails(wm),
  };
}

/**
 * Update OIDC session command
 * 
 * Updates OIDC session with token IDs and auth metadata
 */
export async function updateOIDCSession(
  this: Commands,
  ctx: Context,
  sessionID: string,
  orgID: string,
  data: UpdateOIDCSessionData
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!sessionID) {
    throwInvalidArgument('sessionID is required', 'COMMAND-OIDCSession12');
  }
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-OIDCSession13');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'oidc.session', 'update', orgID);

  // 3. Load session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), sessionID, orgID);

  if (wm.state === SessionState.UNSPECIFIED) {
    throwNotFound('session not found', 'COMMAND-OIDCSession14');
  }
  if (wm.state === SessionState.TERMINATED) {
    throwPreconditionFailed('session already terminated', 'COMMAND-OIDCSession15');
  }

  // 4. Update session event with OIDC data
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'session.updated',
    aggregateType: 'session',
    aggregateID: sessionID,
    owner: orgID,
    creator: ctx.userID || 'system',
    payload: {
      authTime: data.authTime,
      amr: data.amr,
      accessTokenID: data.accessTokenID,
      refreshTokenID: data.refreshTokenID,
      idTokenID: data.idTokenID,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      clientIP: data.clientIP,
      updatedAt: new Date(),
    },
  };

  await this.getEventstore().push(command);

  return writeModelToObjectDetails(wm);
}

/**
 * Terminate OIDC session command
 * 
 * Terminates an OIDC session (logout)
 */
export async function terminateOIDCSession(
  this: Commands,
  ctx: Context,
  sessionID: string,
  orgID: string,
  reason?: string
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!sessionID) {
    throwInvalidArgument('sessionID is required', 'COMMAND-OIDCSession16');
  }
  if (!orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-OIDCSession17');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'oidc.session', 'terminate', orgID);

  // 3. Load session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), sessionID, orgID);

  if (wm.state === SessionState.UNSPECIFIED) {
    throwNotFound('session not found', 'COMMAND-OIDCSession18');
  }
  if (wm.state === SessionState.TERMINATED) {
    throwPreconditionFailed('session already terminated', 'COMMAND-OIDCSession19');
  }

  // 4. Terminate session event
  const command: Command = {
    instanceID: ctx.instanceID,
    eventType: 'session.terminated',
    aggregateType: 'session',
    aggregateID: sessionID,
    owner: orgID,
    creator: ctx.userID || 'system',
    payload: {
      reason: reason || 'user_logout',
      terminatedAt: new Date(),
    },
  };

  await this.getEventstore().push(command);

  return writeModelToObjectDetails(wm);
}
