/**
 * Password Age Policy Queries
 * Based on Zitadel Go internal/query/password_age_policy.go
 */

import { DatabasePool } from '../../database';
import {
  PasswordAgePolicy,
  DEFAULT_PASSWORD_AGE,
  PasswordAgeCheckResult,
} from './password-age-types';

export class PasswordAgeQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get password age policy for an organization
   * Falls back to instance default if org policy doesn't exist
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID (optional)
   * @returns Password age policy
   */
  async getPasswordAgePolicy(
    instanceID: string,
    organizationID?: string
  ): Promise<PasswordAgePolicy> {
    // Try to get org-specific policy first
    if (organizationID) {
      const orgPolicy = await this.getOrgPasswordAgePolicy(instanceID, organizationID);
      if (orgPolicy) {
        return orgPolicy;
      }
    }

    // Fall back to instance default
    return this.getDefaultPasswordAgePolicy(instanceID);
  }

  /**
   * Get default (instance-level) password age policy
   * 
   * @param instanceID - Instance ID
   * @returns Default password age policy
   */
  async getDefaultPasswordAgePolicy(
    instanceID: string
  ): Promise<PasswordAgePolicy> {
    const query = `
      SELECT 
        id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        max_age_days,
        expire_warn_days,
        is_default,
        resource_owner
      FROM projections.password_age_policies
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
   * Get organization-specific password age policy
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns Organization policy or null
   */
  private async getOrgPasswordAgePolicy(
    instanceID: string,
    organizationID: string
  ): Promise<PasswordAgePolicy | null> {
    const query = `
      SELECT 
        id,
        instance_id,
        organization_id,
        creation_date,
        change_date,
        sequence,
        max_age_days,
        expire_warn_days,
        is_default,
        resource_owner
      FROM projections.password_age_policies
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
   * Check if password has expired or is about to expire
   * 
   * @param passwordChangeDate - Date when password was last changed
   * @param policy - Password age policy
   * @returns Age check result
   */
  checkPasswordAge(
    passwordChangeDate: Date,
    policy: PasswordAgePolicy
  ): PasswordAgeCheckResult {
    // If no max age, password never expires
    if (policy.maxAgeDays === 0) {
      return {
        expired: false,
        shouldWarn: false,
      };
    }

    const now = new Date();
    const daysSinceChange = Math.floor(
      (now.getTime() - passwordChangeDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const daysUntilExpiration = policy.maxAgeDays - daysSinceChange;

    return {
      expired: daysUntilExpiration <= 0,
      expiresIn: daysUntilExpiration > 0 ? daysUntilExpiration : undefined,
      shouldWarn: daysUntilExpiration > 0 && daysUntilExpiration <= policy.expireWarnDays,
      daysUntilWarning: daysUntilExpiration > policy.expireWarnDays 
        ? daysUntilExpiration - policy.expireWarnDays 
        : undefined,
    };
  }

  /**
   * Get built-in default policy when no instance policy exists
   */
  private getBuiltInDefault(instanceID: string): PasswordAgePolicy {
    return {
      id: 'built-in-default',
      instanceID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: BigInt(0),
      maxAgeDays: DEFAULT_PASSWORD_AGE.maxAgeDays!,
      expireWarnDays: DEFAULT_PASSWORD_AGE.expireWarnDays!,
      isDefault: true,
      resourceOwner: instanceID,
    };
  }

  /**
   * Map database row to PasswordAgePolicy
   */
  private mapToPolicy(row: any): PasswordAgePolicy {
    return {
      id: row.id,
      instanceID: row.instance_id,
      organizationID: row.organization_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      maxAgeDays: row.max_age_days,
      expireWarnDays: row.expire_warn_days,
      isDefault: row.is_default,
      resourceOwner: row.resource_owner,
    };
  }
}
