/**
 * Shared entity type definitions
 */

// Base entity with common fields
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// Entity with audit information
export interface AuditedEntity extends BaseEntity {
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
}

// Entity with organization ownership
export interface OrgOwnedEntity extends AuditedEntity {
  organizationId: string;
}

// Entity states
export enum EntityState {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DELETED = 'deleted',
  LOCKED = 'locked',
  SUSPENDED = 'suspended',
}

// Pagination
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Search and filters
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, any>;
}

// Timestamps
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// Object details (Zitadel format)
export interface ObjectDetails {
  sequence: string;
  creationDate: string;
  changeDate: string;
  resourceOwner: string;
}
