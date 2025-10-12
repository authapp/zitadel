/**
 * User Initialization Commands
 * 
 * User registration and email verification flow
 * Based on Go: internal/command/user_human_init.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import { HumanInitCodeWriteModel, UserState } from './user-init-write-model';

/**
 * Generate initialization code (6-digit)
 */
function generateInitCode(): { code: string; expiry: number } {
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  return { code, expiry };
}

/**
 * Verify code matches and hasn't expired
 */
function verifyCode(
  codeCreationDate: Date,
  codeExpiry: number,
  storedCode: string,
  providedCode: string
): boolean {
  // Check expiry
  const now = new Date();
  const expiryTime = new Date(codeCreationDate.getTime() + codeExpiry);
  if (now > expiryTime) {
    return false;
  }

  // Check code match
  return storedCode === providedCode;
}

/**
 * Resend initial registration mail with verification code
 * Optionally changes email if provided
 * Based on Go: ResendInitialMail (user_human_init.go:16-54)
 */
export async function resendInitialMail(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  email?: string,
  authRequestID?: string
): Promise<{ details: ObjectDetails; code: string }> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Load init code write model
  const wm = new HumanInitCodeWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.userState === UserState.UNSPECIFIED || wm.userState === UserState.DELETED) {
    throwNotFound('User not found', 'INIT-mail01');
  }

  if (wm.userState !== UserState.INITIAL) {
    throwPreconditionFailed('User already initialized', 'INIT-mail02');
  }

  // Check permissions
  await this.checkPermission(ctx, 'user.write', 'write', orgID);

  const commands: Command[] = [];

  // If email changed, add email change event
  if (email && wm.hasEmailChanged(email)) {
    commands.push({
      eventType: 'user.human.email.changed',
      aggregateType: 'user',
      aggregateID: userID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        email,
        emailAddress: email,
      },
    });
  }

  // Generate new init code
  const { code, expiry } = generateInitCode();

  commands.push({
    eventType: 'user.human.init.code.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      code, // Should be encrypted in production
      expiry,
      authRequestID: authRequestID || wm.authRequestID || '',
    },
  });

  const events = await this.getEventstore().pushMany(commands);
  for (const event of events) {
    appendAndReduce(wm, event);
  }

  return {
    details: writeModelToObjectDetails(wm),
    code, // Return for testing/development (production: send via email)
  };
}

/**
 * Verify initialization code and optionally set password
 * Completes user registration
 * Based on Go: HumanVerifyInitCode (user_human_init.go:56-94)
 */
export async function humanVerifyInitCode(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  code: string,
  password?: string,
  userAgentID?: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(code, 'code');

  // Load init code write model
  const wm = new HumanInitCodeWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (!wm.code || wm.userState === UserState.UNSPECIFIED || wm.userState === UserState.DELETED) {
    throwNotFound('Initialization code not found', 'INIT-verify01');
  }

  if (!wm.codeCreationDate) {
    throwPreconditionFailed('Code creation date missing', 'INIT-verify02');
  }

  // Verify code
  const isValid = verifyCode(wm.codeCreationDate, wm.codeExpiry, wm.code, code);

  if (!isValid) {
    // Push failed event
    const failedCommand: Command = {
      eventType: 'user.human.init.check.failed',
      aggregateType: 'user',
      aggregateID: userID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {},
    };
    await this.getEventstore().push(failedCommand);
    throwInvalidArgument('Invalid or expired initialization code', 'INIT-verify03');
  }

  // Build success events
  const commands: Command[] = [
    {
      eventType: 'user.human.init.check.succeeded',
      aggregateType: 'user',
      aggregateID: userID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {},
    },
  ];

  // Verify email if not already verified
  if (!wm.isEmailVerified) {
    commands.push({
      eventType: 'user.human.email.verified',
      aggregateType: 'user',
      aggregateID: userID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {},
    });
  }

  // Set password if provided
  if (password) {
    // In production: hash password with bcrypt
    // For now, simplified
    commands.push({
      eventType: 'user.human.password.changed',
      aggregateType: 'user',
      aggregateID: userID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        password, // Should be hashed
        changeRequired: false,
        userAgentID: userAgentID || 'unknown',
      },
    });
  }

  const events = await this.getEventstore().pushMany(commands);
  for (const event of events) {
    appendAndReduce(wm, event);
  }

  return writeModelToObjectDetails(wm);
}

/**
 * Mark initialization code as sent (notification system callback)
 * Based on Go: HumanInitCodeSent (user_human_init.go:96-110)
 */
export async function humanInitCodeSent(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Load init code write model
  const wm = new HumanInitCodeWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.userState === UserState.UNSPECIFIED || wm.userState === UserState.DELETED) {
    throwNotFound('User or code not found', 'INIT-sent01');
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.init.code.sent',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}
