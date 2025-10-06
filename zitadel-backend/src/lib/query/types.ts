/**
 * Query module types and interfaces for Zitadel
 * Implements the read-side of CQRS architecture
 */

import { Event } from '../eventstore/types';

/**
 * Query result pagination
 */
export interface Pagination {
  offset: number;
  limit: number;
  total?: number;
}

/**
 * Sorting configuration
 */
export interface Sorting {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Query filter operators
 */
export enum FilterOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'nin',
  LIKE = 'like',
  NOT_LIKE = 'nlike',
  IS_NULL = 'null',
  IS_NOT_NULL = 'nnull',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
}

/**
 * Query filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: any;
}

/**
 * Logical operators for combining filters
 */
export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not',
}

/**
 * Complex filter with logical operators
 */
export interface FilterGroup {
  operator: LogicalOperator;
  conditions: (FilterCondition | FilterGroup)[];
}

/**
 * Query options
 */
export interface QueryOptions {
  filters?: FilterGroup | FilterCondition[];
  sorting?: Sorting[];
  pagination?: Pagination;
  includeDeleted?: boolean;
}

/**
 * Query result wrapper
 */
export interface QueryResult<T> {
  data: T[];
  pagination?: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Projection state
 */
export interface ProjectionState {
  name: string;
  position: number; // DECIMAL - timestamp from EXTRACT(EPOCH FROM clock_timestamp())
  lastProcessedAt: Date;
  status: ProjectionStatus;
  errorCount: number;
  lastError?: string;
}

/**
 * Projection status
 */
export enum ProjectionStatus {
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
  REBUILDING = 'rebuilding',
}

/**
 * Projection handler function
 */
export type ProjectionHandler<T = any> = (event: Event, currentState?: T) => Promise<T | null>;

/**
 * Projection configuration
 */
export interface ProjectionConfig {
  name: string;
  table: string;
  eventTypes: string[];
  handler: ProjectionHandler;
  batchSize?: number;
  parallelism?: number;
  rebuildOnStart?: boolean;
}

/**
 * Query interface for reading projections
 */
export interface Query {
  /**
   * Find a single entity by ID
   */
  findById<T>(table: string, id: string): Promise<T | null>;

  /**
   * Find entities matching query options
   */
  find<T>(table: string, options?: QueryOptions): Promise<QueryResult<T>>;

  /**
   * Count entities matching filters
   */
  count(table: string, filters?: FilterGroup | FilterCondition[]): Promise<number>;

  /**
   * Check if entity exists
   */
  exists(table: string, id: string): Promise<boolean>;

  /**
   * Execute custom SQL query
   */
  execute<T>(sql: string, params?: any[]): Promise<T[]>;

  /**
   * Get projection state
   */
  getProjectionState(name: string): Promise<ProjectionState | null>;

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
 * Projection manager interface
 */
export interface ProjectionManager {
  /**
   * Register a projection
   */
  register(config: ProjectionConfig): Promise<void>;

  /**
   * Start a projection
   */
  start(name: string): Promise<void>;

  /**
   * Stop a projection
   */
  stop(name: string): Promise<void>;

  /**
   * Rebuild a projection from scratch
   */
  rebuild(name: string): Promise<void>;

  /**
   * Get projection status
   */
  getStatus(name: string): Promise<ProjectionState | null>;

  /**
   * List all projections
   */
  list(): Promise<ProjectionState[]>;

  /**
   * Close all projections
   */
  close(): Promise<void>;
}

/**
 * Query builder interface
 */
export interface QueryBuilder<T> {
  /**
   * Add a filter condition
   */
  where(field: string, operator: FilterOperator, value?: any): QueryBuilder<T>;

  /**
   * Add an AND condition
   */
  and(field: string, operator: FilterOperator, value?: any): QueryBuilder<T>;

  /**
   * Add an OR condition
   */
  or(field: string, operator: FilterOperator, value?: any): QueryBuilder<T>;

  /**
   * Add sorting
   */
  orderBy(field: string, direction?: 'asc' | 'desc'): QueryBuilder<T>;

  /**
   * Add pagination
   */
  paginate(offset: number, limit: number): QueryBuilder<T>;

  /**
   * Include soft-deleted records
   */
  includeDeleted(): QueryBuilder<T>;

  /**
   * Execute the query
   */
  execute(): Promise<QueryResult<T>>;

  /**
   * Execute and return first result
   */
  first(): Promise<T | null>;

  /**
   * Count matching records
   */
  count(): Promise<number>;
}

/**
 * Query error types
 */
export class QueryError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'QueryError';
  }
}

export class ProjectionError extends Error {
  constructor(message: string, public projectionName: string, public code?: string) {
    super(message);
    this.name = 'ProjectionError';
  }
}

export class FilterError extends Error {
  constructor(message: string, public filter?: string) {
    super(message);
    this.name = 'FilterError';
  }
}
