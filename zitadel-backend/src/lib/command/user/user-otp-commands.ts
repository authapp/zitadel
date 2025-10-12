/**
 * User OTP Commands
 * 
 * TOTP (Time-based OTP), SMS OTP, and Email OTP management
 * Based on Go: internal/command/user_human_otp.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { appendAndReduce, ObjectDetails, writeModelToObjectDetails } from '../write-model';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwPreconditionFailed, throwAlreadyExists } from '@/zerrors/errors';
import { Command } from '../../eventstore/types';
import {
  HumanTOTPWriteModel,
  HumanOTPSMSWriteModel,
  HumanOTPEmailWriteModel,
  HumanOTPSMSCodeWriteModel,
  HumanOTPEmailCodeWriteModel,
} from './user-otp-write-model';
import { MFAState, TOTP } from '../../domain/mfa';
import { generateTOTPKey, validateTOTP } from '../../crypto/totp';

// ============================================================================
// TOTP Commands (4 commands)
// ============================================================================

/**
 * Import existing TOTP secret
 * Based on Go: ImportHumanTOTP (user_human_otp.go:21-47)
 */
export async function importHumanTOTP(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  secret: string,
  userAgentID?: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(secret, 'secret');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load TOTP write model
  const wm = new HumanTOTPWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state === MFAState.READY) {
    throwAlreadyExists('TOTP already configured', 'OTP-imp01');
  }

  // Create events (add + verify in one go for import)
  const commands: Command[] = [
    {
      eventType: 'user.human.otp.added',
      aggregateType: 'user',
      aggregateID: userID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        secret,  // Should be encrypted in production
      },
    },
    {
      eventType: 'user.human.otp.verified',
      aggregateType: 'user',
      aggregateID: userID,
      owner: orgID,
      instanceID: ctx.instanceID,
      creator: ctx.userID || 'system',
      payload: {
        userAgentID: userAgentID || 'unknown',
      },
    },
  ];

  const events = await this.getEventstore().pushMany(commands);
  for (const event of events) {
    appendAndReduce(wm, event);
  }

  return writeModelToObjectDetails(wm);
}

/**
 * Add TOTP authenticator (generates new secret)
 * Based on Go: AddHumanTOTP (user_human_otp.go:49-66)
 */
export async function addHumanTOTP(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  issuer?: string
): Promise<TOTP & { details: ObjectDetails }> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load TOTP write model
  const wm = new HumanTOTPWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state === MFAState.READY) {
    throwAlreadyExists('TOTP already configured', 'OTP-add01');
  }

  // Generate TOTP key
  const accountName = userID; // In production, use username or email
  const totpIssuer = issuer || 'Zitadel';
  const key = generateTOTPKey(totpIssuer, accountName);

  // Create event
  const command: Command = {
    eventType: 'user.human.otp.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      secret: key.secret,  // Should be encrypted in production
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    secret: key.secret,
    uri: key.uri,
    details: writeModelToObjectDetails(wm),
  };
}

/**
 * Verify TOTP setup (check code and mark as ready)
 * Based on Go: HumanCheckMFATOTPSetup (user_human_otp.go:130-162)
 */
export async function humanCheckMFATOTPSetup(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  code: string,
  userAgentID?: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(code, 'code');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load TOTP write model
  const wm = new HumanTOTPWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state === MFAState.UNSPECIFIED || wm.state === MFAState.REMOVED) {
    throwNotFound('TOTP not configured', 'OTP-setup01');
  }

  if (wm.state === MFAState.READY) {
    throwPreconditionFailed('TOTP already verified', 'OTP-setup02');
  }

  // Verify the code
  if (!wm.secret) {
    throwPreconditionFailed('TOTP secret not found', 'OTP-setup03');
  }

  validateTOTP(code, wm.secret);

  // Create event
  const command: Command = {
    eventType: 'user.human.otp.verified',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      userAgentID: userAgentID || 'unknown',
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return writeModelToObjectDetails(wm);
}

/**
 * Remove TOTP authenticator
 * Based on Go: HumanRemoveTOTP (user_human_otp.go:228-253)
 */
export async function humanRemoveTOTP(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'delete', orgID);

  // Load TOTP write model
  const wm = new HumanTOTPWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.state === MFAState.UNSPECIFIED || wm.state === MFAState.REMOVED) {
    throwNotFound('TOTP not configured', 'OTP-remove01');
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.otp.removed',
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

// ============================================================================
// OTP SMS Commands (4 commands)
// ============================================================================

/**
 * Add SMS OTP (enable SMS 2FA)
 * Based on Go: AddHumanOTPSMS (user_human_otp.go:257-259) and addHumanOTPSMS (274-301)
 */
export async function addHumanOTPSMS(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load OTP SMS write model
  const wm = new HumanOTPSMSWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.otpAdded) {
    throwAlreadyExists('SMS OTP already configured', 'OTP-sms01');
  }

  if (!wm.phoneVerified) {
    throwPreconditionFailed('Phone number must be verified first', 'OTP-sms02');
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.otp.sms.added',
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

/**
 * Remove SMS OTP (disable SMS 2FA)
 * Based on Go: RemoveHumanOTPSMS (user_human_otp.go:303-323)
 */
export async function removeHumanOTPSMS(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'delete', orgID);

  // Load OTP SMS write model
  const wm = new HumanOTPSMSWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (!wm.otpAdded) {
    throwNotFound('SMS OTP not configured', 'OTP-sms03');
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.otp.sms.removed',
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

/**
 * Send SMS OTP code
 * Based on Go: HumanSendOTPSMS (user_human_otp.go:325-343)
 */
export async function humanSendOTPSMS(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  phoneNumber?: string
): Promise<{ code?: string; details: ObjectDetails }> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load OTP SMS code write model
  const wm = new HumanOTPSMSCodeWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (!wm.otpAdded) {
    throwPreconditionFailed('SMS OTP not configured', 'OTP-sms04');
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = 5 * 60 * 1000; // 5 minutes

  // Create event
  const command: Command = {
    eventType: 'user.human.otp.sms.code.added',
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {
      code,  // Should be encrypted in production
      expiry,
      phoneNumber,
    },
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  return {
    code, // In production, don't return - send via SMS provider
    details: writeModelToObjectDetails(wm),
  };
}

/**
 * Check/verify SMS OTP code
 * Based on Go: HumanCheckOTPSMS (user_human_otp.go:355-383)
 */
export async function humanCheckOTPSMS(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  code: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(code, 'code');

  // Load OTP SMS code write model
  const wm = new HumanOTPSMSCodeWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (!wm.otpAdded) {
    throwPreconditionFailed('SMS OTP not configured', 'OTP-sms05');
  }

  if (wm.userLocked) {
    throwPreconditionFailed('User is locked', 'OTP-sms06');
  }

  if (!wm.otpCode) {
    throwPreconditionFailed('No SMS code generated', 'OTP-sms07');
  }

  // Check expiry
  const now = new Date();
  const expiryTime = new Date(wm.otpCode.creationDate.getTime() + wm.otpCode.expiry);
  if (now > expiryTime) {
    throwPreconditionFailed('SMS code expired', 'OTP-sms08');
  }

  // Verify code
  const isValid = wm.otpCode.code === code;

  const eventType = isValid
    ? 'user.human.otp.sms.check.succeeded'
    : 'user.human.otp.sms.check.failed';

  // Create event
  const command: Command = {
    eventType,
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  if (!isValid) {
    throwInvalidArgument('Invalid SMS code', 'OTP-sms09');
  }

  return writeModelToObjectDetails(wm);
}

// ============================================================================
// OTP Email Commands (3 commands)
// ============================================================================

/**
 * Add Email OTP (enable Email 2FA)
 * Based on Go: AddHumanOTPEmail (user_human_otp.go:387-389) and addHumanOTPEmail (404-431)
 */
export async function addHumanOTPEmail(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'write', orgID);

  // Load OTP Email write model
  const wm = new HumanOTPEmailWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (wm.otpAdded) {
    throwAlreadyExists('Email OTP already configured', 'OTP-email01');
  }

  if (!wm.emailVerified) {
    throwPreconditionFailed('Email must be verified first', 'OTP-email02');
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.otp.email.added',
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

/**
 * Remove Email OTP (disable Email 2FA)
 * Based on Go: RemoveHumanOTPEmail (user_human_otp.go:433-453)
 */
export async function removeHumanOTPEmail(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');

  // Check permissions
  await this.checkPermission(ctx, 'user.credential', 'delete', orgID);

  // Load OTP Email write model
  const wm = new HumanOTPEmailWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (!wm.otpAdded) {
    throwNotFound('Email OTP not configured', 'OTP-email03');
  }

  // Create event
  const command: Command = {
    eventType: 'user.human.otp.email.removed',
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

/**
 * Check/verify Email OTP code
 * Based on Go: HumanCheckOTPEmail (user_human_otp.go:489-517)
 */
export async function humanCheckOTPEmail(
  this: Commands,
  ctx: Context,
  userID: string,
  orgID: string,
  code: string
): Promise<ObjectDetails> {
  validateRequired(userID, 'userID');
  validateRequired(orgID, 'orgID');
  validateRequired(code, 'code');

  // Load OTP Email code write model
  const wm = new HumanOTPEmailCodeWriteModel(userID, orgID);
  await wm.load(this.getEventstore(), userID, orgID);

  if (!wm.otpAdded) {
    throwPreconditionFailed('Email OTP not configured', 'OTP-email04');
  }

  if (wm.userLocked) {
    throwPreconditionFailed('User is locked', 'OTP-email05');
  }

  if (!wm.otpCode) {
    throwPreconditionFailed('No Email code generated', 'OTP-email06');
  }

  // Check expiry
  const now = new Date();
  const expiryTime = new Date(wm.otpCode.creationDate.getTime() + wm.otpCode.expiry);
  if (now > expiryTime) {
    throwPreconditionFailed('Email code expired', 'OTP-email07');
  }

  // Verify code
  const isValid = wm.otpCode.code === code;

  const eventType = isValid
    ? 'user.human.otp.email.check.succeeded'
    : 'user.human.otp.email.check.failed';

  // Create event
  const command: Command = {
    eventType,
    aggregateType: 'user',
    aggregateID: userID,
    owner: orgID,
    instanceID: ctx.instanceID,
    creator: ctx.userID || 'system',
    payload: {},
  };

  const event = await this.getEventstore().push(command);
  appendAndReduce(wm, event);

  if (!isValid) {
    throwInvalidArgument('Invalid Email code', 'OTP-email08');
  }

  return writeModelToObjectDetails(wm);
}
