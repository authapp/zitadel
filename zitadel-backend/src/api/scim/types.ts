/**
 * SCIM 2.0 Type Definitions
 * RFC 7643 - SCIM Core Schema
 * RFC 7644 - SCIM Protocol
 */

// ============================================================================
// Core SCIM Types
// ============================================================================

export interface SCIMResource {
  schemas: string[];
  id: string;
  externalId?: string;
  meta: SCIMMeta;
}

export interface SCIMMeta {
  resourceType: string;
  created?: string;
  lastModified?: string;
  location?: string;
  version?: string;
}

// ============================================================================
// SCIM User (RFC 7643 Section 4.1)
// ============================================================================

export interface SCIMUser extends SCIMResource {
  userName: string;
  name?: SCIMName;
  displayName?: string;
  nickName?: string;
  profileUrl?: string;
  title?: string;
  userType?: string;
  preferredLanguage?: string;
  locale?: string;
  timezone?: string;
  active?: boolean;
  password?: string;
  emails?: SCIMEmail[];
  phoneNumbers?: SCIMPhoneNumber[];
  ims?: SCIMIms[];
  photos?: SCIMPhoto[];
  addresses?: SCIMAddress[];
  groups?: SCIMGroupMembership[];
  entitlements?: SCIMEntitlement[];
  roles?: SCIMRole[];
  x509Certificates?: SCIMX509Certificate[];
  // Enterprise User Extension
  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'?: SCIMEnterpriseUser;
}

export interface SCIMName {
  formatted?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
}

export interface SCIMEmail {
  value: string;
  display?: string;
  type?: string; // work, home, other
  primary?: boolean;
}

export interface SCIMPhoneNumber {
  value: string;
  display?: string;
  type?: string; // work, home, mobile, fax, pager, other
  primary?: boolean;
}

export interface SCIMIms {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMPhoto {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMAddress {
  formatted?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type?: string; // work, home, other
  primary?: boolean;
}

export interface SCIMGroupMembership {
  value: string;
  $ref?: string;
  display?: string;
  type?: string;
}

export interface SCIMEntitlement {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMRole {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMX509Certificate {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

// ============================================================================
// Enterprise User Extension (RFC 7643 Section 4.3)
// ============================================================================

export interface SCIMEnterpriseUser {
  employeeNumber?: string;
  costCenter?: string;
  organization?: string;
  division?: string;
  department?: string;
  manager?: SCIMManager;
}

export interface SCIMManager {
  value: string;
  $ref?: string;
  displayName?: string;
}

// ============================================================================
// SCIM Group (RFC 7643 Section 4.2)
// ============================================================================

export interface SCIMGroup extends SCIMResource {
  displayName: string;
  members?: SCIMMember[];
}

export interface SCIMMember {
  value: string;
  $ref?: string;
  display?: string;
  type?: string; // User, Group
}

// ============================================================================
// SCIM List Response (RFC 7644 Section 3.4.2)
// ============================================================================

export interface SCIMListResponse<T extends SCIMResource> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

// ============================================================================
// SCIM Error Response (RFC 7644 Section 3.12)
// ============================================================================

export interface SCIMError {
  schemas: string[];
  scimType?: string;
  detail?: string;
  status: number;
}

// ============================================================================
// SCIM Patch Operation (RFC 7644 Section 3.5.2)
// ============================================================================

export interface SCIMPatchOp {
  schemas: string[];
  Operations: SCIMOperation[];
}

export interface SCIMOperation {
  op: 'add' | 'remove' | 'replace';
  path?: string;
  value?: any;
}

// ============================================================================
// SCIM Schemas (RFC 7643 Section 7)
// ============================================================================

export interface SCIMSchema {
  id: string;
  name: string;
  description: string;
  attributes: SCIMAttribute[];
}

export interface SCIMAttribute {
  name: string;
  type: string;
  multiValued: boolean;
  description: string;
  required: boolean;
  caseExact: boolean;
  mutability: string;
  returned: string;
  uniqueness: string;
  subAttributes?: SCIMAttribute[];
}

// ============================================================================
// Service Provider Configuration (RFC 7643 Section 5)
// ============================================================================

export interface SCIMServiceProviderConfig {
  schemas: string[];
  documentationUri?: string;
  patch: SCIMSupported;
  bulk: SCIMBulk;
  filter: SCIMFilter;
  changePassword: SCIMSupported;
  sort: SCIMSupported;
  etag: SCIMSupported;
  authenticationSchemes: SCIMAuthenticationScheme[];
}

export interface SCIMSupported {
  supported: boolean;
}

export interface SCIMBulk extends SCIMSupported {
  maxOperations?: number;
  maxPayloadSize?: number;
}

export interface SCIMFilter extends SCIMSupported {
  maxResults?: number;
}

export interface SCIMAuthenticationScheme {
  type: string;
  name: string;
  description: string;
  specUri?: string;
  documentationUri?: string;
  primary?: boolean;
}

// ============================================================================
// Resource Types (RFC 7643 Section 6)
// ============================================================================

export interface SCIMResourceType {
  schemas: string[];
  id: string;
  name: string;
  endpoint: string;
  description: string;
  schema: string;
  schemaExtensions?: SCIMSchemaExtension[];
}

export interface SCIMSchemaExtension {
  schema: string;
  required: boolean;
}

// ============================================================================
// SCIM URNs (Constants)
// ============================================================================

export const SCIM_SCHEMAS = {
  CORE_USER: 'urn:ietf:params:scim:schemas:core:2.0:User',
  CORE_GROUP: 'urn:ietf:params:scim:schemas:core:2.0:Group',
  ENTERPRISE_USER: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
  LIST_RESPONSE: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
  PATCH_OP: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
  ERROR: 'urn:ietf:params:scim:api:messages:2.0:Error',
  SERVICE_PROVIDER_CONFIG: 'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig',
  RESOURCE_TYPE: 'urn:ietf:params:scim:schemas:core:2.0:ResourceType',
  SCHEMA: 'urn:ietf:params:scim:schemas:core:2.0:Schema',
} as const;

// ============================================================================
// SCIM Filter Parsing Types
// ============================================================================

export interface SCIMFilterExpression {
  attributePath: string;
  operator: SCIMFilterOperator;
  compareValue?: any;
}

export type SCIMFilterOperator =
  | 'eq'  // equal
  | 'ne'  // not equal
  | 'co'  // contains
  | 'sw'  // starts with
  | 'ew'  // ends with
  | 'pr'  // present (has value)
  | 'gt'  // greater than
  | 'ge'  // greater than or equal
  | 'lt'  // less than
  | 'le'; // less than or equal

export interface SCIMFilterQuery {
  filter?: string;
  sortBy?: string;
  sortOrder?: 'ascending' | 'descending';
  startIndex?: number;
  count?: number;
  attributes?: string[];
  excludedAttributes?: string[];
}
