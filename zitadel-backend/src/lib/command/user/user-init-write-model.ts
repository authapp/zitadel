/**
 * User Initialization Write Model
 * 
 * Tracks user registration/initialization state and email verification codes
 * Based on Go: internal/command/user_human_init_model.go
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * User State enumeration
 */
export enum UserState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  DELETED = 3,
  INITIAL = 4,     // User created but not yet initialized (email not verified)
  LOCKED = 5,
  SUSPENDED = 6,
}

/**
 * Human Init Code Write Model
 * Tracks initialization code state for user registration
 */
export class HumanInitCodeWriteModel extends WriteModel {
  email: string = '';
  isEmailVerified: boolean = false;
  code?: string;                    // Encrypted verification code
  codeCreationDate?: Date;
  codeExpiry: number = 0;          // Duration in milliseconds
  authRequestID: string = '';
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
        this.email = event.payload?.email || event.payload?.emailAddress || '';
        this.userState = UserState.ACTIVE;
        break;

      case 'user.human.email.changed':
        this.email = event.payload?.email || event.payload?.emailAddress || '';
        this.isEmailVerified = false;
        break;

      case 'user.human.email.verified':
        this.isEmailVerified = true;
        break;

      case 'user.human.init.code.added':
        this.code = event.payload?.code;
        this.codeCreationDate = event.createdAt ? new Date(event.createdAt) : new Date();
        this.codeExpiry = event.payload?.expiry || 0;
        this.authRequestID = event.payload?.authRequestID || '';
        this.userState = UserState.INITIAL;
        break;

      case 'user.human.init.code.sent':
        // Just marks code as sent, no state change
        break;

      case 'user.human.init.check.succeeded':
        this.code = undefined;
        this.userState = UserState.ACTIVE;
        break;

      case 'user.human.init.check.failed':
        // Failed verification attempt, code remains
        break;

      case 'user.removed':
      case 'user.deleted':
        this.userState = UserState.DELETED;
        break;
    }
  }

  /**
   * Check if email has changed
   */
  hasEmailChanged(newEmail: string): boolean {
    return this.email !== newEmail;
  }
}
