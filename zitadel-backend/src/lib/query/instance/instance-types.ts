/**
 * Instance domain types for Zitadel query layer
 * Instances represent multi-tenant isolation boundaries
 */

/**
 * Instance state
 */
export enum InstanceState {
  UNSPECIFIED = 'unspecified',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REMOVED = 'removed',
}

/**
 * Instance domain represents a custom domain for an instance
 */
export interface InstanceDomain {
  instanceID: string;
  domain: string;
  isPrimary: boolean;
  isGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
  sequence: number;
}

/**
 * Instance feature flags
 */
export interface InstanceFeatures {
  loginDefaultOrg?: boolean;
  triggerIntrospectionProjections?: boolean;
  legacyIntrospection?: boolean;
  userSchema?: boolean;
  tokenExchange?: boolean;
  actions?: boolean;
  improvedPerformance?: string[]; // List of performance improvements enabled
}

/**
 * Instance trusted domain (for CORS, redirects, etc.)
 */
export interface InstanceTrustedDomain {
  instanceID: string;
  domain: string;
  createdAt: Date;
  sequence: number;
}

/**
 * Complete instance information
 */
export interface Instance {
  id: string;
  name: string;
  defaultOrgID?: string;
  defaultLanguage?: string;
  state: InstanceState;
  
  // Domains
  domains: InstanceDomain[];
  primaryDomain?: string;
  
  // Features
  features?: InstanceFeatures;
  
  // Trusted domains for CORS/redirects
  trustedDomains?: InstanceTrustedDomain[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  sequence: number;
}

/**
 * Instance search query
 */
export interface InstanceSearchQuery {
  instanceIDs?: string[];
  name?: string;
  state?: InstanceState;
  hasDefaultOrg?: boolean;
  
  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Instance search result
 */
export interface InstanceSearchResult {
  instances: Instance[];
  total: number;
}

/**
 * Instance domain search query
 */
export interface InstanceDomainSearchQuery {
  instanceID?: string;
  domain?: string;
  isPrimary?: boolean;
  isGenerated?: boolean;
  
  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Instance domain search result
 */
export interface InstanceDomainSearchResult {
  domains: InstanceDomain[];
  total: number;
}

/**
 * Instance trusted domain search query
 */
export interface InstanceTrustedDomainSearchQuery {
  instanceID?: string;
  domain?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Instance trusted domain search result
 */
export interface InstanceTrustedDomainSearchResult {
  domains: InstanceTrustedDomain[];
  total: number;
}
