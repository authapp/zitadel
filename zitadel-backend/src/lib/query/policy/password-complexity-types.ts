/**
 * Password Complexity Policy Types
 * Based on Zitadel Go internal/query/password_complexity_policy.go
 */

/**
 * Password complexity policy
 */
export interface PasswordComplexityPolicy {
  id: string;
  instanceID: string;
  organizationID?: string;
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  
  // Complexity requirements
  minLength: number;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  
  // State
  isDefault: boolean;
  resourceOwner: string;
}

/**
 * Default password complexity settings
 */
export const DEFAULT_PASSWORD_COMPLEXITY: Partial<PasswordComplexityPolicy> = {
  minLength: 8,
  hasUppercase: true,
  hasLowercase: true,
  hasNumber: true,
  hasSymbol: false,
};

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Password complexity check requirements
 */
export interface PasswordComplexityRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}
