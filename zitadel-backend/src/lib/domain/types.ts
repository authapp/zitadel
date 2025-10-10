/**
 * Domain Core Types
 * 
 * Base types and interfaces used across all domain objects
 */

/**
 * Object details - common metadata for all domain objects
 */
export interface ObjectDetails {
  /** Event sequence number */
  sequence: bigint;
  /** Date of last event */
  eventDate: Date;
  /** Date of creation */
  creationDate: Date;
  /** Resource owner (org/instance ID) */
  resourceOwner: string;
  /** Aggregate ID */
  id: string;
}

/**
 * Object root - base for all domain entities
 */
export interface ObjectRoot {
  aggregateID: string;
  resourceOwner: string;
  creationDate?: Date;
  changeDate?: Date;
  sequence?: bigint;
}

/**
 * State interface - common state management
 */
export interface Stateful<T> {
  state: T;
  isValid(): boolean;
  exists(): boolean;
}

/**
 * Gender enum
 */
export enum Gender {
  UNSPECIFIED = 0,
  FEMALE = 1,
  MALE = 2,
  DIVERSE = 3,
}

/**
 * Language enum
 */
export enum Language {
  UNSPECIFIED = 'und',
  ENGLISH = 'en',
  GERMAN = 'de',
  FRENCH = 'fr',
  ITALIAN = 'it',
  SPANISH = 'es',
  POLISH = 'pl',
  JAPANESE = 'ja',
  CHINESE = 'zh',
}

/**
 * Authentication method type
 */
export enum AuthMethodType {
  UNSPECIFIED = 0,
  PASSWORD = 1,
  TOTP = 2,
  U2F = 3,
  PASSWORDLESS = 4,
  IDP = 5,
  OTP_SMS = 6,
  OTP_EMAIL = 7,
  PRIVATE_KEY = 8,
}

/**
 * Multi-factor authentication type
 */
export enum MFAType {
  UNSPECIFIED = 0,
  TOTP = 1,
  U2F = 2,
  OTP_SMS = 3,
  OTP_EMAIL = 4,
}

/**
 * Second factor type
 */
export enum SecondFactorType {
  UNSPECIFIED = 0,
  TOTP = 1,
  U2F = 2,
  OTP_SMS = 3,
  OTP_EMAIL = 4,
}

/**
 * Multi-factor authentication level
 */
export enum MFALevel {
  UNSPECIFIED = 0,
  NONE = 1,
  SOFTWARE = 2,
  HARDWARE = 3,
  CERTIFIED_HARDWARE = 4,
}
