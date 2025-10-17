/**
 * Projection Configuration
 * 
 * Configuration types and interfaces for projection system.
 * Based on Zitadel Go internal/eventstore/handler/v2/
 */

import { Event } from '../../eventstore/types';

/**
 * Projection configuration
 */
export interface ProjectionConfig {
  /**
   * Unique name of the projection
   */
  name: string;

  /**
   * Database tables used by this projection
   */
  tables: string[];

  /**
   * Event types this projection listens to
   */
  eventTypes?: string[];

  /**
   * Aggregate types this projection listens to
   */
  aggregateTypes?: string[];

  /**
   * Batch size for event processing
   * Default: 100
   */
  batchSize?: number;

  /**
   * Processing interval in milliseconds
   * Default: 1000 (1 second)
   */
  interval?: number;

  /**
   * Maximum retry count for failed events
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds
   * Default: 5000 (5 seconds)
   */
  retryDelay?: number;

  /**
   * Enable projection locking for distributed systems
   * Default: true
   */
  enableLocking?: boolean;

  /**
   * Lock TTL in seconds
   * Default: 60
   */
  lockTTL?: number;

  /**
   * Instance ID for multi-instance deployments
   */
  instanceID?: string;

  /**
   * Start position (for catch-up mode)
   * If not provided, starts from last known position
   */
  startPosition?: number;

  /**
   * Rebuild on start (deletes projection data and rebuilds from scratch)
   * Default: false
   */
  rebuildOnStart?: boolean;
}

/**
 * Projection handler configuration with defaults applied
 */
export interface ProjectionHandlerConfig {
  name: string;
  tables: string[];
  eventTypes: string[];
  aggregateTypes: string[];
  batchSize: number;
  interval: number;
  maxRetries: number;
  retryDelay: number;
  enableLocking: boolean;
  lockTTL: number;
  instanceID?: string; // Optional - undefined means process events from all instances
  startPosition?: number;
  rebuildOnStart: boolean;
}

/**
 * Apply default values to projection configuration
 */
export function applyProjectionDefaults(
  config: ProjectionConfig
): ProjectionHandlerConfig {
  // Use faster polling in test mode for better test performance
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  const defaultInterval = isTestMode ? 100 : 1000; // 100ms in tests, 1s in production
  
  return {
    name: config.name,
    tables: config.tables,
    eventTypes: config.eventTypes || [],
    aggregateTypes: config.aggregateTypes || [],
    batchSize: config.batchSize || 100,
    interval: config.interval || defaultInterval,
    maxRetries: config.maxRetries || 3,
    retryDelay: config.retryDelay || 5000,
    enableLocking: config.enableLocking !== false,
    lockTTL: config.lockTTL || 60,
    instanceID: config.instanceID, // No default - undefined means process all instances
    startPosition: config.startPosition,
    rebuildOnStart: config.rebuildOnStart || false,
  };
}

/**
 * Projection filter - determines which events the projection processes
 */
export interface ProjectionFilter {
  /**
   * Filter by event types
   */
  eventTypes?: string[];

  /**
   * Filter by aggregate types
   */
  aggregateTypes?: string[];

  /**
   * Filter by aggregate IDs
   */
  aggregateIDs?: string[];

  /**
   * Filter by instance ID
   */
  instanceID?: string;

  /**
   * Filter by resource owner
   */
  owner?: string;

  /**
   * Custom filter function
   */
  customFilter?: (event: Event) => boolean;
}

/**
 * Check if event matches filter
 */
export function eventMatchesFilter(
  event: Event,
  filter: ProjectionFilter
): boolean {
  // Check event types
  if (
    filter.eventTypes &&
    filter.eventTypes.length > 0 &&
    !filter.eventTypes.includes(event.eventType)
  ) {
    return false;
  }

  // Check aggregate types
  if (
    filter.aggregateTypes &&
    filter.aggregateTypes.length > 0 &&
    !filter.aggregateTypes.includes(event.aggregateType)
  ) {
    return false;
  }

  // Check aggregate IDs
  if (
    filter.aggregateIDs &&
    filter.aggregateIDs.length > 0 &&
    !filter.aggregateIDs.includes(event.aggregateID)
  ) {
    return false;
  }

  // Check instance ID
  if (filter.instanceID && event.instanceID !== filter.instanceID) {
    return false;
  }

  // Check resource owner
  if (filter.owner && event.owner !== filter.owner) {
    return false;
  }

  // Check custom filter
  if (filter.customFilter && !filter.customFilter(event)) {
    return false;
  }

  return true;
}
