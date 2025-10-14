/**
 * Queries - Main CQRS Query Service
 * 
 * This class provides the central query service for the read-side of CQRS.
 * It manages projections, query execution, and caching.
 * 
 * Based on Zitadel Go internal/query/query.go
 */

import { Eventstore } from '../eventstore/types';
import { DatabasePool } from '../database/pool';
import { Cache } from '../cache/types';
import { ProjectionRegistry } from './projection/projection-registry';
import { ProjectionConfig } from './projection/projection-config';

/**
 * Queries configuration
 */
export interface QueriesConfig {
  /**
   * Eventstore instance for reading events
   */
  eventstore: Eventstore;

  /**
   * Database pool for querying projections
   */
  database: DatabasePool;

  /**
   * Optional cache for query results
   */
  cache?: Cache;

  /**
   * Projection configurations
   * @deprecated Use ProjectionRegistry.register(config, projection) directly
   */
  projections?: never;

  /**
   * Default language for text queries
   */
  defaultLanguage?: string;

  /**
   * Instance ID for multi-tenant support
   */
  instanceID?: string;

  /**
   * Enable query result caching
   */
  enableCache?: boolean;

  /**
   * Cache TTL in seconds
   */
  cacheTTL?: number;
}

/**
 * Health status response
 */
export interface HealthStatus {
  healthy: boolean;
  database: boolean;
  eventstore: boolean;
  projections: {
    name: string;
    healthy: boolean;
    position: number;
    lag: number;
    errorCount: number;
  }[];
}

/**
 * Context for query execution
 */
export interface QueryContext {
  instanceID?: string;
  orgID?: string;
  userID?: string;
  language?: string;
}

/**
 * Main Queries service class
 * 
 * This is the central service for all query operations in the CQRS architecture.
 * It provides access to all domain-specific query methods through composition.
 */
export class Queries {
  private readonly eventstore: Eventstore;
  private readonly database: DatabasePool;
  private readonly cache?: Cache;
  private readonly projectionRegistry: ProjectionRegistry;
  private readonly defaultLanguage: string;
  private readonly instanceID?: string;
  private readonly enableCache: boolean;
  private readonly cacheTTL: number;
  private started: boolean = false;

  constructor(config: QueriesConfig) {
    this.eventstore = config.eventstore;
    this.database = config.database;
    this.cache = config.cache;
    this.defaultLanguage = config.defaultLanguage || 'en';
    this.instanceID = config.instanceID;
    this.enableCache = config.enableCache ?? true;
    this.cacheTTL = config.cacheTTL || 300; // 5 minutes default

    // Initialize projection registry
    this.projectionRegistry = new ProjectionRegistry({
      eventstore: this.eventstore,
      database: this.database,
    });

    // Note: Projections must be registered manually using:
    // projectionRegistry.register(config, projection)
  }

  /**
   * Start the query service and all projections
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Queries service already started');
    }

    // Start all projections
    await this.projectionRegistry.startAll();
    this.started = true;
  }

  /**
   * Stop the query service and all projections
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Stop all projections
    await this.projectionRegistry.stopAll();
    this.started = false;
  }

  /**
   * Get health status of the query service
   */
  async health(): Promise<HealthStatus> {
    const health: HealthStatus = {
      healthy: true,
      database: false,
      eventstore: false,
      projections: [],
    };

    // Check database health
    try {
      await this.database.query('SELECT 1');
      health.database = true;
    } catch (error) {
      health.healthy = false;
    }

    // Check eventstore health
    try {
      health.eventstore = await this.eventstore.health();
      if (!health.eventstore) {
        health.healthy = false;
      }
    } catch (error) {
      health.healthy = false;
      health.eventstore = false;
    }

    // Check projection health
    const projectionHealth = await this.projectionRegistry.getHealth();
    health.projections = projectionHealth.map((p: any) => ({
      name: p.name,
      healthy: p.healthy,
      position: p.currentPosition || 0,
      lag: p.lag || 0,
      errorCount: p.errorCount || 0,
    }));
    
    // If any projection is unhealthy, mark overall health as false
    if (projectionHealth.some((p: any) => !p.healthy)) {
      health.healthy = false;
    }

    return health;
  }

  /**
   * Register a new projection
   * @deprecated Use getProjectionRegistry().register(config, projection) directly
   */
  registerProjection(_config: ProjectionConfig): void {
    throw new Error('registerProjection is deprecated. Use getProjectionRegistry().register(config, projection) instead.');
  }

  /**
   * Get projection registry for advanced operations
   */
  getProjectionRegistry(): ProjectionRegistry {
    return this.projectionRegistry;
  }

  /**
   * Get database pool for custom queries
   */
  getDatabase(): DatabasePool {
    return this.database;
  }

  /**
   * Get eventstore for reading events
   */
  getEventstore(): Eventstore {
    return this.eventstore;
  }

  /**
   * Get cache instance
   */
  getCache(): Cache | undefined {
    return this.cache;
  }

  /**
   * Check if query service is started
   */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Get default language
   */
  getDefaultLanguage(): string {
    return this.defaultLanguage;
  }

  /**
   * Get instance ID
   */
  getInstanceID(): string | undefined {
    return this.instanceID;
  }

  /**
   * Create a query context
   */
  createContext(params?: Partial<QueryContext>): QueryContext {
    return {
      instanceID: params?.instanceID || this.instanceID,
      orgID: params?.orgID,
      userID: params?.userID,
      language: params?.language || this.defaultLanguage,
    };
  }

  /**
   * Execute a raw SQL query
   * Use with caution - prefer domain-specific query methods
   */
  async executeQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.database.query(sql, params);
    return result.rows;
  }

  /**
   * Get cached value or execute query function
   */
  protected async withCache<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // If caching is disabled or no cache, execute directly
    if (!this.enableCache || !this.cache) {
      return queryFn();
    }

    // Try to get from cache
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute query
    const result = await queryFn();

    // Cache the result
    await this.cache.set(key, result, ttl || this.cacheTTL);

    return result;
  }

  /**
   * Invalidate cache by key or pattern
   */
  protected async invalidateCache(keyOrPattern: string): Promise<void> {
    if (!this.cache) {
      return;
    }

    // If pattern contains wildcard, delete by pattern
    if (keyOrPattern.includes('*')) {
      const keys = await this.cache.keys(keyOrPattern);
      if (keys.length > 0) {
        // Delete each key individually
        await Promise.all(keys.map(key => this.cache!.delete(key)));
      }
    } else {
      await this.cache.delete(keyOrPattern);
    }
  }

  /**
   * Generate cache key for query
   */
  protected generateCacheKey(
    prefix: string,
    ...parts: (string | number | undefined)[]
  ): string {
    const validParts = parts.filter(p => p !== undefined);
    return `query:${prefix}:${validParts.join(':')}`;
  }
}
