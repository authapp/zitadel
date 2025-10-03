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
} from './types';

export {
  EventValidationError,
  ConcurrencyError,
} from './types';
