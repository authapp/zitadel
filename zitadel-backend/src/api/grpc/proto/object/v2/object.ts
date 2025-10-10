/**
 * Object Proto Definitions (v2)
 * 
 * Common object types used across all services
 * Based on: proto/zitadel/object/v2/object.proto
 */

/**
 * Details of an object (metadata)
 */
export interface Details {
  /** Sequence number of the last event */
  sequence: number;
  
  /** Timestamp of the last change */
  changeDate?: Date;
  
  /** Resource owner (organization ID) */
  resourceOwner: string;
}

/**
 * List query for pagination and ordering
 */
export interface ListQuery {
  /** Offset for pagination */
  offset?: number;
  
  /** Limit of results */
  limit?: number;
  
  /** Ascending order */
  asc?: boolean;
}

/**
 * List details with pagination info
 */
export interface ListDetails {
  /** Total count of results */
  totalResult: number;
  
  /** Count of results in current page */
  processedSequence: number;
  
  /** Timestamp of the query */
  timestamp?: Date;
}

/**
 * Text query methods
 */
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

/**
 * Timestamp query methods
 */
export enum TimestampQueryMethod {
  TIMESTAMP_QUERY_METHOD_EQUALS = 0,
  TIMESTAMP_QUERY_METHOD_GREATER = 1,
  TIMESTAMP_QUERY_METHOD_GREATER_OR_EQUALS = 2,
  TIMESTAMP_QUERY_METHOD_LESS = 3,
  TIMESTAMP_QUERY_METHOD_LESS_OR_EQUALS = 4,
}
