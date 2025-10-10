/**
 * User Proto Definitions (v2)
 * 
 * User-related proto types
 * Based on: proto/zitadel/user/v2/user.proto
 */

/**
 * Add human user request
 */
export interface AddHumanUserRequest {
  /** Username */
  username?: string;
  
  /** Email */
  email?: SetEmail;
  
  /** Phone */
  phone?: SetPhone;
  
  /** Profile information */
  profile?: SetHumanProfile;
  
  /** Password */
  password?: SetPassword;
}

/**
 * Set email
 */
export interface SetEmail {
  /** Email address */
  email: string;
  
  /** Email is verified */
  isVerified?: boolean;
}

/**
 * Set phone
 */
export interface SetPhone {
  /** Phone number */
  phone: string;
  
  /** Phone is verified */
  isVerified?: boolean;
}

/**
 * Set human profile
 */
export interface SetHumanProfile {
  /** Given name */
  givenName: string;
  
  /** Family name */
  familyName: string;
  
  /** Nick name */
  nickName?: string;
  
  /** Display name */
  displayName?: string;
  
  /** Preferred language */
  preferredLanguage?: string;
  
  /** Gender */
  gender?: Gender;
}

/**
 * Gender enum
 */
export enum Gender {
  GENDER_UNSPECIFIED = 0,
  GENDER_FEMALE = 1,
  GENDER_MALE = 2,
  GENDER_DIVERSE = 3,
}

/**
 * Set password
 */
export interface SetPassword {
  /** Password value */
  password: string;
  
  /** Change required on next login */
  changeRequired?: boolean;
}
