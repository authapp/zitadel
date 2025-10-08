/**
 * Query module - CQRS Read-side implementation for Zitadel
 * 
 * This module provides query capabilities including:
 * - Reading from materialized projections
 * - Complex filtering and sorting
 * - Pagination support
 * - Projection management
 * - Event-to-projection materialization
 */

export * from './types';
export * from './factory';
export * from './filter';
export * from './postgres/query';
export * from './postgres/projection-manager';
export * from './projections/user-projection';

export { PostgresQuery, createPostgresQuery } from './postgres/query';
export { PostgresProjectionManager } from './postgres/projection-manager';

// Re-export commonly used types for convenience
export type {
  Query,
  QueryOptions,
  QueryResult,
  QueryBuilder,
  ProjectionManager,
  ProjectionConfig,
  ProjectionState,
  ProjectionHandler,
  FilterCondition,
  FilterGroup,
  FilterOperator,
  LogicalOperator,
  Pagination,
  Sorting,
} from './types';

export {
  QueryError,
  ProjectionError,
  FilterError,
  ProjectionStatus,
} from './types';
