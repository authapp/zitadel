/**
 * Instance Service Proto Types (v2)
 * 
 * TypeScript equivalents for gRPC instance service types
 * Based on: proto/zitadel/instance/v2/instance_service.proto
 */

import { Details as ObjectDetails, ListQuery, ListDetails } from '../../object/v2/object';

// ============================================================================
// Instance CRUD Types
// ============================================================================

export interface GetInstanceRequest {
  instanceId: string;
}

export interface GetInstanceResponse {
  instance: Instance;
}

export interface ListInstancesRequest {
  query?: ListQuery;
  sortingColumn?: string;
  queries?: InstanceQuery[];
}

export interface ListInstancesResponse {
  details: ListDetails;
  sortingColumn?: string;
  result: Instance[];
}

export interface Instance {
  id: string;
  details: ObjectDetails;
  state: InstanceState;
  name: string;
  version: string;
  domains: InstanceDomain[];
}

export enum InstanceState {
  STATE_UNSPECIFIED = 0,
  STATE_CREATING = 1,
  STATE_RUNNING = 2,
  STATE_STOPPING = 3,
  STATE_STOPPED = 4,
}

export interface InstanceQuery {
  // Add specific query types as needed
}

// ============================================================================
// Instance Domain Types
// ============================================================================

export interface AddInstanceDomainRequest {
  instanceId: string;
  domain: string;
  isGenerated?: boolean;
}

export interface AddInstanceDomainResponse {
  details: ObjectDetails;
}

export interface SetDefaultInstanceDomainRequest {
  instanceId: string;
  domain: string;
}

export interface SetDefaultInstanceDomainResponse {
  details: ObjectDetails;
}

export interface RemoveInstanceDomainRequest {
  instanceId: string;
  domain: string;
}

export interface RemoveInstanceDomainResponse {
  details: ObjectDetails;
}

export interface ListInstanceDomainsRequest {
  instanceId: string;
  query?: ListQuery;
}

export interface ListInstanceDomainsResponse {
  details: ListDetails;
  result: InstanceDomain[];
}

export interface InstanceDomain {
  domain: string;
  details: ObjectDetails;
  isGenerated: boolean;
  isPrimary: boolean;
}

// ============================================================================
// Instance Features Types
// ============================================================================

export interface SetInstanceFeaturesRequest {
  instanceId: string;
  loginDefaultOrg?: boolean;
  triggerIntrospectionProjections?: boolean;
  legacyIntrospection?: boolean;
  userSchema?: boolean;
  tokenExchange?: boolean;
  actions?: boolean;
  improvedPerformance?: boolean;
}

export interface SetInstanceFeaturesResponse {
  details: ObjectDetails;
}

export interface GetInstanceFeaturesRequest {
  instanceId: string;
}

export interface GetInstanceFeaturesResponse {
  features: InstanceFeatures;
}

export interface ResetInstanceFeaturesRequest {
  instanceId: string;
}

export interface ResetInstanceFeaturesResponse {
  details: ObjectDetails;
}

export interface InstanceFeatures {
  loginDefaultOrg: boolean;
  triggerIntrospectionProjections: boolean;
  legacyIntrospection: boolean;
  userSchema: boolean;
  tokenExchange: boolean;
  actions: boolean;
  improvedPerformance: boolean;
}

// ============================================================================
// Instance Member Types
// ============================================================================

export interface AddInstanceMemberRequest {
  instanceId: string;
  userId: string;
  roles: string[];
}

export interface AddInstanceMemberResponse {
  details: ObjectDetails;
}

export interface UpdateInstanceMemberRequest {
  instanceId: string;
  userId: string;
  roles: string[];
}

export interface UpdateInstanceMemberResponse {
  details: ObjectDetails;
}

export interface RemoveInstanceMemberRequest {
  instanceId: string;
  userId: string;
}

export interface RemoveInstanceMemberResponse {
  details: ObjectDetails;
}

export interface ListInstanceMembersRequest {
  instanceId: string;
  query?: ListQuery;
  queries?: MemberQuery[];
}

export interface ListInstanceMembersResponse {
  details: ListDetails;
  result: Member[];
}

export interface Member {
  userId: string;
  details: ObjectDetails;
  roles: string[];
  displayName: string;
  email: string;
}

export interface MemberQuery {
  // Add specific query types as needed
}

// ============================================================================
// Instance Setup/Removal Types
// ============================================================================

export interface SetupInstanceRequest {
  instanceName: string;
  defaultOrgName: string;
  adminUser: AdminUser;
  customDomain?: string;
  defaultLanguage?: string;
}

export interface SetupInstanceResponse {
  instanceId: string;
  orgId: string;
  userId: string;
  details: ObjectDetails;
}

export interface AdminUser {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
}

export interface RemoveInstanceRequest {
  instanceId: string;
}

export interface RemoveInstanceResponse {
  details: ObjectDetails;
}
