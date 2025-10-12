/**
 * User Email Verification Commands
 * Based on Zitadel Go: internal/command/user_v2_email.go
 */

import { Context } from '../context';
import { Commands } from '../commands';
import {
  throwNotFound,
  throwPreconditionFailed,
  throwInvalidArgument,
} from '@/zerrors/errors';
import { HumanEmailWriteModel } from './user-email-write-model';
import { UserState } from '../../domain/user';
import { Command } from '../../eventstore/types';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import {
  generateVerificationCode,
  verifyCode,
  DEFAULT_CODE_CONFIGS,
} from '../../crypto/verification-codes';
import { getEmailService } from '../../notification/email-service';

/**
 * Change user email and send verification code
 * Based on Go: ChangeUserEmail (user_v2_email.go:18-20)
 */
export async function changeUserEmail(
  this: Commands,
  ctx: Context,
  userID: string,
  email: string,
  returnCode: boolean = false,
  urlTemplate?: string
): Promise<{ details: ObjectDetails; plainCode?: string }> {
  if (!userID) {
    throwInvalidArgument('userID is required', 'EMAIL-000');
  }
  if (!email) {
    throwInvalidArgument('email is required', 'EMAIL-000');
  }

  // Validate email format
  if (!isValidEmail(email)) {
    throwInvalidArgument('invalid email format', 'EMAIL-001');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Load write model
  const wm = new HumanEmailWriteModel(userID, ctx.orgID);
  await wm.load(this.getEventstore(), userID, ctx.orgID);

  // Validate user state
  if (
    wm.userState === UserState.UNSPECIFIED ||
    wm.userState === UserState.DELETED
  ) {
    throwNotFound('user not found', 'EMAIL-002');
  }
  if (wm.userState === UserState.INITIAL) {
    throwPreconditionFailed('user not initialized', 'EMAIL-003');
  }

  // Check if email changed
  if (wm.email === normalizedEmail) {
    throwPreconditionFailed('email not changed', 'EMAIL-004');
  }

  // Check permissions
  await this.checkPermission(ctx, 'user.write', ctx.orgID, userID);

  // Generate code
  const codeResult = await generateVerificationCode(
    DEFAULT_CODE_CONFIGS.emailVerification
  );

  // Create events
  const events: Command[] = [];

  // 1. Email changed
  events.push({
    eventType: 'user.v2.email.changed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      email: normalizedEmail,
    },
  });

  // 2. Code added
  events.push({
    eventType: 'user.v2.email.code.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      code: codeResult.encrypted,
      expiry: codeResult.expiry,
      urlTemplate,
      codeReturned: returnCode,
    },
  });

  // Push events
  const pushedEvents = await this.getEventstore().pushMany(events);
  appendAndReduce(wm, ...pushedEvents);

  // Send email notification
  if (!returnCode) {
    getEmailService()
      .sendVerificationCode(normalizedEmail, codeResult.plain, urlTemplate)
      .catch((err) => console.error('Failed to send email:', err));
  }

  return {
    details: writeModelToObjectDetails(wm),
    plainCode: returnCode ? codeResult.plain : undefined,
  };
}

/**
 * Resend email verification code
 * Based on Go: ResendUserEmailCode (user_v2_email.go:40-42)
 */
export async function resendUserEmailCode(
  this: Commands,
  ctx: Context,
  userID: string,
  returnCode: boolean = false,
  urlTemplate?: string
): Promise<{ details: ObjectDetails; plainCode?: string }> {
  if (!userID) {
    throwInvalidArgument('userID is required', 'EMAIL-000');
  }

  // Load write model
  const wm = new HumanEmailWriteModel(userID, ctx.orgID);
  await wm.load(this.getEventstore(), userID, ctx.orgID);

  // Validate state
  if (
    wm.userState === UserState.UNSPECIFIED ||
    wm.userState === UserState.DELETED
  ) {
    throwNotFound('user not found', 'EMAIL-010');
  }

  // Check if there's a pending verification
  if (!wm.code) {
    throwPreconditionFailed('no pending verification code', 'EMAIL-011');
  }

  if (!wm.email) {
    throwPreconditionFailed('no email address set', 'EMAIL-012');
  }

  // Check permissions
  await this.checkPermission(ctx, 'user.write', ctx.orgID, userID);

  // Generate new code
  const codeResult = await generateVerificationCode(
    DEFAULT_CODE_CONFIGS.emailVerification
  );

  // Create code added event
  const command: Command = {
    eventType: 'user.v2.email.code.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      code: codeResult.encrypted,
      expiry: codeResult.expiry,
      urlTemplate,
      codeReturned: returnCode,
    },
  };

  // Push event
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  // Send email
  if (!returnCode) {
    getEmailService()
      .sendVerificationCode(wm.email, codeResult.plain, urlTemplate)
      .catch((err) => console.error('Failed to send email:', err));
  }

  return {
    details: writeModelToObjectDetails(wm),
    plainCode: returnCode ? codeResult.plain : undefined,
  };
}

/**
 * Verify email with code
 * Based on Go: VerifyUserEmail (user_v2_email.go:190-197)
 */
export async function verifyUserEmail(
  this: Commands,
  ctx: Context,
  userID: string,
  code: string
): Promise<ObjectDetails> {
  if (!userID) {
    throwInvalidArgument('userID is required', 'EMAIL-000');
  }
  if (!code) {
    throwInvalidArgument('code is required', 'EMAIL-000');
  }

  // Load write model
  const wm = new HumanEmailWriteModel(userID, ctx.orgID);
  await wm.load(this.getEventstore(), userID, ctx.orgID);

  // Validate state
  if (
    wm.userState === UserState.UNSPECIFIED ||
    wm.userState === UserState.DELETED
  ) {
    throwNotFound('user not found', 'EMAIL-020');
  }

  // Verify code
  const isValid = await verifyCode(
    wm.code,
    code,
    wm.codeCreationDate,
    wm.codeExpiry
  );

  if (!isValid) {
    // Push failure event
    await this.getEventstore().push({
      eventType: 'user.human.email.verification.failed',
      aggregateType: 'user',
      aggregateID: userID,
      owner: ctx.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {},
    });
    throwInvalidArgument('invalid verification code', 'EMAIL-021');
  }

  // Push verified event
  const command: Command = {
    eventType: 'user.v2.email.verified',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Helper: Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
