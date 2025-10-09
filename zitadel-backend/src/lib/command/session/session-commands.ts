/**
 * Session Commands (Phase 3)
 * 
 * Implements session management following Zitadel Go patterns
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { SessionWriteModel, SessionState } from './session-write-model';
import { UserWriteModel, UserState } from '../user/user-write-model';
import { Command } from '../../eventstore/types';

/**
 * Session creation data
 */
export interface CreateSessionData {
  sessionID?: string;
  userID: string;
  orgID: string;
  userAgent?: string;
  clientIP?: string;
  metadata?: Record<string, string>;
}

/**
 * Session update data
 */
export interface UpdateSessionData {
  userAgent?: string;
  clientIP?: string;
  metadata?: Record<string, string>;
}

/**
 * Session token data
 */
export interface SessionTokenData {
  tokenID: string;
  token: string;
  expiry: Date;
}

/**
 * Authentication factor data
 */
export interface AuthFactorData {
  type: 'password' | 'otp' | 'webauthn' | 'idp';
  verified: boolean;
  verifiedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Create session command
 */
export async function createSession(
  this: Commands,
  ctx: Context,
  data: CreateSessionData
): Promise<ObjectDetails & { sessionID: string }> {
  // 1. Validate input
  if (!data.userID) {
    throwInvalidArgument('userID is required', 'COMMAND-Session01');
  }
  if (!data.orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-Session02');
  }

  // 2. Generate session ID if not provided
  if (!data.sessionID) {
    data.sessionID = await this.nextID();
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'session', 'create', data.orgID);

  // 4. Validate user exists and is active
  const userWM = new UserWriteModel();
  await userWM.load(this.getEventstore(), data.userID, data.orgID);
  
  if (userWM.state === UserState.UNSPECIFIED) {
    throwNotFound('user not found', 'COMMAND-Session03');
  }
  if (userWM.state === UserState.DELETED) {
    throwNotFound('user deleted', 'COMMAND-Session04');
  }
  if (userWM.state === UserState.INACTIVE) {
    throwPreconditionFailed('user inactive', 'COMMAND-Session05');
  }

  // 5. Create session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), data.sessionID, data.orgID);

  if (wm.state !== SessionState.UNSPECIFIED) {
    throwPreconditionFailed('session already exists', 'COMMAND-Session06');
  }

  // 6. Create command
  const command: Command = {
    eventType: 'session.created',
    aggregateType: 'session',
    aggregateID: data.sessionID,
    owner: data.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID: data.userID,
      userAgent: data.userAgent,
      clientIP: data.clientIP,
      metadata: data.metadata || {},
    },
  };

  // 7. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    ...writeModelToObjectDetails(wm),
    sessionID: data.sessionID,
  };
}

/**
 * Update session command
 */
export async function updateSession(
  this: Commands,
  ctx: Context,
  sessionID: string,
  orgID: string,
  data: UpdateSessionData
): Promise<ObjectDetails> {
  // 1. Load session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), sessionID, orgID);

  if (wm.state === SessionState.UNSPECIFIED) {
    throwNotFound('session not found', 'COMMAND-Session10');
  }
  if (wm.state === SessionState.TERMINATED) {
    throwPreconditionFailed('session terminated', 'COMMAND-Session11');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'session', 'update', orgID);

  // 3. Create command
  const command: Command = {
    eventType: 'session.updated',
    aggregateType: 'session',
    aggregateID: sessionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userAgent: data.userAgent,
      clientIP: data.clientIP,
      metadata: data.metadata,
    },
  };

  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Terminate session command
 */
export async function terminateSession(
  this: Commands,
  ctx: Context,
  sessionID: string,
  orgID: string
): Promise<ObjectDetails> {
  // 1. Load session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), sessionID, orgID);

  if (wm.state === SessionState.UNSPECIFIED) {
    throwNotFound('session not found', 'COMMAND-Session20');
  }
  if (wm.state === SessionState.TERMINATED) {
    throwPreconditionFailed('session already terminated', 'COMMAND-Session21');
  }

  // 2. Check permissions
  await this.checkPermission(ctx, 'session', 'delete', orgID);

  // 3. Create command
  const command: Command = {
    eventType: 'session.terminated',
    aggregateType: 'session',
    aggregateID: sessionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      reason: 'manual_termination',
    },
  };

  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Set session token command
 */
export async function setSessionToken(
  this: Commands,
  ctx: Context,
  sessionID: string,
  orgID: string,
  tokenData: SessionTokenData
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!tokenData.tokenID) {
    throwInvalidArgument('tokenID is required', 'COMMAND-Session30');
  }
  if (!tokenData.token) {
    throwInvalidArgument('token is required', 'COMMAND-Session31');
  }
  if (!tokenData.expiry) {
    throwInvalidArgument('expiry is required', 'COMMAND-Session32');
  }

  // 2. Load session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), sessionID, orgID);

  if (wm.state === SessionState.UNSPECIFIED) {
    throwNotFound('session not found', 'COMMAND-Session33');
  }
  if (wm.state === SessionState.TERMINATED) {
    throwPreconditionFailed('session terminated', 'COMMAND-Session34');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'session', 'update', orgID);

  // 4. Create command
  const command: Command = {
    eventType: 'session.token.set',
    aggregateType: 'session',
    aggregateID: sessionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      tokenID: tokenData.tokenID,
      token: tokenData.token,
      expiry: tokenData.expiry.toISOString(),
    },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Check session token command
 */
export async function checkSessionToken(
  this: Commands,
  _ctx: Context,
  sessionID: string,
  orgID: string,
  tokenID: string,
  token: string
): Promise<{ valid: boolean; session?: ObjectDetails }> {
  // 1. Load session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), sessionID, orgID);

  if (wm.state === SessionState.UNSPECIFIED) {
    return { valid: false };
  }
  if (wm.state === SessionState.TERMINATED) {
    return { valid: false };
  }

  // 2. Check token
  const sessionToken = wm.tokens.get(tokenID);
  if (!sessionToken) {
    return { valid: false };
  }

  if (sessionToken.token !== token) {
    return { valid: false };
  }

  if (new Date() > sessionToken.expiry) {
    return { valid: false };
  }

  return {
    valid: true,
    session: writeModelToObjectDetails(wm),
  };
}

/**
 * Set authentication factor command
 */
export async function setAuthFactor(
  this: Commands,
  ctx: Context,
  sessionID: string,
  orgID: string,
  factor: AuthFactorData
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!factor.type) {
    throwInvalidArgument('factor type is required', 'COMMAND-Session40');
  }

  // 2. Load session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), sessionID, orgID);

  if (wm.state === SessionState.UNSPECIFIED) {
    throwNotFound('session not found', 'COMMAND-Session41');
  }
  if (wm.state === SessionState.TERMINATED) {
    throwPreconditionFailed('session terminated', 'COMMAND-Session42');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'session', 'update', orgID);

  // 4. Create command
  const command: Command = {
    eventType: 'session.factor.set',
    aggregateType: 'session',
    aggregateID: sessionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      type: factor.type,
      verified: factor.verified,
      verifiedAt: factor.verifiedAt?.toISOString(),
      metadata: factor.metadata || {},
    },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Set session metadata command
 */
export async function setSessionMetadata(
  this: Commands,
  ctx: Context,
  sessionID: string,
  orgID: string,
  key: string,
  value: string
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!key) {
    throwInvalidArgument('metadata key is required', 'COMMAND-Session50');
  }

  // 2. Load session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), sessionID, orgID);

  if (wm.state === SessionState.UNSPECIFIED) {
    throwNotFound('session not found', 'COMMAND-Session51');
  }
  if (wm.state === SessionState.TERMINATED) {
    throwPreconditionFailed('session terminated', 'COMMAND-Session52');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'session', 'update', orgID);

  // 4. Create command
  const command: Command = {
    eventType: 'session.metadata.set',
    aggregateType: 'session',
    aggregateID: sessionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      key,
      value,
    },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Delete session metadata command
 */
export async function deleteSessionMetadata(
  this: Commands,
  ctx: Context,
  sessionID: string,
  orgID: string,
  key: string
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!key) {
    throwInvalidArgument('metadata key is required', 'COMMAND-Session60');
  }

  // 2. Load session write model
  const wm = new SessionWriteModel();
  await wm.load(this.getEventstore(), sessionID, orgID);

  if (wm.state === SessionState.UNSPECIFIED) {
    throwNotFound('session not found', 'COMMAND-Session61');
  }

  // 3. Check permissions
  await this.checkPermission(ctx, 'session', 'update', orgID);

  // 4. Create command
  const command: Command = {
    eventType: 'session.metadata.deleted',
    aggregateType: 'session',
    aggregateID: sessionID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      key,
    },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

