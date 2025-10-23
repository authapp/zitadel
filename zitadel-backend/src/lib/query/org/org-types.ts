/**
 * Organization Query Types
 * 
 * Type definitions for organization queries and projections.
 * Based on Zitadel Go internal/query/org.go
 */

/**
 * Organization state
 */
export enum OrgState {
  UNSPECIFIED = 'unspecified',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REMOVED = 'removed',
}

/**
 * Organization domain verification state
 */
export enum DomainVerificationState {
  UNSPECIFIED = 'unspecified',
  ADDED = 'added',
  VERIFIED = 'verified',
}

/**
 * Organization read model
 */
export interface Organization {
  id: string;
  instanceID?: string; // Multi-tenant instance identifier
  name: string;
  state: OrgState;
  primaryDomain?: string;
  createdAt: Date;
  updatedAt: Date;
  sequence: number;
}

/**
 * Organization domain read model
 */
export interface OrganizationDomain {
  instanceID?: string; // Multi-tenant instance identifier
  orgID: string;
  domain: string;
  isVerified: boolean;
  isPrimary: boolean;
  validationType: string;
  validationCode?: string;
  createdAt: Date;
  updatedAt: Date;
  sequence: number;
}

/**
 * Organization with domains
 */
export interface OrganizationWithDomains extends Organization {
  domains: OrganizationDomain[];
}

/**
 * Organization search query
 */
export interface OrgSearchQuery {
  instanceID?: string; // Filter by instance
  name?: string;
  domain?: string;
  state?: OrgState;
  limit?: number;
  offset?: number;
}

/**
 * Organization domain search query
 */
export interface OrgDomainSearchQuery {
  instanceID?: string; // Filter by instance
  orgID?: string;
  domain?: string;
  isVerified?: boolean;
  isPrimary?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Organization search result
 */
export interface OrgSearchResult {
  orgs: Organization[];
  total: number;
}

/**
 * Organization domain search result
 */
export interface OrgDomainSearchResult {
  domains: OrganizationDomain[];
  total: number;
}
