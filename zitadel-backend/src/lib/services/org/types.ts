/**
 * Organization service types
 */

import { Organization } from '../../domain/organization';
import { AuthContext } from '../../authz/types';

/**
 * Create organization request
 */
export interface CreateOrgRequest {
  name: string;
  domain?: string;
  metadata?: Record<string, any>;
}

/**
 * Update organization request
 */
export interface UpdateOrgRequest {
  name?: string;
  domain?: string;
  metadata?: Record<string, any>;
}

/**
 * Add member request
 */
export interface AddMemberRequest {
  userId: string;
  roles: string[];
}

/**
 * Organization search filters
 */
export interface OrgSearchFilters {
  name?: string;
  domain?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Organization list options
 */
export interface OrgListOptions {
  filters?: OrgSearchFilters;
  limit?: number;
  offset?: number;
}

/**
 * Organization service interface
 */
export interface OrgService {
  /**
   * Create new organization
   */
  create(context: AuthContext, request: CreateOrgRequest): Promise<Organization>;

  /**
   * Get organization by ID
   */
  getById(context: AuthContext, orgId: string): Promise<Organization | null>;

  /**
   * Get organization by domain
   */
  getByDomain(context: AuthContext, domain: string): Promise<Organization | null>;

  /**
   * List organizations
   */
  list(context: AuthContext, options?: OrgListOptions): Promise<Organization[]>;

  /**
   * Update organization
   */
  update(context: AuthContext, orgId: string, request: UpdateOrgRequest): Promise<Organization>;

  /**
   * Delete organization
   */
  delete(context: AuthContext, orgId: string): Promise<void>;

  /**
   * Add member to organization
   */
  addMember(context: AuthContext, orgId: string, request: AddMemberRequest): Promise<void>;

  /**
   * Remove member from organization
   */
  removeMember(context: AuthContext, orgId: string, userId: string): Promise<void>;

  /**
   * List organization members
   */
  listMembers(context: AuthContext, orgId: string): Promise<any[]>;
}

/**
 * Organization service errors
 */
export class OrgServiceError extends Error {
  constructor(message: string, public code: string = 'ORG_SERVICE_ERROR') {
    super(message);
    this.name = 'OrgServiceError';
  }
}

export class OrgNotFoundError extends OrgServiceError {
  constructor(orgId: string) {
    super(`Organization not found: ${orgId}`, 'ORG_NOT_FOUND');
    this.name = 'OrgNotFoundError';
  }
}

export class OrgAlreadyExistsError extends OrgServiceError {
  constructor(identifier: string) {
    super(`Organization already exists: ${identifier}`, 'ORG_ALREADY_EXISTS');
    this.name = 'OrgAlreadyExistsError';
  }
}
