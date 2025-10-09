/**
 * User Write Model
 * 
 * Tracks user aggregate state for command execution
 */

import { Event } from '../../eventstore/types';
import { WriteModel } from '../write-model';

/**
 * User state enum
 */
export enum UserState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  DELETED = 3,
  LOCKED = 4,
  INITIAL = 5,
}

/**
 * User type enum
 */
export enum UserType {
  UNSPECIFIED = 0,
  HUMAN = 1,
  MACHINE = 2,
}

/**
 * User write model
 */
export class UserWriteModel extends WriteModel {
  userType: UserType = UserType.UNSPECIFIED;
  state: UserState = UserState.UNSPECIFIED;
  username?: string;
  email?: string;
  emailVerified: boolean = false;
  phone?: string;
  phoneVerified: boolean = false;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  preferredLanguage?: string;
  
  constructor() {
    super('user');
  }
  
  reduce(event: Event): void {
    switch (event.eventType) {
      // Human user events
      case 'user.human.added':
      case 'user.v2.added':
        this.userType = UserType.HUMAN;
        this.state = UserState.ACTIVE;
        this.username = event.payload?.username;
        this.email = event.payload?.email;
        this.firstName = event.payload?.firstName;
        this.lastName = event.payload?.lastName;
        this.displayName = event.payload?.displayName;
        this.preferredLanguage = event.payload?.preferredLanguage;
        break;
        
      // Machine user events
      case 'user.machine.added':
        this.userType = UserType.MACHINE;
        this.state = UserState.ACTIVE;
        this.username = event.payload?.username;
        this.displayName = event.payload?.name;
        break;
        
      // Username changes
      case 'user.username.changed':
        this.username = event.payload?.username;
        break;
        
      // Profile changes
      case 'user.profile.changed':
      case 'user.v2.updated':
        if (event.payload?.firstName !== undefined) {
          this.firstName = event.payload.firstName;
        }
        if (event.payload?.lastName !== undefined) {
          this.lastName = event.payload.lastName;
        }
        if (event.payload?.displayName !== undefined) {
          this.displayName = event.payload.displayName;
        }
        if (event.payload?.preferredLanguage !== undefined) {
          this.preferredLanguage = event.payload.preferredLanguage;
        }
        break;
        
      // Email changes
      case 'user.email.changed':
      case 'user.v2.email.changed':
        this.email = event.payload?.email;
        this.emailVerified = false;
        break;
        
      case 'user.email.verified':
      case 'user.v2.email.verified':
        this.emailVerified = true;
        break;
        
      // Phone changes
      case 'user.phone.changed':
      case 'user.v2.phone.changed':
        this.phone = event.payload?.phone;
        this.phoneVerified = false;
        break;
        
      case 'user.phone.verified':
      case 'user.v2.phone.verified':
        this.phoneVerified = true;
        break;
        
      case 'user.phone.removed':
      case 'user.v2.phone.removed':
        this.phone = undefined;
        this.phoneVerified = false;
        break;
        
      // State changes
      case 'user.deactivated':
        this.state = UserState.INACTIVE;
        break;
        
      case 'user.reactivated':
        this.state = UserState.ACTIVE;
        break;
        
      case 'user.locked':
        this.state = UserState.LOCKED;
        break;
        
      case 'user.unlocked':
        this.state = UserState.ACTIVE;
        break;
        
      case 'user.removed':
      case 'user.deleted':
        this.state = UserState.DELETED;
        break;
    }
  }
}

/**
 * Helper functions for user state
 */

export function isUserStateExists(state: UserState): boolean {
  return state !== UserState.UNSPECIFIED && state !== UserState.DELETED;
}

export function isUserStateActive(state: UserState): boolean {
  return state === UserState.ACTIVE;
}

export function isUserStateInactive(state: UserState): boolean {
  return state === UserState.INACTIVE;
}

export function isUserStateInitial(state: UserState): boolean {
  return state === UserState.INITIAL;
}

export function isUserStateLocked(state: UserState): boolean {
  return state === UserState.LOCKED;
}

export function isUserStateDeleted(state: UserState): boolean {
  return state === UserState.DELETED;
}
