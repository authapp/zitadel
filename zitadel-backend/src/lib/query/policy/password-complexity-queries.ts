/**
 * Password Complexity Policy Queries
 * Based on Zitadel Go internal/query/password_complexity_policy.go
 */

import { DatabasePool } from '../../database';
import {
  PasswordComplexityPolicy,
  DEFAULT_PASSWORD_COMPLEXITY,
  PasswordValidationResult,
  PasswordComplexityRequirements,
} from './password-complexity-types';

export class PasswordComplexityQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get password complexity policy for an organization
   * Falls back to instance default if org policy doesn't exist
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID (optional)
   * @returns Password complexity policy
   */
  async getPasswordComplexityPolicy(
    instanceID: string,
    organizationID?: string
  ): Promise<PasswordComplexityPolicy> {
    // Try to get org-specific policy first
    if (organizationID) {
      const orgPolicy = await this.getOrgPasswordComplexityPolicy(instanceID, organizationID);
      if (orgPolicy) {
        return orgPolicy;
      }
    }

    // Fall back to instance default
    return this.getDefaultPasswordComplexityPolicy(instanceID);
  }

  /**
   * Get default (instance-level) password complexity policy
   * 
   * @param instanceID - Instance ID
   * @returns Default password complexity policy
   */
  async getDefaultPasswordComplexityPolicy(
    instanceID: string
  ): Promise<PasswordComplexityPolicy> {
    const query = `
      SELECT 
        id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        min_length,
        has_uppercase,
        has_lowercase,
        has_number,
        has_symbol,
        is_default,
        resource_owner
      FROM projections.password_complexity_policies
      WHERE instance_id = $1 AND is_default = true
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID]);

    if (!result) {
      // Return built-in default if no instance policy exists
      return this.getBuiltInDefault(instanceID);
    }

    return this.mapToPolicy(result);
  }

  /**
   * Get organization-specific password complexity policy
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns Organization policy or null
   */
  private async getOrgPasswordComplexityPolicy(
    instanceID: string,
    organizationID: string
  ): Promise<PasswordComplexityPolicy | null> {
    const query = `
      SELECT 
        id,
        instance_id,
        organization_id,
        creation_date,
        change_date,
        sequence,
        min_length,
        has_uppercase,
        has_lowercase,
        has_number,
        has_symbol,
        is_default,
        resource_owner
      FROM projections.password_complexity_policies
      WHERE instance_id = $1 AND organization_id = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, organizationID]);

    if (!result) {
      return null;
    }

    return this.mapToPolicy(result);
  }

  /**
   * Validate a password against complexity policy
   * 
   * @param password - Password to validate
   * @param policy - Password complexity policy
   * @returns Validation result
   */
  validatePassword(
    password: string,
    policy: PasswordComplexityPolicy
  ): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.hasUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.hasLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.hasNumber && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.hasSymbol && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get password complexity requirements (for UI display)
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID (optional)
   * @returns Password complexity requirements
   */
  async getPasswordComplexityRequirements(
    instanceID: string,
    organizationID?: string
  ): Promise<PasswordComplexityRequirements> {
    const policy = await this.getPasswordComplexityPolicy(instanceID, organizationID);

    return {
      minLength: policy.minLength,
      requireUppercase: policy.hasUppercase,
      requireLowercase: policy.hasLowercase,
      requireNumber: policy.hasNumber,
      requireSymbol: policy.hasSymbol,
    };
  }

  /**
   * Get built-in default policy when no instance policy exists
   */
  private getBuiltInDefault(instanceID: string): PasswordComplexityPolicy {
    return {
      id: 'built-in-default',
      instanceID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: BigInt(0),
      minLength: DEFAULT_PASSWORD_COMPLEXITY.minLength!,
      hasUppercase: DEFAULT_PASSWORD_COMPLEXITY.hasUppercase!,
      hasLowercase: DEFAULT_PASSWORD_COMPLEXITY.hasLowercase!,
      hasNumber: DEFAULT_PASSWORD_COMPLEXITY.hasNumber!,
      hasSymbol: DEFAULT_PASSWORD_COMPLEXITY.hasSymbol!,
      isDefault: true,
      resourceOwner: instanceID,
    };
  }

  /**
   * Map database row to PasswordComplexityPolicy
   */
  private mapToPolicy(row: any): PasswordComplexityPolicy {
    return {
      id: row.id,
      instanceID: row.instance_id,
      organizationID: row.organization_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      minLength: row.min_length,
      hasUppercase: row.has_uppercase,
      hasLowercase: row.has_lowercase,
      hasNumber: row.has_number,
      hasSymbol: row.has_symbol,
      isDefault: row.is_default,
      resourceOwner: row.resource_owner,
    };
  }
}
