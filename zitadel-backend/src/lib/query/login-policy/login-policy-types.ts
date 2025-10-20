/**
 * Login Policy types for Zitadel query layer
 * Manages authentication policies including MFA, password complexity, and lockout rules
 */

/**
 * Multi-factor authentication type
 */
export enum MultiFactorType {
  UNSPECIFIED = 0,
  OTP = 1,
  U2F = 2,
  OTP_EMAIL = 3,
  OTP_SMS = 4,
}

/**
 * Second factor authentication type
 */
export enum SecondFactorType {
  UNSPECIFIED = 0,
  OTP = 1,
  U2F = 2,
  OTP_EMAIL = 3,
  OTP_SMS = 4,
}

/**
 * Password complexity policy
 */
export interface PasswordComplexityPolicy {
  minLength: number;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

/**
 * Password age policy
 */
export interface PasswordAgePolicy {
  maxAgeDays: number;
  expireWarnDays: number;
}

/**
 * Lockout policy
 */
export interface LockoutPolicy {
  maxPasswordAttempts: number;
  maxOTPAttempts: number;
  showLockOutFailures: boolean;
}

/**
 * Login policy configuration
 */
export interface LoginPolicy {
  id: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  resourceOwner: string;
  instanceID: string;
  
  // Authentication methods
  allowUsernamePassword: boolean;
  allowRegister: boolean;
  allowExternalIDP: boolean;
  
  // MFA requirements
  forceMFA: boolean;
  forceMFALocalOnly: boolean;
  
  // Password policy
  passwordCheckLifetime: number; // Duration in seconds
  externalLoginCheckLifetime: number; // Duration in seconds
  mfaInitSkipLifetime: number; // Duration in seconds
  secondFactorCheckLifetime: number; // Duration in seconds
  multiFactorCheckLifetime: number; // Duration in seconds
  
  // Password complexity
  passwordComplexity?: PasswordComplexityPolicy;
  
  // Password age
  passwordAge?: PasswordAgePolicy;
  
  // Lockout policy
  lockoutPolicy?: LockoutPolicy;
  
  // Multi-factor types
  secondFactors: SecondFactorType[];
  multiFactors: MultiFactorType[];
  
  // IDP configuration
  idps: string[];
  
  // Flags
  allowDomainDiscovery: boolean;
  disableLoginWithEmail: boolean;
  disableLoginWithPhone: boolean;
  ignoreUnknownUsernames: boolean;
  defaultRedirectURI: string;
  
  // Inheritance
  isDefault: boolean;
  hidePasswordReset: boolean;
}

/**
 * Active login policy (resolved with inheritance)
 */
export interface ActiveLoginPolicy extends LoginPolicy {
  orgID?: string;
  isOrgPolicy: boolean;
}

/**
 * Search query for login policies
 */
export interface LoginPolicySearchQuery {
  instanceID?: string;
  resourceOwner?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search result for login policies
 */
export interface LoginPolicySearchResult {
  policies: LoginPolicy[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Active IDPs for login policy
 */
export interface ActiveIDPs {
  idps: Array<{
    idpID: string;
    name: string;
    type: number;
  }>;
}

/**
 * Second factors policy
 */
export interface SecondFactorsPolicy {
  secondFactors: SecondFactorType[];
  multiFactors: MultiFactorType[];
}
