/**
 * Domain Policy Queries
 * Based on Zitadel Go internal/query/domain_policy.go
 */

import { DatabasePool } from '../../database';
import { DomainPolicy, DEFAULT_DOMAIN_POLICY } from './domain-policy-types';

export class DomainPolicyQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get domain policy for an organization
   * Falls back to instance default if org policy doesn't exist
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID (optional)
   * @returns Domain policy
   */
  async getDomainPolicy(
    instanceID: string,
    organizationID?: string
  ): Promise<DomainPolicy> {
    // Try to get org-specific policy first
    if (organizationID) {
      const orgPolicy = await this.getOrgDomainPolicy(instanceID, organizationID);
      if (orgPolicy) {
        return orgPolicy;
      }
    }

    // Fall back to instance default
    return this.getDefaultDomainPolicy(instanceID);
  }

  /**
   * Get default (instance-level) domain policy
   * 
   * @param instanceID - Instance ID
   * @returns Default domain policy
   */
  async getDefaultDomainPolicy(instanceID: string): Promise<DomainPolicy> {
    const query = `
      SELECT 
        id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        user_login_must_be_domain,
        validate_org_domains,
        smtp_sender_address_matches_instance_domain,
        is_default,
        resource_owner
      FROM projections.domain_policies
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
   * Get organization-specific domain policy
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns Organization policy or null
   */
  private async getOrgDomainPolicy(
    instanceID: string,
    organizationID: string
  ): Promise<DomainPolicy | null> {
    const query = `
      SELECT 
        id,
        instance_id,
        organization_id,
        creation_date,
        change_date,
        sequence,
        user_login_must_be_domain,
        validate_org_domains,
        smtp_sender_address_matches_instance_domain,
        is_default,
        resource_owner
      FROM projections.domain_policies
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
   * Get built-in default policy when no instance policy exists
   */
  private getBuiltInDefault(instanceID: string): DomainPolicy {
    return {
      id: 'built-in-default',
      instanceID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: BigInt(0),
      userLoginMustBeDomain: DEFAULT_DOMAIN_POLICY.userLoginMustBeDomain!,
      validateOrgDomains: DEFAULT_DOMAIN_POLICY.validateOrgDomains!,
      smtpSenderAddressMatchesInstanceDomain: DEFAULT_DOMAIN_POLICY.smtpSenderAddressMatchesInstanceDomain!,
      isDefault: true,
      resourceOwner: instanceID,
    };
  }

  /**
   * Map database row to DomainPolicy
   */
  private mapToPolicy(row: any): DomainPolicy {
    return {
      id: row.id,
      instanceID: row.instance_id,
      organizationID: row.organization_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      userLoginMustBeDomain: row.user_login_must_be_domain,
      validateOrgDomains: row.validate_org_domains,
      smtpSenderAddressMatchesInstanceDomain: row.smtp_sender_address_matches_instance_domain,
      isDefault: row.is_default,
      resourceOwner: row.resource_owner,
    };
  }
}
