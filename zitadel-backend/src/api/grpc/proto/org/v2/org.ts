/**
 * Organization Proto Definitions (v2)
 * 
 * TypeScript type definitions matching zitadel.org.v2 proto package
 * Based on: proto/zitadel/org/v2/org.proto
 */

import { Details } from '../../object/v2/object';

/**
 * Organization State
 */
export enum OrganizationState {
  ORGANIZATION_STATE_UNSPECIFIED = 0,
  ORGANIZATION_STATE_ACTIVE = 1,
  ORGANIZATION_STATE_INACTIVE = 2,
  ORGANIZATION_STATE_REMOVED = 3,
}

/**
 * Organization message
 */
export interface Organization {
  /** Unique identifier of the organization */
  id: string;
  
  /** Object details with metadata */
  details?: Details;
  
  /** Current state of the organization */
  state: OrganizationState;
  
  /** Name of the organization */
  name: string;
  
  /** Primary domain used in the organization */
  primaryDomain?: string;
}

/**
 * Organization field names for sorting/filtering
 */
export enum OrganizationFieldName {
  ORGANIZATION_FIELD_NAME_UNSPECIFIED = 0,
  ORGANIZATION_FIELD_NAME_NAME = 1,
  ORGANIZATION_FIELD_NAME_ID = 2,
  ORGANIZATION_FIELD_NAME_STATE = 3,
  ORGANIZATION_FIELD_NAME_PRIMARY_DOMAIN = 4,
}

/**
 * Search query for organizations
 */
export interface SearchQuery {
  /** Field name to search */
  field: OrganizationFieldName;
  
  /** Search value */
  value: string;
  
  /** Search method (equals, contains, starts_with, etc.) */
  method: SearchMethod;
}

/**
 * Search methods
 */
export enum SearchMethod {
  SEARCH_METHOD_UNSPECIFIED = 0,
  SEARCH_METHOD_EQUALS = 1,
  SEARCH_METHOD_CONTAINS = 2,
  SEARCH_METHOD_STARTS_WITH = 3,
  SEARCH_METHOD_ENDS_WITH = 4,
}
