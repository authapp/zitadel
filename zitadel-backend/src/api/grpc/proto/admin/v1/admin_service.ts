/**
 * Admin Service Proto Types (v1)
 *
 * TypeScript equivalents for gRPC admin service types
 * Based on: proto/zitadel/admin.proto
 */

import { Details as ObjectDetails } from '../../object/v2/object';

// ============================================================================
// System & Health Types
// ============================================================================

export interface HealthzRequest {}

export interface HealthzResponse {}

export interface GetSupportedLanguagesRequest {}

export interface GetSupportedLanguagesResponse {
  languages: string[];
}

export interface GetAllowedLanguagesRequest {}

export interface GetAllowedLanguagesResponse {
  languages: string[];
}

export interface SetDefaultLanguageRequest {
  language: string;
}

export interface SetDefaultLanguageResponse {
  details: ObjectDetails;
}

export interface GetDefaultLanguageRequest {}

export interface GetDefaultLanguageResponse {
  language: string;
}

// ============================================================================
// Organization Types
// ============================================================================

export interface ListOrgsRequest {
  query?: {
    offset?: number;
    limit?: number;
    asc?: boolean;
  };
  queries?: OrgQuery[];
}

export interface ListOrgsResponse {
  details: {
    totalResult: number;
    processedSequence: number;
    timestamp: Date;
  };
  result: Org[];
}

export interface Org {
  id: string;
  details: ObjectDetails;
  state: OrgState;
  name: string;
  primaryDomain: string;
}

export enum OrgState {
  ORG_STATE_UNSPECIFIED = 0,
  ORG_STATE_ACTIVE = 1,
  ORG_STATE_INACTIVE = 2,
  ORG_STATE_REMOVED = 3,
}

export interface OrgQuery {
  // Placeholder for org query filters
  nameQuery?: {
    name: string;
    method: TextQueryMethod;
  };
  domainQuery?: {
    domain: string;
    method: TextQueryMethod;
  };
}

export enum TextQueryMethod {
  TEXT_QUERY_METHOD_EQUALS = 0,
  TEXT_QUERY_METHOD_EQUALS_IGNORE_CASE = 1,
  TEXT_QUERY_METHOD_STARTS_WITH = 2,
  TEXT_QUERY_METHOD_STARTS_WITH_IGNORE_CASE = 3,
  TEXT_QUERY_METHOD_CONTAINS = 4,
  TEXT_QUERY_METHOD_CONTAINS_IGNORE_CASE = 5,
  TEXT_QUERY_METHOD_ENDS_WITH = 6,
  TEXT_QUERY_METHOD_ENDS_WITH_IGNORE_CASE = 7,
}

export interface GetOrgByIDRequest {
  id: string;
}

export interface GetOrgByIDResponse {
  org: Org;
}

export interface IsOrgUniqueRequest {
  name: string;
  domain?: string;
}

export interface IsOrgUniqueResponse {
  isUnique: boolean;
}

export interface SetDefaultOrgRequest {
  orgId: string;
}

export interface SetDefaultOrgResponse {
  details: ObjectDetails;
}

export interface GetDefaultOrgRequest {}

export interface GetDefaultOrgResponse {
  org: Org;
}
