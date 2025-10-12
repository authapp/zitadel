/**
 * Human Email Write Model
 * Based on Zitadel Go: internal/command/user_human_email_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';
import { UserState } from '../../domain/user';
import { CryptoValue } from '../../crypto/verification-codes';

export class HumanEmailWriteModel extends WriteModel {
  email?: string;
  isEmailVerified: boolean = false;

  // Verification code tracking
  code?: CryptoValue;
  codeCreationDate?: Date;
  codeExpiry?: number; // Duration in seconds
  authRequestID?: string; // For login flows

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
        this.email = event.payload?.email;
        this.userState = UserState.ACTIVE;
        break;

      case 'user.human.initial.code.added':
        this.userState = UserState.INITIAL;
        break;

      case 'user.human.initial.check.succeeded':
        this.userState = UserState.ACTIVE;
        break;

      case 'user.human.email.changed':
      case 'user.v2.email.changed':
        this.email = event.payload?.email;
        this.isEmailVerified = false;
        this.code = undefined;
        this.codeCreationDate = undefined;
        this.codeExpiry = undefined;
        break;

      case 'user.human.email.code.added':
      case 'user.v2.email.code.added':
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
        this.authRequestID = event.payload?.authRequestID;
        break;

      case 'user.human.email.verified':
      case 'user.v2.email.verified':
        this.isEmailVerified = true;
        this.code = undefined;
        this.codeCreationDate = undefined;
        this.codeExpiry = undefined;
        break;

      case 'user.human.email.verification.failed':
        // Code remains valid for retry
        break;

      case 'user.removed':
      case 'user.deleted':
        this.userState = UserState.DELETED;
        break;
    }
  }
}
