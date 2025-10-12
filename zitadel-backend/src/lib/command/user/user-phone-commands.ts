/**
 * User Phone Verification Commands
 * Based on Zitadel Go: internal/command/user_v2_phone.go
 */

import { Context } from '../context';
import { Commands } from '../commands';
import {
  throwNotFound,
  throwPreconditionFailed,
  throwInvalidArgument,
} from '@/zerrors/errors';
import { HumanPhoneWriteModel, PhoneState } from './user-phone-write-model';
import { UserState } from '../../domain/user';
import { Command } from '../../eventstore/types';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import {
  generateVerificationCode,
  verifyCode,
  DEFAULT_CODE_CONFIGS,
} from '../../crypto/verification-codes';
import { getSMSService } from '../../notification/sms-service';

/**
 * Change user phone and send verification code
 * Based on Go: ChangeUserPhone (user_v2_phone.go:20-22)
 */
export async function changeUserPhone(
  this: Commands,
  ctx: Context,
  userID: string,
  phone: string,
  returnCode: boolean = false
): Promise<{ details: ObjectDetails; plainCode?: string }> {
  if (!userID) {
    throwInvalidArgument('userID is required', 'PHONE-000');
  }
  if (!phone) {
    throwInvalidArgument('phone is required', 'PHONE-000');
  }

  // Normalize phone number (E.164 format)
  const normalizedPhone = normalizePhoneNumber(phone);

  // Load write model
  const wm = new HumanPhoneWriteModel(userID, ctx.orgID);
  await wm.load(this.getEventstore(), userID, ctx.orgID);

  // Validate user state
  if (
    wm.userState === UserState.UNSPECIFIED ||
    wm.userState === UserState.DELETED
  ) {
    throwNotFound('user not found', 'PHONE-001');
  }
  if (wm.userState === UserState.INITIAL) {
    throwPreconditionFailed('user not initialized', 'PHONE-002');
  }

  // Check if phone actually changed
  if (wm.phone === normalizedPhone) {
    throwPreconditionFailed('phone not changed', 'PHONE-003');
  }

  // Check permissions
  await this.checkPermission(ctx, 'user.write', ctx.orgID, userID);

  // Generate verification code
  const codeResult = await generateVerificationCode(
    DEFAULT_CODE_CONFIGS.phoneVerification
  );

  // Create events
  const events: Command[] = [];

  // 1. Phone changed event
  events.push({
    eventType: 'user.v2.phone.changed',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      phone: normalizedPhone,
    },
  });

  // 2. Code added event
  events.push({
    eventType: 'user.v2.phone.code.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      code: codeResult.encrypted,
      expiry: codeResult.expiry,
      codeReturned: returnCode,
    },
  });

  // Push events
  const pushedEvents = await this.getEventstore().pushMany(events);
  appendAndReduce(wm, ...pushedEvents);

  // Send SMS notification (async, don't wait)
  if (!returnCode) {
    getSMSService()
      .sendVerificationCode(normalizedPhone, codeResult.plain)
      .catch((err) => console.error('Failed to send SMS:', err));
  }

  return {
    details: writeModelToObjectDetails(wm),
    plainCode: returnCode ? codeResult.plain : undefined,
  };
}

/**
 * Resend phone verification code
 * Based on Go: ResendUserPhoneCode (user_v2_phone.go:49-51)
 */
export async function resendUserPhoneCode(
  this: Commands,
  ctx: Context,
  userID: string,
  returnCode: boolean = false
): Promise<{ details: ObjectDetails; plainCode?: string }> {
  if (!userID) {
    throwInvalidArgument('userID is required', 'PHONE-000');
  }

  // Load write model
  const wm = new HumanPhoneWriteModel(userID, ctx.orgID);
  await wm.load(this.getEventstore(), userID, ctx.orgID);

  // Validate state
  if (
    wm.userState === UserState.UNSPECIFIED ||
    wm.userState === UserState.DELETED
  ) {
    throwNotFound('user not found', 'PHONE-010');
  }

  // Check if there's a pending verification
  if (!wm.code && !wm.generatorID) {
    throwPreconditionFailed('no pending verification code', 'PHONE-011');
  }

  if (!wm.phone) {
    throwPreconditionFailed('no phone number set', 'PHONE-012');
  }

  // Check permissions
  await this.checkPermission(ctx, 'user.write', ctx.orgID, userID);

  // Generate new code
  const codeResult = await generateVerificationCode(
    DEFAULT_CODE_CONFIGS.phoneVerification
  );

  // Create code added event
  const command: Command = {
    eventType: 'user.v2.phone.code.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: ctx.orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      code: codeResult.encrypted,
      expiry: codeResult.expiry,
      codeReturned: returnCode,
    },
  };

  // Push event
  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  // Send SMS
  if (!returnCode) {
    getSMSService()
      .sendVerificationCode(wm.phone, codeResult.plain)
      .catch((err) => console.error('Failed to send SMS:', err));
  }

  return {
    details: writeModelToObjectDetails(wm),
    plainCode: returnCode ? codeResult.plain : undefined,
  };
}

/**
 * Verify phone with code
 * Based on Go: VerifyUserPhone (user_v2_phone.go:117-124)
 */
export async function verifyUserPhone(
  this: Commands,
  ctx: Context,
  userID: string,
  code: string
): Promise<ObjectDetails> {
  if (!userID) {
    throwInvalidArgument('userID is required', 'PHONE-000');
  }
  if (!code) {
    throwInvalidArgument('code is required', 'PHONE-000');
  }

  // Load write model
  const wm = new HumanPhoneWriteModel(userID, ctx.orgID);
  await wm.load(this.getEventstore(), userID, ctx.orgID);

  // Validate state
  if (
    wm.userState === UserState.UNSPECIFIED ||
    wm.userState === UserState.DELETED
  ) {
    throwNotFound('user not found', 'PHONE-020');
  }

  // Verify code
  const isValid = await verifyCode(
    wm.code,
    code,
    wm.codeCreationDate,
    wm.codeExpiry
  );

  if (!isValid) {
    // Push verification failed event
    await this.getEventstore().push({
      eventType: 'user.human.phone.verification.failed',
      aggregateType: 'user',
      aggregateID: userID,
      owner: ctx.orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {},
    });
    throwInvalidArgument('invalid verification code', 'PHONE-021');
  }

  // Push verified event
  const command: Command = {
    eventType: 'user.v2.phone.verified',
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
 * Remove user phone
 * Based on Go: RemoveUserPhone (user_v2_phone.go:141-162)
 */
export async function removeUserPhone(
  this: Commands,
  ctx: Context,
  userID: string
): Promise<ObjectDetails> {
  if (!userID) {
    throwInvalidArgument('userID is required', 'PHONE-000');
  }

  // Load write model
  const wm = new HumanPhoneWriteModel(userID, ctx.orgID);
  await wm.load(this.getEventstore(), userID, ctx.orgID);

  // Validate state
  if (wm.state === PhoneState.REMOVED || wm.state === PhoneState.UNSPECIFIED) {
    throwNotFound('phone not found', 'PHONE-030');
  }

  // Check permissions (allow self-service)
  if (ctx.userID !== userID) {
    await this.checkPermission(ctx, 'user.write', ctx.orgID, userID);
  }

  // Push removed event
  const command: Command = {
    eventType: 'user.v2.phone.removed',
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
 * Helper: Normalize phone to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Ensure starts with +
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }

  return normalized;
}
