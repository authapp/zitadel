/**
 * Feature Types
 * Feature flags and settings for instances and system
 * Based on Zitadel Go internal/query/instance_features.go and system_features.go
 */

/**
 * Instance Features
 * Feature flags for a specific instance
 */
export interface InstanceFeatures {
  instanceID: string;
  loginDefaultOrg: boolean;
  triggerIntrospectionProjections: boolean;
  legacyIntrospection: boolean;
  userSchema: boolean;
  tokenExchange: boolean;
  actions: boolean;
  improveredPerformance: boolean;
  webKey: boolean;
  debugOIDCParentError: boolean;
  oidcLegacyIntrospection: boolean;
  oidcTriggerIntrospectionProjections: boolean;
  disableUserTokenEvent: boolean;
}

/**
 * System Features  
 * Global system-wide feature flags
 */
export interface SystemFeatures {
  loginDefaultOrg: boolean;
  triggerIntrospectionProjections: boolean;
  legacyIntrospection: boolean;
  userSchema: boolean;
  tokenExchange: boolean;
  actions: boolean;
  improveredPerformance: boolean;
  webKey: boolean;
  debugOIDCParentError: boolean;
  oidcLegacyIntrospection: boolean;
  oidcTriggerIntrospectionProjections: boolean;
  disableUserTokenEvent: boolean;
}
