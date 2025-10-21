/**
 * Feature Queries
 * Handles feature flag queries for instances and system
 * Based on Zitadel Go internal/query/instance_features.go and system_features.go
 */

import { DatabasePool } from '../../database';
import { InstanceFeatures, SystemFeatures } from './feature-types';

export class FeatureQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get instance features
   * Returns feature flags for a specific instance
   * 
   * @param instanceID - Instance ID
   * @returns Instance features with all flags
   */
  async getInstanceFeatures(instanceID: string): Promise<InstanceFeatures> {
    const query = `
      SELECT 
        instance_id,
        login_default_org,
        trigger_introspection_projections,
        legacy_introspection,
        user_schema,
        token_exchange,
        actions,
        improved_performance,
        web_key,
        debug_oidc_parent_error,
        oidc_legacy_introspection,
        oidc_trigger_introspection_projections,
        disable_user_token_event
      FROM projections.instance_features
      WHERE instance_id = $1
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID]);

    if (!result) {
      // Return default features (all false) if not configured
      return this.getDefaultInstanceFeatures(instanceID);
    }

    return this.mapToInstanceFeatures(result);
  }

  /**
   * Get system features
   * Returns global system-wide feature flags
   * 
   * @returns System features with all flags
   */
  async getSystemFeatures(): Promise<SystemFeatures> {
    const query = `
      SELECT 
        login_default_org,
        trigger_introspection_projections,
        legacy_introspection,
        user_schema,
        token_exchange,
        actions,
        improved_performance,
        web_key,
        debug_oidc_parent_error,
        oidc_legacy_introspection,
        oidc_trigger_introspection_projections,
        disable_user_token_event
      FROM projections.system_features
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, []);

    if (!result) {
      // Return default features (all false) if not configured
      return this.getDefaultSystemFeatures();
    }

    return this.mapToSystemFeatures(result);
  }

  /**
   * Check if a specific instance feature is enabled
   * 
   * @param instanceID - Instance ID
   * @param featureName - Feature name
   * @returns True if enabled, false otherwise
   */
  async isInstanceFeatureEnabled(
    instanceID: string,
    featureName: keyof Omit<InstanceFeatures, 'instanceID'>
  ): Promise<boolean> {
    const features = await this.getInstanceFeatures(instanceID);
    return features[featureName] || false;
  }

  /**
   * Get default instance features (all disabled)
   */
  private getDefaultInstanceFeatures(instanceID: string): InstanceFeatures {
    return {
      instanceID,
      loginDefaultOrg: false,
      triggerIntrospectionProjections: false,
      legacyIntrospection: false,
      userSchema: false,
      tokenExchange: false,
      actions: false,
      improveredPerformance: false,
      webKey: false,
      debugOIDCParentError: false,
      oidcLegacyIntrospection: false,
      oidcTriggerIntrospectionProjections: false,
      disableUserTokenEvent: false,
    };
  }

  /**
   * Get default system features (all disabled)
   */
  private getDefaultSystemFeatures(): SystemFeatures {
    return {
      loginDefaultOrg: false,
      triggerIntrospectionProjections: false,
      legacyIntrospection: false,
      userSchema: false,
      tokenExchange: false,
      actions: false,
      improveredPerformance: false,
      webKey: false,
      debugOIDCParentError: false,
      oidcLegacyIntrospection: false,
      oidcTriggerIntrospectionProjections: false,
      disableUserTokenEvent: false,
    };
  }

  /**
   * Map database result to InstanceFeatures
   */
  private mapToInstanceFeatures(row: any): InstanceFeatures {
    return {
      instanceID: row.instance_id,
      loginDefaultOrg: row.login_default_org || false,
      triggerIntrospectionProjections: row.trigger_introspection_projections || false,
      legacyIntrospection: row.legacy_introspection || false,
      userSchema: row.user_schema || false,
      tokenExchange: row.token_exchange || false,
      actions: row.actions || false,
      improveredPerformance: row.improved_performance || false,
      webKey: row.web_key || false,
      debugOIDCParentError: row.debug_oidc_parent_error || false,
      oidcLegacyIntrospection: row.oidc_legacy_introspection || false,
      oidcTriggerIntrospectionProjections: row.oidc_trigger_introspection_projections || false,
      disableUserTokenEvent: row.disable_user_token_event || false,
    };
  }

  /**
   * Map database result to SystemFeatures
   */
  private mapToSystemFeatures(row: any): SystemFeatures {
    return {
      loginDefaultOrg: row.login_default_org || false,
      triggerIntrospectionProjections: row.trigger_introspection_projections || false,
      legacyIntrospection: row.legacy_introspection || false,
      userSchema: row.user_schema || false,
      tokenExchange: row.token_exchange || false,
      actions: row.actions || false,
      improveredPerformance: row.improved_performance || false,
      webKey: row.web_key || false,
      debugOIDCParentError: row.debug_oidc_parent_error || false,
      oidcLegacyIntrospection: row.oidc_legacy_introspection || false,
      oidcTriggerIntrospectionProjections: row.oidc_trigger_introspection_projections || false,
      disableUserTokenEvent: row.disable_user_token_event || false,
    };
  }
}
