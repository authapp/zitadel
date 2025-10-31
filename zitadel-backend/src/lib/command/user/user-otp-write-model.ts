/**
 * User OTP Write Models
 * 
 * State tracking for TOTP, SMS OTP, and Email OTP
 * Based on Go: internal/command/user_human_otp_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { MFAState } from '../../domain/mfa';
import { UserState } from '../../domain/user';

/**
 * TOTP Write Model
 * Tracks TOTP authenticator state for a user
 */
export class HumanTOTPWriteModel extends WriteModel {
  state: MFAState = MFAState.UNSPECIFIED;
  secret?: string;  // Encrypted secret
  checkFailedCount: number = 0;
  userLocked: boolean = false;

  constructor(userID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.human.otp.added':
        this.secret = event.payload?.secret;
        this.state = MFAState.NOT_READY;
        break;

      case 'user.human.otp.verified':
        this.state = MFAState.READY;
        this.checkFailedCount = 0;
        break;

      case 'user.human.otp.check.succeeded':
        this.checkFailedCount = 0;
        break;

      case 'user.human.otp.check.failed':
        this.checkFailedCount++;
        break;

      case 'user.locked':
        this.userLocked = true;
        break;

      case 'user.unlocked':
        this.checkFailedCount = 0;
        this.userLocked = false;
        break;

      case 'user.human.otp.removed':
        this.state = MFAState.REMOVED;
        break;

      case 'user.removed':
      case 'user.deleted':
        this.state = MFAState.REMOVED;
        break;
    }
  }
}

/**
 * OTP SMS Write Model
 * Tracks SMS OTP state for a user
 */
export class HumanOTPSMSWriteModel extends WriteModel {
  phoneVerified: boolean = false;
  otpAdded: boolean = false;
  userState: UserState = UserState.UNSPECIFIED;

  constructor(userID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.human.added':
      case 'user.human.registered':
        this.userState = UserState.ACTIVE;
        // Extract phoneVerified from user creation event (for testing stubs)
        if (event.payload?.phoneVerified) {
          this.phoneVerified = true;
        }
        break;

      case 'user.human.phone.verified':
      case 'user.v2.phone.verified':
        this.phoneVerified = true;
        break;

      case 'user.human.otp.sms.added':
        this.otpAdded = true;
        break;

      case 'user.human.otp.sms.removed':
        this.otpAdded = false;
        break;

      case 'user.human.phone.removed':
      case 'user.v2.phone.removed':
        this.phoneVerified = false;
        break;

      case 'user.removed':
      case 'user.deleted':
        this.userState = UserState.DELETED;
        this.phoneVerified = false;
        this.otpAdded = false;
        break;
    }
  }
}

/**
 * OTP Code information
 */
interface OTPCode {
  code: string;          // Encrypted code
  creationDate: Date;
  expiry: number;        // Duration in milliseconds
  generatorID?: string;
  verificationID?: string;
}

/**
 * OTP SMS Code Write Model (for verification)
 */
export class HumanOTPSMSCodeWriteModel extends HumanOTPSMSWriteModel {
  otpCode?: OTPCode;
  checkFailedCount: number = 0;
  userLocked: boolean = false;

  reduce(event: Event): void {
    // First reduce SMS write model events
    super.reduce(event);

    // Then handle code-specific events
    switch (event.eventType) {
      case 'user.human.otp.sms.code.added':
        this.otpCode = {
          code: event.payload?.code,
          creationDate: event.createdAt ? new Date(event.createdAt) : new Date(),
          expiry: event.payload?.expiry || 0,
          generatorID: event.payload?.generatorID,
        };
        break;

      case 'user.human.otp.sms.code.sent':
        if (this.otpCode && event.payload?.generatorInfo) {
          this.otpCode.generatorID = event.payload.generatorInfo.id;
          this.otpCode.verificationID = event.payload.generatorInfo.verificationID;
        }
        break;

      case 'user.human.otp.sms.check.succeeded':
        this.checkFailedCount = 0;
        break;

      case 'user.human.otp.sms.check.failed':
        this.checkFailedCount++;
        break;

      case 'user.locked':
        this.userLocked = true;
        break;

      case 'user.unlocked':
        this.checkFailedCount = 0;
        this.userLocked = false;
        break;
    }
  }
}

/**
 * OTP Email Write Model
 * Tracks Email OTP state for a user
 */
export class HumanOTPEmailWriteModel extends WriteModel {
  emailVerified: boolean = false;
  otpAdded: boolean = false;

  constructor(userID: string, orgID: string) {
    super('user');
    this.aggregateID = userID;
    this.resourceOwner = orgID;
  }

  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.human.added':
      case 'user.human.registered':
        // Extract emailVerified from user creation event (for testing stubs)
        if (event.payload?.emailVerified) {
          this.emailVerified = true;
        }
        break;

      case 'user.human.email.verified':
      case 'user.v2.email.verified':
        this.emailVerified = true;
        break;

      case 'user.human.otp.email.added':
        this.otpAdded = true;
        break;

      case 'user.human.otp.email.removed':
        this.otpAdded = false;
        break;

      case 'user.human.email.changed':
      case 'user.v2.email.changed':
      case 'user.removed':
      case 'user.deleted':
        this.emailVerified = false;
        this.otpAdded = false;
        break;
    }
  }
}

/**
 * OTP Email Code Write Model (for verification)
 */
export class HumanOTPEmailCodeWriteModel extends HumanOTPEmailWriteModel {
  otpCode?: OTPCode;
  checkFailedCount: number = 0;
  userLocked: boolean = false;

  reduce(event: Event): void {
    // First reduce Email write model events
    super.reduce(event);

    // Then handle code-specific events
    switch (event.eventType) {
      case 'user.human.otp.email.code.added':
        this.otpCode = {
          code: event.payload?.code,
          creationDate: event.createdAt ? new Date(event.createdAt) : new Date(),
          expiry: event.payload?.expiry || 0,
        };
        break;

      case 'user.human.otp.email.check.succeeded':
        this.checkFailedCount = 0;
        break;

      case 'user.human.otp.email.check.failed':
        this.checkFailedCount++;
        break;

      case 'user.locked':
        this.userLocked = true;
        break;

      case 'user.unlocked':
        this.checkFailedCount = 0;
        this.userLocked = false;
        break;
    }
  }
}
