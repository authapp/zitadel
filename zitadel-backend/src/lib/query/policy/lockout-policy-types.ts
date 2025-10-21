/**
 * Lockout Policy Types
 * Defines account lockout rules for failed authentication attempts
 * Based on Zitadel Go internal/query/lockout_policy.go
 */

/**
 * Lockout Policy
 * Controls account lockout behavior after failed login attempts
 */
export interface LockoutPolicy {
  id: string;
  instanceID: string;
  organizationID?: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  resourceOwner: string;
  
  // Lockout settings
  maxPasswordAttempts: number;
  maxOTPAttempts: number;
  showFailures: boolean;
  
  isDefault: boolean;
}
