/**
 * Eventstore module - Event sourcing implementation for Zitadel
 * 
 * This module provides event sourcing capabilities including:
 * - Event storage and retrieval
 * - Aggregate reconstruction
 * - Optimistic concurrency control
 * - Event filtering and searching
 * - Position-based event streaming
 */

export * from './types';
export { PostgresEventstore } from './postgres/eventstore';
export * from './unique-constraint';
export * from './subscription';
export * from './read-model';
export * from './query-builder';

// Re-export commonly used types for convenience
export type {
  Event,
  Command,
  Aggregate,
  EventFilter,
  SearchQuery,
  Position,
  Eventstore,
  EventstoreConfig,
  EventPusher,
  EventQuerier,
  EventSearcher,
  Reducer,
} from './types';

export {
  EventValidationError,
  ConcurrencyError,
} from './types';

export {
  UniqueConstraintAction,
  newAddEventUniqueConstraint,
  newRemoveUniqueConstraint,
  newAddGlobalUniqueConstraint,
  newRemoveGlobalUniqueConstraint,
  newRemoveInstanceUniqueConstraints,
  UniqueConstraintViolationError,
} from './unique-constraint';

export type { UniqueConstraint } from './unique-constraint';
