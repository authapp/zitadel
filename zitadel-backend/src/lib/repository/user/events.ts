/**
 * User Event Definitions
 * 
 * Matches Go's internal/repository/user/
 * Provides type-safe event creation and constants
 */

import { Command } from '../../eventstore/types';

/**
 * Aggregate type constant
 */
export const USER_AGGREGATE_TYPE = 'user';

/**
 * Event type constants (matches Go)
 */
export const UserEventTypes = {
  // Human user events
  HUMAN_ADDED: 'user.human.added',
  HUMAN_REGISTERED: 'user.human.selfregistered',
  
  // Machine user events
  MACHINE_ADDED: 'user.machine.added',
  MACHINE_CHANGED: 'user.machine.changed',
  
  // V2 events
  V2_ADDED: 'user.v2.added',
  V2_UPDATED: 'user.v2.updated',
  
  // Username
  USERNAME_CHANGED: 'user.username.changed',
  
  // Profile
  PROFILE_CHANGED: 'user.profile.changed',
  
  // Email
  EMAIL_CHANGED: 'user.email.changed',
  EMAIL_VERIFIED: 'user.email.verified',
  V2_EMAIL_CHANGED: 'user.v2.email.changed',
  V2_EMAIL_VERIFIED: 'user.v2.email.verified',
  
  // Phone
  PHONE_CHANGED: 'user.phone.changed',
  PHONE_VERIFIED: 'user.phone.verified',
  PHONE_REMOVED: 'user.phone.removed',
  V2_PHONE_CHANGED: 'user.v2.phone.changed',
  V2_PHONE_VERIFIED: 'user.v2.phone.verified',
  V2_PHONE_REMOVED: 'user.v2.phone.removed',
  
  // Password
  PASSWORD_CHANGED: 'user.password.changed',
  PASSWORD_CODE_ADDED: 'user.password.code.added',
  
  // State changes
  DEACTIVATED: 'user.deactivated',
  REACTIVATED: 'user.reactivated',
  LOCKED: 'user.locked',
  UNLOCKED: 'user.unlocked',
  REMOVED: 'user.removed',
  DELETED: 'user.deleted',
} as const;

export type UserEventType = typeof UserEventTypes[keyof typeof UserEventTypes];

/**
 * Event Payload Interfaces
 */

export interface HumanAddedPayload {
  username: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  email: string;
  emailVerified?: boolean;
  phone?: string;
  phoneVerified?: boolean;
  preferredLanguage?: string;
  gender?: number;
  password?: string;
  passwordChangeRequired?: boolean;
}

export interface MachineAddedPayload {
  username: string;
  name: string;
  description?: string;
  accessTokenType?: number;
}

export interface UsernameChangedPayload {
  username: string;
  oldUsername?: string;
}

export interface ProfileChangedPayload {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  preferredLanguage?: string;
  gender?: number;
}

export interface EmailChangedPayload {
  email: string;
}

export interface PhoneChangedPayload {
  phone: string;
}

export interface PasswordChangedPayload {
  encodedHash?: string;
  changeRequired?: boolean;
}

/**
 * Event Factory Functions
 * Match Go's New*Event() functions
 */

export function newHumanAddedEvent(
  aggregateID: string,
  owner: string,
  payload: HumanAddedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.HUMAN_ADDED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newMachineAddedEvent(
  aggregateID: string,
  owner: string,
  payload: MachineAddedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.MACHINE_ADDED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newUsernameChangedEvent(
  aggregateID: string,
  owner: string,
  payload: UsernameChangedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.USERNAME_CHANGED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newProfileChangedEvent(
  aggregateID: string,
  owner: string,
  payload: ProfileChangedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.PROFILE_CHANGED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newEmailChangedEvent(
  aggregateID: string,
  owner: string,
  payload: EmailChangedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.EMAIL_CHANGED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newEmailVerifiedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.EMAIL_VERIFIED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newPhoneChangedEvent(
  aggregateID: string,
  owner: string,
  payload: PhoneChangedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.PHONE_CHANGED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newPhoneVerifiedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.PHONE_VERIFIED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newPhoneRemovedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.PHONE_REMOVED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newPasswordChangedEvent(
  aggregateID: string,
  owner: string,
  payload: PasswordChangedPayload,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.PASSWORD_CHANGED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload,
  };
}

export function newUserDeactivatedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.DEACTIVATED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newUserReactivatedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.REACTIVATED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newUserLockedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.LOCKED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newUserUnlockedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.UNLOCKED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}

export function newUserRemovedEvent(
  aggregateID: string,
  owner: string,
  instanceID: string = 'default',
  creator: string = 'system'
): Command {
  return {
    eventType: UserEventTypes.REMOVED,
    aggregateType: USER_AGGREGATE_TYPE,
    aggregateID,
    owner,
    instanceID,
    creator,
    payload: {},
  };
}
