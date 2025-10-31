/**
 * Organization Service Proto Definitions (v2)
 * 
 * TypeScript type definitions for OrganizationService RPCs
 * Based on: proto/zitadel/org/v2/org_service.proto
 */

import { Details, ListQuery, ListDetails } from '../../object/v2/object';
import { Organization, OrganizationFieldName, SearchQuery } from './org';
import { AddHumanUserRequest } from '../../user/v2/user';

/**
 * AddOrganization Request
 */
export interface AddOrganizationRequest {
  /** Organization name (required, 1-200 chars) */
  name: string;
  
  /** List of admin users to create */
  admins: AddOrganizationRequest_Admin[];
  
  /** Optional custom organization ID */
  orgId?: string;
}

/**
 * Admin user for organization setup
 */
export interface AddOrganizationRequest_Admin {
  /** User type - either existing user ID or new human user */
  userType: {
    userId?: string;
    human?: AddHumanUserRequest;
  };
  
  /** Org member roles (default: ORG_OWNER if empty) */
  roles: string[];
}

/**
 * AddOrganization Response
 */
export interface AddOrganizationResponse {
  /** Object details with metadata */
  details?: Details;
  
  /** Created organization ID */
  organizationId: string;
  
  /** List of created admin users */
  createdAdmins: AddOrganizationResponse_CreatedAdmin[];
}

/**
 * Created admin details
 */
export interface AddOrganizationResponse_CreatedAdmin {
  /** User ID */
  userId: string;
  
  /** Email verification code (if applicable) */
  emailCode?: string;
  
  /** Phone verification code (if applicable) */
  phoneCode?: string;
}

/**
 * ListOrganizations Request
 */
export interface ListOrganizationsRequest {
  /** List query with pagination and ordering */
  query?: ListQuery;
  
  /** Field to sort by */
  sortingColumn?: OrganizationFieldName;
  
  /** Search criteria */
  queries: SearchQuery[];
}

/**
 * ListOrganizations Response
 */
export interface ListOrganizationsResponse {
  /** List details with pagination info */
  details?: ListDetails;
  
  /** Field sorted by */
  sortingColumn?: OrganizationFieldName;
  
  /** List of organizations */
  result: Organization[];
}

/**
 * GetOrganization Request
 */
export interface GetOrganizationRequest {
  /** Organization ID */
  organizationId: string;
}

/**
 * GetOrganization Response
 */
export interface GetOrganizationResponse {
  /** Organization details */
  organization?: Organization;
}

/**
 * UpdateOrganization Request
 */
export interface UpdateOrganizationRequest {
  /** Organization ID */
  organizationId: string;
  
  /** New organization name */
  name: string;
}

/**
 * UpdateOrganization Response
 */
export interface UpdateOrganizationResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * DeactivateOrganization Request
 */
export interface DeactivateOrganizationRequest {
  /** Organization ID */
  organizationId: string;
}

/**
 * DeactivateOrganization Response
 */
export interface DeactivateOrganizationResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * ReactivateOrganization Request
 */
export interface ReactivateOrganizationRequest {
  /** Organization ID */
  organizationId: string;
}

/**
 * ReactivateOrganization Response
 */
export interface ReactivateOrganizationResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * RemoveOrganization Request
 */
export interface RemoveOrganizationRequest {
  /** Organization ID */
  organizationId: string;
}

/**
 * RemoveOrganization Response
 */
export interface RemoveOrganizationResponse {
  /** Object details with metadata */
  details?: Details;
}

// ====================================================================
// DOMAIN MANAGEMENT
// ====================================================================

/**
 * AddOrganizationDomain Request
 */
export interface AddOrganizationDomainRequest {
  /** Organization ID */
  organizationId: string;
  
  /** Domain name (e.g., 'example.com') */
  domain: string;
}

/**
 * AddOrganizationDomain Response
 */
export interface AddOrganizationDomainResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * VerifyOrganizationDomain Request
 */
export interface VerifyOrganizationDomainRequest {
  /** Organization ID */
  organizationId: string;
  
  /** Domain name */
  domain: string;
  
  /** Verification code */
  validationCode: string;
}

/**
 * VerifyOrganizationDomain Response
 */
export interface VerifyOrganizationDomainResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * SetPrimaryOrganizationDomain Request
 */
export interface SetPrimaryOrganizationDomainRequest {
  /** Organization ID */
  organizationId: string;
  
  /** Domain name to set as primary */
  domain: string;
}

/**
 * SetPrimaryOrganizationDomain Response
 */
export interface SetPrimaryOrganizationDomainResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * RemoveOrganizationDomain Request
 */
export interface RemoveOrganizationDomainRequest {
  /** Organization ID */
  organizationId: string;
  
  /** Domain name to remove */
  domain: string;
}

/**
 * RemoveOrganizationDomain Response
 */
export interface RemoveOrganizationDomainResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * GenerateDomainValidation Request
 */
export interface GenerateDomainValidationRequest {
  /** Organization ID */
  organizationId: string;
  
  /** Domain name */
  domain: string;
  
  /** Validation type (e.g., DNS_TXT, HTTP) */
  type: string;
}

/**
 * GenerateDomainValidation Response
 */
export interface GenerateDomainValidationResponse {
  /** Validation token/code */
  validationToken: string;
  
  /** URL or DNS record for validation */
  validationUrl: string;
}

// ====================================================================
// MEMBER MANAGEMENT  
// ====================================================================

/**
 * AddOrganizationMember Request
 */
export interface AddOrganizationMemberRequest {
  /** Organization ID */
  organizationId: string;
  
  /** User ID to add as member */
  userId: string;
  
  /** Member roles (e.g., 'ORG_OWNER', 'ORG_USER_MANAGER') */
  roles: string[];
}

/**
 * AddOrganizationMember Response
 */
export interface AddOrganizationMemberResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * UpdateOrganizationMember Request
 */
export interface UpdateOrganizationMemberRequest {
  /** Organization ID */
  organizationId: string;
  
  /** User ID */
  userId: string;
  
  /** New member roles */
  roles: string[];
}

/**
 * UpdateOrganizationMember Response
 */
export interface UpdateOrganizationMemberResponse {
  /** Object details with metadata */
  details?: Details;
}

/**
 * RemoveOrganizationMember Request
 */
export interface RemoveOrganizationMemberRequest {
  /** Organization ID */
  organizationId: string;
  
  /** User ID to remove */
  userId: string;
}

/**
 * RemoveOrganizationMember Response
 */
export interface RemoveOrganizationMemberResponse {
  /** Object details with metadata */
  details?: Details;
}
