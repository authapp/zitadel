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

// Domain query modules
export * from './user';

// Projection framework
export { Projection } from './projection/projection';
export { ProjectionHandler } from './projection/projection-handler';
export { ProjectionRegistry } from './projection/projection-registry';
export { CurrentStateTracker } from './projection/current-state';
export { FailedEventHandler } from './projection/failed-events';
export { 
  applyProjectionDefaults,
  eventMatchesFilter 
} from './projection/projection-config';

// Search framework
export * from './search';

// Converters
export * from './converters';

// Helpers
export * from './helpers';

// Projection exports
export * from './projections/user-projection';

// Re-export commonly used types for convenience
export type {
  Query,
  QueryOptions,
  QueryResult,
  QueryBuilder,
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

// Re-export projection system types
export type {
  ProjectionConfig,
  ProjectionHandlerConfig,
  ProjectionFilter,
} from './projection/projection-config';

export type {
  ProjectionRegistryConfig,
  ProjectionHealth,
} from './projection/projection-registry';

export type {
  CurrentState,
} from './projection/current-state';

export type {
  FailedEvent,
} from './projection/failed-events';
