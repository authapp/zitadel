/**
 * Lockout Policy Queries
 * Handles account lockout policy queries with 3-level inheritance
 * Based on Zitadel Go internal/query/lockout_policy.go
 */

import { DatabasePool } from '../../database';
import { LockoutPolicy } from './lockout-policy-types';

export class LockoutPolicyQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get lockout policy with inheritance (org → instance → built-in)
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Optional organization ID for org-specific policy
   * @returns Lockout policy (org-specific, instance, or built-in default)
   */
  async getLockoutPolicy(
    instanceID: string,
    organizationID?: string
  ): Promise<LockoutPolicy> {
    if (organizationID) {
      // Try org-specific policy first
      const orgPolicy = await this.getOrgLockoutPolicy(instanceID, organizationID);
      if (orgPolicy) {
        return orgPolicy;
      }
    }

    // Fall back to instance policy or built-in default
    return this.getDefaultLockoutPolicy(instanceID);
  }

  /**
   * Get default (instance-level) lockout policy
   * 
   * @param instanceID - Instance ID
   * @returns Default lockout policy
   */
  async getDefaultLockoutPolicy(instanceID: string): Promise<LockoutPolicy> {
    const query = `
      SELECT 
        id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        max_password_attempts,
        max_otp_attempts,
        show_failures,
        is_default,
        resource_owner
      FROM projections.lockout_policies
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
   * Get organization-specific lockout policy
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns Organization policy or null
   */
  private async getOrgLockoutPolicy(
    instanceID: string,
    organizationID: string
  ): Promise<LockoutPolicy | null> {
    const query = `
      SELECT 
        id,
        instance_id,
        organization_id,
        creation_date,
        change_date,
        sequence,
        max_password_attempts,
        max_otp_attempts,
        show_failures,
        is_default,
        resource_owner
      FROM projections.lockout_policies
      WHERE instance_id = $1 AND organization_id = $2 AND is_default = false
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, organizationID]);

    if (!result) {
      return null;
    }

    return this.mapToPolicy(result);
  }

  /**
   * Get built-in default lockout policy
   * These are sensible defaults when no policy is configured
   */
  private getBuiltInDefault(instanceID: string): LockoutPolicy {
    return {
      id: 'built-in-default',
      instanceID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: 0,
      resourceOwner: instanceID,
      maxPasswordAttempts: 10,
      maxOTPAttempts: 5,
      showFailures: true,
      isDefault: true,
    };
  }

  /**
   * Map database result to LockoutPolicy
   */
  private mapToPolicy(row: any): LockoutPolicy {
    return {
      id: row.id,
      instanceID: row.instance_id,
      organizationID: row.organization_id || undefined,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      resourceOwner: row.resource_owner,
      maxPasswordAttempts: Number(row.max_password_attempts),
      maxOTPAttempts: Number(row.max_otp_attempts),
      showFailures: row.show_failures,
      isDefault: row.is_default,
    };
  }
}
