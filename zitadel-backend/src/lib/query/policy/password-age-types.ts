/**
 * Password Age Policy Types
 * Based on Zitadel Go internal/query/password_age_policy.go
 */

/**
 * Password age policy
 */
export interface PasswordAgePolicy {
  id: string;
  instanceID: string;
  organizationID?: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  
  // Age requirements
  maxAgeDays: number;        // Maximum password age in days (0 = unlimited)
  expireWarnDays: number;    // Days before expiration to warn user
  
  // State
  isDefault: boolean;
  resourceOwner: string;
}

/**
 * Default password age settings
 */
export const DEFAULT_PASSWORD_AGE: Partial<PasswordAgePolicy> = {
  maxAgeDays: 0,          // No expiration by default
  expireWarnDays: 0,      // No warning by default
};

/**
 * Password age check result
 */
export interface PasswordAgeCheckResult {
  expired: boolean;
  expiresIn?: number;      // Days until expiration
  shouldWarn: boolean;
  daysUntilWarning?: number;
}
