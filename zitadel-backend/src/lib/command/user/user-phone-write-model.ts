/**
 * Human Phone Write Model
 * Based on Zitadel Go: internal/command/user_human_phone_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { UserState } from '../../domain/user';
import { CryptoValue } from '../../crypto/verification-codes';

export enum PhoneState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

export class HumanPhoneWriteModel extends WriteModel {
  phone?: string;
  isPhoneVerified: boolean = false;

  // Verification code tracking
  code?: CryptoValue;
  codeCreationDate?: Date;
  codeExpiry?: number; // Duration in seconds
  generatorID?: string; // External provider ID (e.g., Twilio)
  verificationID?: string; // External verification ID

  state: PhoneState = PhoneState.UNSPECIFIED;
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
        if (event.payload?.phone) {
          this.phone = event.payload.phone;
          this.state = PhoneState.ACTIVE;
        }
        this.userState = UserState.ACTIVE;
        break;

      case 'user.human.initial.code.added':
        this.userState = UserState.INITIAL;
        break;

      case 'user.human.initial.check.succeeded':
        this.userState = UserState.ACTIVE;
        break;

      case 'user.human.phone.changed':
      case 'user.v2.phone.changed':
        this.phone = event.payload?.phone;
        this.isPhoneVerified = false;
        this.state = PhoneState.ACTIVE;
        this.code = undefined;
        this.codeCreationDate = undefined;
        this.codeExpiry = undefined;
        break;

      case 'user.human.phone.verified':
      case 'user.v2.phone.verified':
        this.isPhoneVerified = true;
        this.code = undefined;
        this.codeCreationDate = undefined;
        this.codeExpiry = undefined;
        break;

      case 'user.human.phone.code.added':
      case 'user.v2.phone.code.added':
        // Reconstruct Buffer from serialized data
        if (event.payload?.code) {
          const codeData = event.payload.code;
          this.code = {
            algorithm: codeData.algorithm,
            keyID: codeData.keyID,
            crypted: Buffer.from(codeData.crypted?.data || codeData.crypted || []),
          };
        }
        this.codeCreationDate = event.createdAt;
        this.codeExpiry = event.payload?.expiry;
        this.generatorID = event.payload?.generatorID;
        break;

      case 'user.human.phone.code.sent':
        this.generatorID = event.payload?.generatorID;
        this.verificationID = event.payload?.verificationID;
        break;

      case 'user.human.phone.verification.failed':
        // Code remains valid for retry
        break;

      case 'user.human.phone.removed':
      case 'user.v2.phone.removed':
        this.state = PhoneState.REMOVED;
        this.isPhoneVerified = false;
        this.phone = undefined;
        this.code = undefined;
        break;

      case 'user.removed':
      case 'user.deleted':
        this.userState = UserState.DELETED;
        this.isPhoneVerified = false;
        this.phone = undefined;
        break;
    }
  }
}
