/**
 * Login Policy queries for Zitadel query layer
 * Handles authentication policy lookups including MFA, password, and lockout policies
 */

import { DatabasePool } from '../../database';
import {
  LoginPolicy,
  ActiveLoginPolicy,
  LoginPolicySearchQuery,
  LoginPolicySearchResult,
  ActiveIDPs,
  SecondFactorsPolicy,
  SecondFactorType,
  MultiFactorType,
} from './login-policy-types';

export class LoginPolicyQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get active login policy for resource owner
   * Implements policy inheritance: org → instance
   * 
   * @param resourceOwner - Org or instance ID
   * @param instanceID - Instance ID
   * @returns Active login policy with inheritance resolved
   */
  async getActiveLoginPolicy(
    resourceOwner: string,
    instanceID: string
  ): Promise<ActiveLoginPolicy | null> {
    // Try to get org-specific policy first
    const orgPolicy = await this.database.queryOne(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        allow_username_password, allow_register, allow_external_idp,
        force_mfa, force_mfa_local_only,
        password_check_lifetime, external_login_check_lifetime,
        mfa_init_skip_lifetime, second_factor_check_lifetime, multi_factor_check_lifetime,
        allow_domain_discovery, disable_login_with_email, disable_login_with_phone,
        ignore_unknown_usernames, default_redirect_uri, is_default, hide_password_reset
       FROM projections.login_policies
       WHERE resource_owner = $1 AND instance_id = $2`,
      [resourceOwner, instanceID]
    );

    if (orgPolicy) {
      const policy = this.mapRowToLoginPolicy(orgPolicy);
      
      // Get second factors
      const factors = await this.getSecondFactorsForPolicy(policy.id, instanceID);
      policy.secondFactors = factors.secondFactors;
      policy.multiFactors = factors.multiFactors;
      
      // Get IDPs
      const idps = await this.getIDPsForPolicy(policy.id, instanceID);
      policy.idps = idps;
      
      return {
        ...policy,
        orgID: resourceOwner,
        isOrgPolicy: true,
      };
    }

    // Fall back to instance default policy
    const instancePolicy = await this.database.queryOne(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        allow_username_password, allow_register, allow_external_idp,
        force_mfa, force_mfa_local_only,
        password_check_lifetime, external_login_check_lifetime,
        mfa_init_skip_lifetime, second_factor_check_lifetime, multi_factor_check_lifetime,
        allow_domain_discovery, disable_login_with_email, disable_login_with_phone,
        ignore_unknown_usernames, default_redirect_uri, is_default, hide_password_reset
       FROM projections.login_policies
       WHERE instance_id = $1 AND is_default = true`,
      [instanceID]
    );

    if (!instancePolicy) {
      return null;
    }

    const policy = this.mapRowToLoginPolicy(instancePolicy);
    
    // Get second factors
    const factors = await this.getSecondFactorsForPolicy(policy.id, instanceID);
    policy.secondFactors = factors.secondFactors;
    policy.multiFactors = factors.multiFactors;
    
    // Get IDPs
    const idps = await this.getIDPsForPolicy(policy.id, instanceID);
    policy.idps = idps;
    
    return {
      ...policy,
      isOrgPolicy: false,
    };
  }

  /**
   * Get login policy by resource owner
   * 
   * @param resourceOwner - Resource owner ID
   * @param instanceID - Instance ID
   * @returns Login policy or null
   */
  async getLoginPolicy(resourceOwner: string, instanceID: string): Promise<LoginPolicy | null> {
    const result = await this.database.queryOne(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        allow_username_password, allow_register, allow_external_idp,
        force_mfa, force_mfa_local_only,
        password_check_lifetime, external_login_check_lifetime,
        mfa_init_skip_lifetime, second_factor_check_lifetime, multi_factor_check_lifetime,
        allow_domain_discovery, disable_login_with_email, disable_login_with_phone,
        ignore_unknown_usernames, default_redirect_uri, is_default, hide_password_reset
       FROM projections.login_policies
       WHERE resource_owner = $1 AND instance_id = $2`,
      [resourceOwner, instanceID]
    );

    if (!result) {
      return null;
    }

    const policy = this.mapRowToLoginPolicy(result);
    
    // Get second factors
    const factors = await this.getSecondFactorsForPolicy(policy.id, instanceID);
    policy.secondFactors = factors.secondFactors;
    policy.multiFactors = factors.multiFactors;
    
    // Get IDPs
    const idps = await this.getIDPsForPolicy(policy.id, instanceID);
    policy.idps = idps;
    
    return policy;
  }

  /**
   * Get login policy by ID
   * 
   * @param policyID - Policy ID
   * @param instanceID - Optional instance ID filter
   * @returns Login policy or null
   */
  async getLoginPolicyByID(policyID: string, instanceID?: string): Promise<LoginPolicy | null> {
    const conditions = ['id = $1'];
    const params: any[] = [policyID];

    if (instanceID) {
      conditions.push('instance_id = $2');
      params.push(instanceID);
    }

    const result = await this.database.queryOne(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        allow_username_password, allow_register, allow_external_idp,
        force_mfa, force_mfa_local_only,
        password_check_lifetime, external_login_check_lifetime,
        mfa_init_skip_lifetime, second_factor_check_lifetime, multi_factor_check_lifetime,
        allow_domain_discovery, disable_login_with_email, disable_login_with_phone,
        ignore_unknown_usernames, default_redirect_uri, is_default, hide_password_reset
       FROM projections.login_policies
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (!result) {
      return null;
    }

    const policy = this.mapRowToLoginPolicy(result);
    
    // Get second factors
    const factors = await this.getSecondFactorsForPolicy(policy.id, policy.instanceID);
    policy.secondFactors = factors.secondFactors;
    policy.multiFactors = factors.multiFactors;
    
    // Get IDPs
    const idps = await this.getIDPsForPolicy(policy.id, policy.instanceID);
    policy.idps = idps;
    
    return policy;
  }

  /**
   * Get default login policy for instance
   * 
   * @param instanceID - Instance ID
   * @returns Default login policy or null
   */
  async getDefaultLoginPolicy(instanceID: string): Promise<LoginPolicy | null> {
    const result = await this.database.queryOne(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        allow_username_password, allow_register, allow_external_idp,
        force_mfa, force_mfa_local_only,
        password_check_lifetime, external_login_check_lifetime,
        mfa_init_skip_lifetime, second_factor_check_lifetime, multi_factor_check_lifetime,
        allow_domain_discovery, disable_login_with_email, disable_login_with_phone,
        ignore_unknown_usernames, default_redirect_uri, is_default, hide_password_reset
       FROM projections.login_policies
       WHERE instance_id = $1 AND is_default = true`,
      [instanceID]
    );

    if (!result) {
      return null;
    }

    const policy = this.mapRowToLoginPolicy(result);
    
    // Get second factors
    const factors = await this.getSecondFactorsForPolicy(policy.id, instanceID);
    policy.secondFactors = factors.secondFactors;
    policy.multiFactors = factors.multiFactors;
    
    // Get IDPs
    const idps = await this.getIDPsForPolicy(policy.id, instanceID);
    policy.idps = idps;
    
    return policy;
  }

  /**
   * Search login policies
   * 
   * @param query - Search query parameters
   * @returns Search result with policies
   */
  async searchLoginPolicies(query: LoginPolicySearchQuery): Promise<LoginPolicySearchResult> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.resourceOwner) {
      conditions.push(`resource_owner = $${paramIndex++}`);
      params.push(query.resourceOwner);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM projections.login_policies ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get policies
    const result = await this.database.query(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        allow_username_password, allow_register, allow_external_idp,
        force_mfa, force_mfa_local_only,
        password_check_lifetime, external_login_check_lifetime,
        mfa_init_skip_lifetime, second_factor_check_lifetime, multi_factor_check_lifetime,
        allow_domain_discovery, disable_login_with_email, disable_login_with_phone,
        ignore_unknown_usernames, default_redirect_uri, is_default, hide_password_reset
       FROM projections.login_policies
       ${whereClause}
       ORDER BY creation_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const policies = await Promise.all(
      result.rows.map(async row => {
        const policy = this.mapRowToLoginPolicy(row);
        
        // Get second factors
        const factors = await this.getSecondFactorsForPolicy(policy.id, policy.instanceID);
        policy.secondFactors = factors.secondFactors;
        policy.multiFactors = factors.multiFactors;
        
        // Get IDPs
        const idps = await this.getIDPsForPolicy(policy.id, policy.instanceID);
        policy.idps = idps;
        
        return policy;
      })
    );

    return {
      policies,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get active IDPs for login policy
   * 
   * @param resourceOwner - Resource owner ID
   * @param instanceID - Instance ID
   * @returns Active IDPs
   */
  async getActiveIDPs(resourceOwner: string, instanceID: string): Promise<ActiveIDPs> {
    // Get policy first to find the correct resource owner
    const policy = await this.getActiveLoginPolicy(resourceOwner, instanceID);
    if (!policy) {
      return { idps: [] };
    }

    const result = await this.database.query(
      `SELECT l.idp_id, i.name, i.type
       FROM projections.idp_login_policy_links l
       JOIN projections.idps i ON l.idp_id = i.id AND l.instance_id = i.instance_id
       WHERE l.resource_owner = $1 AND l.instance_id = $2`,
      [policy.resourceOwner, instanceID]
    );

    return {
      idps: result.rows.map(row => ({
        idpID: row.idp_id,
        name: row.name,
        type: row.type,
      })),
    };
  }

  /**
   * Get second factors policy
   * 
   * @param resourceOwner - Resource owner ID
   * @param instanceID - Instance ID
   * @returns Second factors policy
   */
  async getSecondFactorsPolicy(
    resourceOwner: string,
    instanceID: string
  ): Promise<SecondFactorsPolicy> {
    const policy = await this.getActiveLoginPolicy(resourceOwner, instanceID);
    
    if (!policy) {
      return {
        secondFactors: [],
        multiFactors: [],
      };
    }

    return {
      secondFactors: policy.secondFactors,
      multiFactors: policy.multiFactors,
    };
  }

  /**
   * Get second factors for a specific policy
   */
  private async getSecondFactorsForPolicy(
    policyID: string,
    instanceID: string
  ): Promise<{ secondFactors: SecondFactorType[]; multiFactors: MultiFactorType[] }> {
    const result = await this.database.query(
      `SELECT factor_type, is_multi_factor
       FROM projections.login_policy_factors
       WHERE policy_id = $1 AND instance_id = $2`,
      [policyID, instanceID]
    );

    const secondFactors: SecondFactorType[] = [];
    const multiFactors: MultiFactorType[] = [];

    for (const row of result.rows) {
      if (row.is_multi_factor) {
        multiFactors.push(row.factor_type);
      } else {
        secondFactors.push(row.factor_type);
      }
    }

    return { secondFactors, multiFactors };
  }

  /**
   * Get IDP links for a specific policy
   */
  private async getIDPsForPolicy(policyID: string, instanceID: string): Promise<string[]> {
    const result = await this.database.query(
      `SELECT idp_id
       FROM projections.idp_login_policy_links
       WHERE resource_owner = (
         SELECT resource_owner FROM projections.login_policies 
         WHERE id = $1 AND instance_id = $2
       ) AND instance_id = $2`,
      [policyID, instanceID]
    );

    return result.rows.map(row => row.idp_id);
  }

  /**
   * Map database row to LoginPolicy
   */
  private mapRowToLoginPolicy(row: any): LoginPolicy {
    return {
      id: row.id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      allowUsernamePassword: row.allow_username_password ?? true,
      allowRegister: row.allow_register ?? true,
      allowExternalIDP: row.allow_external_idp ?? true,
      forceMFA: row.force_mfa ?? false,
      forceMFALocalOnly: row.force_mfa_local_only ?? false,
      passwordCheckLifetime: row.password_check_lifetime || 0,
      externalLoginCheckLifetime: row.external_login_check_lifetime || 0,
      mfaInitSkipLifetime: row.mfa_init_skip_lifetime || 0,
      secondFactorCheckLifetime: row.second_factor_check_lifetime || 0,
      multiFactorCheckLifetime: row.multi_factor_check_lifetime || 0,
      secondFactors: [],
      multiFactors: [],
      idps: [],
      allowDomainDiscovery: row.allow_domain_discovery ?? true,
      disableLoginWithEmail: row.disable_login_with_email ?? false,
      disableLoginWithPhone: row.disable_login_with_phone ?? false,
      ignoreUnknownUsernames: row.ignore_unknown_usernames ?? false,
      defaultRedirectURI: row.default_redirect_uri || '',
      isDefault: row.is_default ?? false,
      hidePasswordReset: row.hide_password_reset ?? false,
    };
  }
}
