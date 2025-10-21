/**
 * Notification Policy Queries
 * Handles notification policy queries with 3-level inheritance
 * Based on Zitadel Go internal/query/notification_policy.go
 */

import { DatabasePool } from '../../database';
import { NotificationPolicy } from './notification-policy-types';

export class NotificationPolicyQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get notification policy with inheritance (org → instance → built-in)
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Optional organization ID for org-specific policy
   * @returns Notification policy (org-specific, instance, or built-in default)
   */
  async getNotificationPolicy(
    instanceID: string,
    organizationID?: string
  ): Promise<NotificationPolicy> {
    if (organizationID) {
      // Try org-specific policy first
      const orgPolicy = await this.getOrgNotificationPolicy(instanceID, organizationID);
      if (orgPolicy) {
        return orgPolicy;
      }
    }

    // Fall back to instance policy or built-in default
    return this.getDefaultNotificationPolicy(instanceID);
  }

  /**
   * Get default (instance-level) notification policy
   * 
   * @param instanceID - Instance ID
   * @returns Default notification policy
   */
  async getDefaultNotificationPolicy(instanceID: string): Promise<NotificationPolicy> {
    const query = `
      SELECT 
        id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        password_change,
        is_default,
        resource_owner
      FROM projections.notification_policies
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
   * Get organization-specific notification policy
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns Organization policy or null
   */
  private async getOrgNotificationPolicy(
    instanceID: string,
    organizationID: string
  ): Promise<NotificationPolicy | null> {
    const query = `
      SELECT 
        id,
        instance_id,
        organization_id,
        creation_date,
        change_date,
        sequence,
        password_change,
        is_default,
        resource_owner
      FROM projections.notification_policies
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
   * Get built-in default notification policy
   * These are sensible defaults when no policy is configured
   */
  private getBuiltInDefault(instanceID: string): NotificationPolicy {
    return {
      id: 'built-in-default',
      instanceID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: 0,
      resourceOwner: instanceID,
      passwordChange: true,
      isDefault: true,
    };
  }

  /**
   * Map database result to NotificationPolicy
   */
  private mapToPolicy(row: any): NotificationPolicy {
    return {
      id: row.id,
      instanceID: row.instance_id,
      organizationID: row.organization_id || undefined,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      resourceOwner: row.resource_owner,
      passwordChange: row.password_change,
      isDefault: row.is_default,
    };
  }
}
