/**
 * Security Policy Queries
 * Handles security policy queries (instance-level only)
 * Based on Zitadel Go internal/query/security_policy.go
 */

import { DatabasePool } from '../../database';
import { SecurityPolicy } from './security-policy-types';

export class SecurityPolicyQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get security policy for instance
   * Note: Security policy is instance-level only, no org-level inheritance
   * 
   * @param instanceID - Instance ID
   * @returns Security policy (instance or built-in default)
   */
  async getSecurityPolicy(instanceID: string): Promise<SecurityPolicy> {
    const query = `
      SELECT 
        aggregate_id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        enable_iframe_embedding,
        allowed_origins,
        enable_impersonation,
        resource_owner
      FROM projections.security_policies
      WHERE instance_id = $1
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
   * Get built-in default security policy
   * These are sensible defaults when no policy is configured
   */
  private getBuiltInDefault(instanceID: string): SecurityPolicy {
    return {
      aggregateID: instanceID,
      instanceID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: 0,
      resourceOwner: instanceID,
      enableIframeEmbedding: false,
      allowedOrigins: [],
      enableImpersonation: false,
    };
  }

  /**
   * Map database result to SecurityPolicy
   */
  private mapToPolicy(row: any): SecurityPolicy {
    return {
      aggregateID: row.aggregate_id,
      instanceID: row.instance_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      resourceOwner: row.resource_owner,
      enableIframeEmbedding: row.enable_iframe_embedding,
      allowedOrigins: row.allowed_origins || [],
      enableImpersonation: row.enable_impersonation,
    };
  }
}
