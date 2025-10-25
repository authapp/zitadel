/**
 * Login Policy Projection - materializes login policy events
 * Manages authentication policies including MFA, password complexity, and lockout rules
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class LoginPolicyProjection extends Projection {
  readonly name = 'login_policy_projection';
  readonly tables = ['login_policies', 'login_policy_factors'];

  async init(): Promise<void> {
    // Create login_policies table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.login_policies (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        allow_username_password BOOLEAN DEFAULT true,
        allow_register BOOLEAN DEFAULT true,
        allow_external_idp BOOLEAN DEFAULT true,
        force_mfa BOOLEAN DEFAULT false,
        force_mfa_local_only BOOLEAN DEFAULT false,
        password_check_lifetime BIGINT DEFAULT 0,
        external_login_check_lifetime BIGINT DEFAULT 0,
        mfa_init_skip_lifetime BIGINT DEFAULT 0,
        second_factor_check_lifetime BIGINT DEFAULT 0,
        multi_factor_check_lifetime BIGINT DEFAULT 0,
        allow_domain_discovery BOOLEAN DEFAULT true,
        disable_login_with_email BOOLEAN DEFAULT false,
        disable_login_with_phone BOOLEAN DEFAULT false,
        ignore_unknown_usernames BOOLEAN DEFAULT false,
        default_redirect_uri TEXT DEFAULT '',
        is_default BOOLEAN DEFAULT false,
        hide_password_reset BOOLEAN DEFAULT false,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create login_policy_factors table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.login_policy_factors (
        policy_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        factor_type INTEGER NOT NULL,
        is_multi_factor BOOLEAN NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (instance_id, policy_id, factor_type, is_multi_factor)
      )`,
      []
    );

    // Create indexes
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_login_policies_resource_owner 
       ON projections.login_policies(resource_owner, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_login_policies_is_default 
       ON projections.login_policies(is_default, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_login_policy_factors_policy_id 
       ON projections.login_policy_factors(policy_id, instance_id)`,
      []
    );
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'org.login.policy.added':
      case 'instance.login.policy.added':
        await this.handleLoginPolicyAdded(event);
        break;

      case 'org.login.policy.changed':
      case 'instance.login.policy.changed':
        await this.handleLoginPolicyChanged(event);
        break;

      case 'org.login.policy.removed':
        await this.handleLoginPolicyRemoved(event);
        break;

      case 'org.login.policy.second.factor.added':
      case 'instance.login.policy.second.factor.added':
        await this.handleSecondFactorAdded(event, false);
        break;

      case 'org.login.policy.second.factor.removed':
      case 'instance.login.policy.second.factor.removed':
        await this.handleSecondFactorRemoved(event, false);
        break;

      case 'org.login.policy.multi.factor.added':
      case 'instance.login.policy.multi.factor.added':
        await this.handleSecondFactorAdded(event, true);
        break;

      case 'org.login.policy.multi.factor.removed':
      case 'instance.login.policy.multi.factor.removed':
        await this.handleSecondFactorRemoved(event, true);
        break;

      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;

      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;

      default:
        // Unknown event type, ignore
        break;
    }
  }

  /**
   * Handle login policy added event
   */
  private async handleLoginPolicyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    // Determine if this is a default policy
    const isDefault = event.eventType.includes('instance.login.policy');
    
    // Policy ID is typically the resource owner (org or instance)
    const policyID = payload.policyID || event.aggregateID || event.owner;

    await this.query(
      `INSERT INTO projections.login_policies (
        id, instance_id, creation_date, change_date, sequence, resource_owner,
        allow_username_password, allow_register, allow_external_idp,
        force_mfa, force_mfa_local_only,
        password_check_lifetime, external_login_check_lifetime,
        mfa_init_skip_lifetime, second_factor_check_lifetime, multi_factor_check_lifetime,
        allow_domain_discovery, disable_login_with_email, disable_login_with_phone,
        ignore_unknown_usernames, default_redirect_uri, is_default, hide_password_reset
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        policyID,
        event.instanceID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.allowUsernamePassword !== false,
        payload.allowRegister !== false,
        payload.allowExternalIDP !== false,
        payload.forceMFA || false,
        payload.forceMFALocalOnly || false,
        payload.passwordCheckLifetime || 0,
        payload.externalLoginCheckLifetime || 0,
        payload.mfaInitSkipLifetime || 0,
        payload.secondFactorCheckLifetime || 0,
        payload.multiFactorCheckLifetime || 0,
        payload.allowDomainDiscovery !== false,
        payload.disableLoginWithEmail || false,
        payload.disableLoginWithPhone || false,
        payload.ignoreUnknownUsernames || false,
        payload.defaultRedirectURI || '',
        isDefault,
        payload.hidePasswordReset || false,
      ]
    );
  }

  /**
   * Handle login policy changed event
   */
  private async handleLoginPolicyChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = payload.policyID || event.aggregateID || event.owner;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (payload.allowUsernamePassword !== undefined) {
      updates.push(`allow_username_password = $${paramIndex++}`);
      values.push(payload.allowUsernamePassword);
    }

    if (payload.allowRegister !== undefined) {
      updates.push(`allow_register = $${paramIndex++}`);
      values.push(payload.allowRegister);
    }

    if (payload.allowExternalIDP !== undefined) {
      updates.push(`allow_external_idp = $${paramIndex++}`);
      values.push(payload.allowExternalIDP);
    }

    if (payload.forceMFA !== undefined) {
      updates.push(`force_mfa = $${paramIndex++}`);
      values.push(payload.forceMFA);
    }

    if (payload.forceMFALocalOnly !== undefined) {
      updates.push(`force_mfa_local_only = $${paramIndex++}`);
      values.push(payload.forceMFALocalOnly);
    }

    if (payload.passwordCheckLifetime !== undefined) {
      updates.push(`password_check_lifetime = $${paramIndex++}`);
      values.push(payload.passwordCheckLifetime);
    }

    if (payload.hidePasswordReset !== undefined) {
      updates.push(`hide_password_reset = $${paramIndex++}`);
      values.push(payload.hidePasswordReset);
    }

    // Always update these
    updates.push(`change_date = $${paramIndex++}`);
    values.push(event.createdAt);

    updates.push(`sequence = $${paramIndex++}`);
    values.push(Number(event.aggregateVersion || 1n));

    values.push(policyID);
    values.push(event.instanceID);

    if (updates.length > 0) {
      await this.query(
        `UPDATE projections.login_policies
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND instance_id = $${paramIndex++}`,
        values
      );
    }
  }

  /**
   * Handle login policy removed event
   */
  private async handleLoginPolicyRemoved(event: Event): Promise<void> {
    const policyID = event.aggregateID || event.owner;

    // Remove policy
    await this.query(
      `DELETE FROM projections.login_policies 
       WHERE id = $1 AND instance_id = $2`,
      [policyID, event.instanceID]
    );

    // Remove associated factors
    await this.query(
      `DELETE FROM projections.login_policy_factors 
       WHERE policy_id = $1 AND instance_id = $2`,
      [policyID, event.instanceID]
    );
  }

  /**
   * Handle second/multi factor added event
   */
  private async handleSecondFactorAdded(event: Event, isMultiFactor: boolean): Promise<void> {
    const payload = event.payload || {};
    
    if (payload.factorType === undefined && payload.mfaType === undefined) {
      console.error('Missing factor type in login policy factor added event:', event);
      return;
    }

    const factorType = payload.factorType || payload.mfaType || 0;
    const policyID = event.aggregateID || event.owner;

    await this.query(
      `INSERT INTO projections.login_policy_factors (
        policy_id, instance_id, factor_type, is_multi_factor, creation_date
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (instance_id, policy_id, factor_type, is_multi_factor) DO NOTHING`,
      [
        policyID,
        event.instanceID,
        factorType,
        isMultiFactor,
        event.createdAt,
      ]
    );
  }

  /**
   * Handle second/multi factor removed event
   */
  private async handleSecondFactorRemoved(event: Event, isMultiFactor: boolean): Promise<void> {
    const payload = event.payload || {};
    
    if (payload.factorType === undefined && payload.mfaType === undefined) {
      console.error('Missing factor type in login policy factor removed event:', event);
      return;
    }

    const factorType = payload.factorType || payload.mfaType || 0;
    const policyID = event.aggregateID || event.owner;

    await this.query(
      `DELETE FROM projections.login_policy_factors 
       WHERE policy_id = $1 AND instance_id = $2 
       AND factor_type = $3 AND is_multi_factor = $4`,
      [policyID, event.instanceID, factorType, isMultiFactor]
    );
  }

  /**
   * Handle org removed event
   */
  private async handleOrgRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.login_policies 
       WHERE resource_owner = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );

    await this.query(
      `DELETE FROM projections.login_policy_factors 
       WHERE policy_id = $1 AND instance_id = $2`,
      [event.aggregateID, event.instanceID]
    );
  }

  /**
   * Handle instance removed event
   */
  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.login_policies WHERE instance_id = $1`,
      [event.instanceID]
    );

    await this.query(
      `DELETE FROM projections.login_policy_factors WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create login policy projection configuration
 */
export function createLoginPolicyProjectionConfig() {
  return {
    name: 'login_policy_projection',
    tables: ['login_policies', 'login_policy_factors'],
    eventTypes: [
      'org.login.policy.added',
      'org.login.policy.changed',
      'org.login.policy.removed',
      'instance.login.policy.added',
      'instance.login.policy.changed',
      'org.login.policy.second.factor.added',
      'org.login.policy.second.factor.removed',
      'instance.login.policy.second.factor.added',
      'instance.login.policy.second.factor.removed',
      'org.login.policy.multi.factor.added',
      'org.login.policy.multi.factor.removed',
      'instance.login.policy.multi.factor.added',
      'instance.login.policy.multi.factor.removed',
      'org.removed',
      'instance.removed',
    ],
    aggregateTypes: ['org', 'instance'],
    interval: 1000,
    enableLocking: false,
  };
}
