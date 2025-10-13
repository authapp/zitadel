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

// Core exports
export * from './queries';
export * from './types';
export * from './factory';

// Projection framework
export * from './projection';

// Search framework
export * from './search';

// Converters
export * from './converters';

// Helpers
export * from './helpers';

// Legacy postgres exports
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
