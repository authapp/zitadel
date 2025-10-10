/**
 * User Domain Entity
 * 
 * Complete user entity with Human and Machine types
 */

import { ObjectRoot, Stateful, AuthMethodType } from '../types';
import { Email, Phone, Address, Profile } from '../value-objects';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * User state
 */
export enum UserState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  DELETED = 3,
  LOCKED = 4,
  SUSPEND = 5,
  INITIAL = 6,
}

/**
 * User type
 */
export enum UserType {
  UNSPECIFIED = 0,
  HUMAN = 1,
  MACHINE = 2,
}

/**
 * Base user interface
 */
export interface User extends ObjectRoot, Stateful<UserState> {
  username: string;
  type: UserType;
  state: UserState;
  
  getUsername(): string;
  isEnabled(): boolean;
}

/**
 * Human user entity
 */
export class HumanUser implements User {
  public type = UserType.HUMAN;
  
  constructor(
    public aggregateID: string,
    public resourceOwner: string,
    public username: string,
    public state: UserState,
    public profile: Profile,
    public email: Email,
    public phone?: Phone,
    public address?: Address,
    public hashedPassword?: string,
    public passwordChangeRequired: boolean = false,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  /**
   * Validate human user
   */
  private validate(): void {
    if (!this.username || this.username.trim().length === 0) {
      throwInvalidArgument('Username is required', 'USER-HUMAN-001');
    }
    
    if (this.username.length > 200) {
      throwInvalidArgument('Username too long (max 200)', 'USER-HUMAN-002');
    }
    
    // Profile and email are required for human users
    if (!this.profile) {
      throwInvalidArgument('Profile is required for human users', 'USER-HUMAN-003');
    }
    
    if (!this.email) {
      throwInvalidArgument('Email is required for human users', 'USER-HUMAN-004');
    }
  }

  isValid(): boolean {
    return (
      !!this.username &&
      !!this.profile &&
      !!this.email &&
      this.username.trim().length > 0
    );
  }

  exists(): boolean {
    return this.state !== UserState.UNSPECIFIED && this.state !== UserState.DELETED;
  }

  isEnabled(): boolean {
    return this.state === UserState.ACTIVE || this.state === UserState.INITIAL;
  }

  getUsername(): string {
    return this.username;
  }

  /**
   * Get display name
   */
  getDisplayName(): string {
    return this.profile.getDisplayName();
  }

  /**
   * Get full name
   */
  getFullName(): string {
    return this.profile.getFullName();
  }

  /**
   * Check if email is verified
   */
  isEmailVerified(): boolean {
    return this.email.isVerified;
  }

  /**
   * Check if phone is verified
   */
  isPhoneVerified(): boolean {
    return this.phone?.isVerified ?? false;
  }

  /**
   * Check if user has password
   */
  hasPassword(): boolean {
    return !!this.hashedPassword;
  }

  /**
   * Check if password change is required
   */
  requiresPasswordChange(): boolean {
    return this.passwordChangeRequired;
  }
}

/**
 * Machine user entity (service account)
 */
export class MachineUser implements User {
  public type = UserType.MACHINE;
  
  constructor(
    public aggregateID: string,
    public resourceOwner: string,
    public username: string,
    public state: UserState,
    public name: string,
    public description?: string,
    public accessTokenType: AccessTokenType = AccessTokenType.JWT,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  /**
   * Validate machine user
   */
  private validate(): void {
    if (!this.username || this.username.trim().length === 0) {
      throwInvalidArgument('Username is required', 'USER-MACHINE-001');
    }
    
    if (!this.name || this.name.trim().length === 0) {
      throwInvalidArgument('Name is required', 'USER-MACHINE-002');
    }
    
    if (this.username.length > 200) {
      throwInvalidArgument('Username too long (max 200)', 'USER-MACHINE-003');
    }
  }

  isValid(): boolean {
    return !!this.username && !!this.name && this.username.trim().length > 0;
  }

  exists(): boolean {
    return this.state !== UserState.UNSPECIFIED && this.state !== UserState.DELETED;
  }

  isEnabled(): boolean {
    return this.state === UserState.ACTIVE;
  }

  getUsername(): string {
    return this.username;
  }
}

/**
 * Access token type for machine users
 */
export enum AccessTokenType {
  BEARER = 0,
  JWT = 1,
}

/**
 * Machine key (for machine authentication)
 */
export class MachineKey {
  constructor(
    public keyID: string,
    public userID: string,
    public type: MachineKeyType,
    public expirationDate?: Date,
    public publicKey?: string,
    public creationDate?: Date
  ) {}
}

/**
 * Machine key type
 */
export enum MachineKeyType {
  UNSPECIFIED = 0,
  JSON = 1,
}

/**
 * User authentication
 */
export class UserAuth {
  constructor(
    public userID: string,
    public authMethods: AuthMethodType[] = [],
    public lastAuthMethod?: AuthMethodType,
    public lastAuthTime?: Date
  ) {}

  /**
   * Check if user has MFA
   */
  hasMFA(): boolean {
    let factors = 0;
    
    for (const method of this.authMethods) {
      if (method === AuthMethodType.PASSWORDLESS) {
        return true;
      }
      if ([
        AuthMethodType.PASSWORD,
        AuthMethodType.TOTP,
        AuthMethodType.U2F,
        AuthMethodType.OTP_SMS,
        AuthMethodType.OTP_EMAIL,
        AuthMethodType.IDP,
        AuthMethodType.PRIVATE_KEY
      ].includes(method)) {
        factors++;
      }
    }
    
    return factors > 1;
  }

  /**
   * Check if user has 2FA
   */
  has2FA(): boolean {
    return this.authMethods.some(method =>
      [AuthMethodType.TOTP, AuthMethodType.U2F, AuthMethodType.OTP_SMS, AuthMethodType.OTP_EMAIL].includes(method)
    );
  }

  /**
   * Add auth method
   */
  addAuthMethod(method: AuthMethodType): void {
    if (!this.authMethods.includes(method)) {
      this.authMethods.push(method);
    }
    this.lastAuthMethod = method;
    this.lastAuthTime = new Date();
  }
}

/**
 * User grant (access to project)
 */
export class UserGrant {
  constructor(
    public grantID: string,
    public userID: string,
    public projectID: string,
    public projectGrantID: string | undefined,
    public roleKeys: string[],
    public state: UserGrantState = UserGrantState.ACTIVE,
    public creationDate?: Date,
    public changeDate?: Date
  ) {
    this.validate();
  }

  /**
   * Validate user grant
   */
  private validate(): void {
    if (!this.userID) {
      throwInvalidArgument('User ID is required', 'USER-GRANT-001');
    }
    if (!this.projectID) {
      throwInvalidArgument('Project ID is required', 'USER-GRANT-002');
    }
    if (!this.roleKeys || this.roleKeys.length === 0) {
      throwInvalidArgument('At least one role is required', 'USER-GRANT-003');
    }
  }

  /**
   * Check if grant has role
   */
  hasRole(roleKey: string): boolean {
    return this.roleKeys.includes(roleKey);
  }

  /**
   * Check if grant has invalid roles
   */
  hasInvalidRoles(validRoles: string[]): boolean {
    return this.roleKeys.some(role => !validRoles.includes(role));
  }
}

/**
 * User grant state
 */
export enum UserGrantState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  REMOVED = 3,
}

/**
 * Helper functions
 */
export function isUserStateValid(state: UserState): boolean {
  return state >= UserState.UNSPECIFIED && state <= UserState.INITIAL;
}

export function isUserStateExists(state: UserState): boolean {
  return state !== UserState.UNSPECIFIED && state !== UserState.DELETED;
}

export function isUserStateEnabled(state: UserState): boolean {
  return state === UserState.ACTIVE || state === UserState.INITIAL;
}
