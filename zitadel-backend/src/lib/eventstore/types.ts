/**
 * Event sourcing types and interfaces for Zitadel eventstore
 */

/**
 * Position represents a position in the event stream
 */
export interface Position {
  position: bigint;
  inPositionOrder: number;
}

/**
 * Event represents a single event in the event stream
 */
export interface Event {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateID: string;
  aggregateVersion: number;
  eventData: Record<string, any>;
  editorUser: string;
  editorService?: string;
  resourceOwner: string;
  instanceID: string;
  position: Position;
  creationDate: Date;
  revision: number;
}

/**
 * Command represents a command to be executed
 */
export interface Command {
  aggregateType: string;
  aggregateID: string;
  eventType: string;
  eventData: Record<string, any>;
  editorUser: string;
  editorService?: string;
  resourceOwner: string;
  instanceID: string;
  revision?: number;
}

/**
 * Aggregate represents the current state of an aggregate
 */
export interface Aggregate {
  id: string;
  type: string;
  resourceOwner: string;
  instanceID: string;
  version: number;
  events: Event[];
  position: Position;
}

/**
 * Event filter for querying events
 */
export interface EventFilter {
  aggregateTypes?: string[];
  aggregateIDs?: string[];
  eventTypes?: string[];
  resourceOwner?: string;
  instanceID?: string;
  editorUser?: string;
  editorService?: string;
  creationDateFrom?: Date;
  creationDateTo?: Date;
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
}

/**
 * Eventstore configuration
 */
export interface EventstoreConfig {
  instanceID: string;
  maxPushBatchSize?: number;
  pushTimeout?: number;
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
