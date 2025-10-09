/**
 * Authentication Commands (Phase 3)
 * 
 * Implements authentication flow commands
 */

import { Context } from '../context';
import { Commands } from '../commands';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { AuthRequestWriteModel, AuthRequestState } from './auth-request-write-model';
import { Command } from '../../eventstore/types';

/**
 * Authentication request data
 */
export interface AddAuthRequestData {
  authRequestID?: string;
  clientID: string;
  redirectURI: string;
  responseType: string;
  scope: string[];
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  userID?: string;
  orgID?: string;
}

/**
 * User selection data
 */
export interface SelectUserData {
  userID: string;
  orgID: string;
}

/**
 * Password check data
 */
export interface CheckPasswordData {
  password: string;
}

/**
 * Add authentication request command
 */
export async function addAuthRequest(
  this: Commands,
  ctx: Context,
  data: AddAuthRequestData
): Promise<ObjectDetails & { authRequestID: string }> {
  // 1. Validate input
  if (!data.clientID) {
    throwInvalidArgument('clientID is required', 'COMMAND-Auth01');
  }
  if (!data.redirectURI) {
    throwInvalidArgument('redirectURI is required', 'COMMAND-Auth02');
  }
  if (!data.responseType) {
    throwInvalidArgument('responseType is required', 'COMMAND-Auth03');
  }
  if (!data.scope || data.scope.length === 0) {
    throwInvalidArgument('scope is required', 'COMMAND-Auth04');
  }

  // 2. Generate auth request ID if not provided
  if (!data.authRequestID) {
    data.authRequestID = await this.nextID();
  }

  // 3. Create auth request write model
  const wm = new AuthRequestWriteModel();
  await wm.load(this.getEventstore(), data.authRequestID, ctx.instanceID);

  if (wm.state !== AuthRequestState.UNSPECIFIED) {
    throwPreconditionFailed('auth request already exists', 'COMMAND-Auth05');
  }

  // 4. Create command
  const command: Command = {
    eventType: 'auth.request.added',
    aggregateType: 'auth_request',
    aggregateID: data.authRequestID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: 'system',
    payload: {
      clientID: data.clientID,
      redirectURI: data.redirectURI,
      responseType: data.responseType,
      scope: data.scope,
      state: data.state,
      nonce: data.nonce,
      codeChallenge: data.codeChallenge,
      codeChallengeMethod: data.codeChallengeMethod,
      userID: data.userID,
      orgID: data.orgID,
    },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    ...writeModelToObjectDetails(wm),
    authRequestID: data.authRequestID,
  };
}

/**
 * Select user for authentication request
 */
export async function selectUser(
  this: Commands,
  ctx: Context,
  authRequestID: string,
  data: SelectUserData
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!data.userID) {
    throwInvalidArgument('userID is required', 'COMMAND-Auth10');
  }
  if (!data.orgID) {
    throwInvalidArgument('orgID is required', 'COMMAND-Auth11');
  }

  // 2. Load auth request write model
  const wm = new AuthRequestWriteModel();
  await wm.load(this.getEventstore(), authRequestID, ctx.instanceID);

  if (wm.state === AuthRequestState.UNSPECIFIED) {
    throwNotFound('auth request not found', 'COMMAND-Auth12');
  }
  if (wm.state === AuthRequestState.SUCCEEDED || wm.state === AuthRequestState.FAILED) {
    throwPreconditionFailed('auth request already completed', 'COMMAND-Auth13');
  }

  // 3. Create command
  const command: Command = {
    eventType: 'auth.request.user.selected',
    aggregateType: 'auth_request',
    aggregateID: authRequestID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userID: data.userID,
      orgID: data.orgID,
    },
  };

  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Check password for authentication request
 */
export async function checkPassword(
  this: Commands,
  ctx: Context,
  authRequestID: string,
  data: CheckPasswordData
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!data.password) {
    throwInvalidArgument('password is required', 'COMMAND-Auth20');
  }

  // 2. Load auth request write model
  const wm = new AuthRequestWriteModel();
  await wm.load(this.getEventstore(), authRequestID, ctx.instanceID);

  if (wm.state === AuthRequestState.UNSPECIFIED) {
    throwNotFound('auth request not found', 'COMMAND-Auth21');
  }
  if (!wm.userID) {
    throwPreconditionFailed('no user selected', 'COMMAND-Auth22');
  }

  // 3. Validate password (simplified - in real implementation would check against user's password)
  const isValidPassword = await validateUserPassword.call(this, wm.userID!, wm.orgID!, data.password);

  // 4. Create command
  const command: Command = {
    eventType: isValidPassword ? 'auth.request.password.checked' : 'auth.request.password.failed',
    aggregateType: 'auth_request',
    aggregateID: authRequestID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      success: isValidPassword,
    },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Check TOTP for authentication request
 */
export async function checkTOTP(
  this: Commands,
  ctx: Context,
  authRequestID: string,
  code: string
): Promise<ObjectDetails> {
  // 1. Validate input
  if (!code) {
    throwInvalidArgument('TOTP code is required', 'COMMAND-Auth30');
  }

  // 2. Load auth request write model
  const wm = new AuthRequestWriteModel();
  await wm.load(this.getEventstore(), authRequestID, ctx.instanceID);

  if (wm.state === AuthRequestState.UNSPECIFIED) {
    throwNotFound('auth request not found', 'COMMAND-Auth31');
  }
  if (!wm.userID) {
    throwPreconditionFailed('no user selected', 'COMMAND-Auth32');
  }

  // 3. Validate TOTP (simplified)
  const isValidTOTP = await validateUserTOTP.call(this, wm.userID!, code);

  // 4. Create command
  const command: Command = {
    eventType: isValidTOTP ? 'auth.request.totp.checked' : 'auth.request.totp.failed',
    aggregateType: 'auth_request',
    aggregateID: authRequestID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      success: isValidTOTP,
    },
  };

  // 5. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Succeed authentication request
 */
export async function succeedAuthRequest(
  this: Commands,
  ctx: Context,
  authRequestID: string
): Promise<ObjectDetails & { authCode?: string }> {
  // 1. Load auth request write model
  const wm = new AuthRequestWriteModel();
  await wm.load(this.getEventstore(), authRequestID, ctx.instanceID);

  if (wm.state === AuthRequestState.UNSPECIFIED) {
    throwNotFound('auth request not found', 'COMMAND-Auth40');
  }
  if (wm.state === AuthRequestState.SUCCEEDED) {
    throwPreconditionFailed('auth request already succeeded', 'COMMAND-Auth41');
  }
  if (wm.state === AuthRequestState.FAILED) {
    throwPreconditionFailed('auth request failed', 'COMMAND-Auth42');
  }

  // 2. Generate auth code if needed
  let authCode: string | undefined;
  if (wm.responseType === 'code') {
    authCode = await generateAuthCode.call(this);
  }

  // 3. Create command
  const command: Command = {
    eventType: 'auth.request.succeeded',
    aggregateType: 'auth_request',
    aggregateID: authRequestID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      authCode,
    },
  };

  // 4. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    ...writeModelToObjectDetails(wm),
    authCode,
  };
}

/**
 * Fail authentication request
 */
export async function failAuthRequest(
  this: Commands,
  ctx: Context,
  authRequestID: string,
  reason: string
): Promise<ObjectDetails> {
  // 1. Load auth request write model
  const wm = new AuthRequestWriteModel();
  await wm.load(this.getEventstore(), authRequestID, ctx.instanceID);

  if (wm.state === AuthRequestState.UNSPECIFIED) {
    throwNotFound('auth request not found', 'COMMAND-Auth50');
  }
  if (wm.state === AuthRequestState.SUCCEEDED || wm.state === AuthRequestState.FAILED) {
    throwPreconditionFailed('auth request already completed', 'COMMAND-Auth51');
  }

  // 2. Create command
  const command: Command = {
    eventType: 'auth.request.failed',
    aggregateType: 'auth_request',
    aggregateID: authRequestID,
    owner: ctx.instanceID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      reason,
    },
  };

  // 3. Push and update
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Helper methods (simplified implementations)
 */
async function validateUserPassword(this: Commands, _userID: string, _orgID: string, password: string): Promise<boolean> {
  // In real implementation, would load user and check password hash
  return password.length >= 8; // Simplified validation
}

async function validateUserTOTP(this: Commands, _userID: string, code: string): Promise<boolean> {
  // In real implementation, would validate TOTP against user's secret
  return code.length === 6 && /^\d+$/.test(code); // Simplified validation
}

async function generateAuthCode(this: Commands): Promise<string> {
  // Generate a secure random auth code
  return await this.nextID();
}
