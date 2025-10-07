/**
 * Event sourcing types and interfaces for Zitadel eventstore
 */

/**
 * Position represents a position in the event stream
 * Position is a timestamp-based decimal value
 * inTxOrder handles ordering within the same position
 */
export interface Position {
  position: number; // DECIMAL - timestamp from EXTRACT(EPOCH FROM clock_timestamp())
  inTxOrder: number; // Order within transaction
}

/**
 * Event represents a single event in the event stream (matching Go v2 schema)
 */
export interface Event {
  instanceID: string;
  aggregateType: string;
  aggregateID: string;
  eventType: string;
  aggregateVersion: bigint; // Sequence number of event in aggregate
  revision: number; // Schema revision (SMALLINT)
  createdAt: Date;
  payload: Record<string, any> | null;
  creator: string; // User or service that created the event
  owner: string; // Resource owner
  position: Position;
}

/**
 * Command represents a command to be executed (matching Go v2 schema)
 */
export interface Command {
  instanceID: string;
  aggregateType: string;
  aggregateID: string;
  eventType: string;
  payload: Record<string, any> | null;
  creator: string; // User or service creating the event
  owner: string; // Resource owner
  revision?: number; // Default to 1 if not specified
  uniqueConstraints?: import('./unique-constraint').UniqueConstraint[]; // Unique constraints to enforce
}

/**
 * Aggregate represents the current state of an aggregate (matching Go v2 schema)
 */
export interface Aggregate {
  id: string;
  type: string;
  owner: string; // Resource owner
  instanceID: string;
  version: bigint; // Current aggregate_version
  events: Event[];
  position: Position;
}

/**
 * Event filter for querying events (matching Go v2 schema)
 */
export interface EventFilter {
  instanceID?: string;
  aggregateTypes?: string[];
  aggregateIDs?: string[];
  eventTypes?: string[];
  owner?: string; // Resource owner
  creator?: string; // Event creator
  createdAtFrom?: Date;
  createdAtTo?: Date;
  position?: Position;
  limit?: number;
  desc?: boolean;
}

/**
 * Search query for events
 */
export interface SearchQuery {
  filters: EventFilter[];
  limit?: number;
  desc?: boolean;
}

/**
 * Event pusher interface for writing events
 */
export interface EventPusher {
  /**
   * Push a single command as event
   */
  push(command: Command): Promise<Event>;

  /**
   * Push multiple commands as events in a transaction
   */
  pushMany(commands: Command[]): Promise<Event[]>;

  /**
   * Push events with optimistic concurrency control
   */
  pushWithConcurrencyCheck(
    commands: Command[],
    expectedVersion: number
  ): Promise<Event[]>;
}

/**
 * Event querier interface for reading events
 */
export interface EventQuerier {
  /**
   * Query events by filter
   */
  query(filter: EventFilter): Promise<Event[]>;

  /**
   * Get latest event for an aggregate
   */
  latestEvent(aggregateType: string, aggregateID: string): Promise<Event | null>;

  /**
   * Get aggregate by ID
   */
  aggregate(
    aggregateType: string,
    aggregateID: string,
    version?: number
  ): Promise<Aggregate | null>;
}

/**
 * Event searcher interface for complex queries
 */
export interface EventSearcher {
  /**
   * Search events with complex filters
   */
  search(query: SearchQuery): Promise<Event[]>;

  /**
   * Count events matching filter
   */
  count(filter: EventFilter): Promise<number>;

  /**
   * Get events after a specific position
   */
  eventsAfterPosition(position: Position, limit?: number): Promise<Event[]>;

  /**
   * Get the latest position across all events matching the filter
   * Essential for projections and catch-up subscriptions
   */
  latestPosition(filter?: EventFilter): Promise<Position>;
}

/**
 * Reducer interface for streaming event processing
 * Allows memory-efficient handling of large event streams
 */
export interface Reducer {
  /**
   * Append events to internal buffer
   */
  appendEvents(...events: Event[]): void;

  /**
   * Process buffered events and update state
   */
  reduce(): Promise<void>;
}

/**
 * Main eventstore interface combining all capabilities
 */
export interface Eventstore extends EventPusher, EventQuerier, EventSearcher {
  /**
   * Health check
   */
  health(): Promise<boolean>;

  /**
   * Close connections
   */
  close(): Promise<void>;

  /**
   * Stream events to a reducer instead of loading all into memory
   * Memory-efficient for large event streams
   */
  filterToReducer(filter: EventFilter, reducer: Reducer): Promise<void>;
}

/**
 * Eventstore configuration
 */
export interface EventstoreConfig {
  instanceID: string;
  maxPushBatchSize?: number;
  pushTimeout?: number;
  enableSubscriptions?: boolean; // Default true, set false in tests to avoid cross-test contamination
}

/**
 * Event validation error
 */
export class EventValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'EventValidationError';
  }
}

/**
 * Concurrency error when version mismatch occurs
 */
export class ConcurrencyError extends Error {
  constructor(
    message: string,
    public expectedVersion: number,
    public actualVersion: number
  ) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}
