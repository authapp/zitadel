/**
 * User domain models and types
 */

export enum UserState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  DELETED = 3,
  LOCKED = 4,
  SUSPENDED = 5,
  INITIAL = 6,
}

export enum UserType {
  UNSPECIFIED = 0,
  HUMAN = 1,
  MACHINE = 2,
}

export enum UserAuthMethodType {
  UNSPECIFIED = 0,
  TOTP = 1,
  U2F = 2,
  PASSWORDLESS = 3,
  PASSWORD = 4,
  IDP = 5,
  OTP_SMS = 6,
  OTP_EMAIL = 7,
  OTP = 8,
  PRIVATE_KEY = 9,
}

export enum Gender {
  UNSPECIFIED = 0,
  FEMALE = 1,
  MALE = 2,
  DIVERSE = 3,
}

/**
 * Human user profile
 */
export interface HumanProfile {
  firstName: string;
  lastName: string;
  nickName?: string;
  displayName?: string;
  preferredLanguage?: string;
  gender?: Gender;
  avatarUrl?: string;
}

/**
 * Human user email
 */
export interface HumanEmail {
  email: string;
  isVerified: boolean;
  verifiedAt?: Date;
}

/**
 * Human user phone
 */
export interface HumanPhone {
  phone: string;
  isVerified: boolean;
  verifiedAt?: Date;
}

/**
 * Human user address
 */
export interface HumanAddress {
  country?: string;
  locality?: string;
  postalCode?: string;
  region?: string;
  streetAddress?: string;
}

/**
 * Password information
 */
export interface Password {
  encodedHash: string;
  changeRequired: boolean;
  changedAt?: Date;
}

/**
 * Machine user key
 */
export interface MachineKey {
  keyId: string;
  type: string;
  expirationDate?: Date;
  publicKey: string;
}

/**
 * Base user interface
 */
export interface User {
  id: string;
  state: UserState;
  type: UserType;
  userName: string;
  resourceOwner: string; // Organization ID
  createdAt: Date;
  changedAt: Date;
  sequence: number;
}

/**
 * Human user
 */
export interface HumanUser extends User {
  type: UserType.HUMAN;
  profile: HumanProfile;
  email: HumanEmail;
  phone?: HumanPhone;
  address?: HumanAddress;
  password?: Password;
}

/**
 * Machine user (service account)
 */
export interface MachineUser extends User {
  type: UserType.MACHINE;
  name: string;
  description?: string;
  keys?: MachineKey[];
}

/**
 * User authentication methods
 */
export interface UserAuthMethod {
  type: UserAuthMethodType;
  state: number;
  createdAt: Date;
  changedAt: Date;
}

/**
 * Check if user state is active
 */
export function isUserActive(state: UserState): boolean {
  return state === UserState.ACTIVE || state === UserState.INITIAL;
}

/**
 * Check if user exists
 */
export function userExists(state: UserState): boolean {
  return state !== UserState.UNSPECIFIED && state !== UserState.DELETED;
}

/**
 * Check if user is locked
 */
export function isUserLocked(state: UserState): boolean {
  return state === UserState.LOCKED || state === UserState.SUSPENDED;
}

/**
 * Check if email is verified
 */
export function isEmailVerified(email: HumanEmail): boolean {
  return email.isVerified;
}

/**
 * Check if phone is verified
 */
export function isPhoneVerified(phone: HumanPhone): boolean {
  return phone.isVerified;
}
