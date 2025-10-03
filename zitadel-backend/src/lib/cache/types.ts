/**
 * Cache types and interfaces for Zitadel caching layer
 */

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  value: T;
  ttl?: number;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory?: number;
  hitRate: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  defaultTTL?: number; // Default TTL in seconds
  maxKeys?: number; // Maximum number of keys (for memory cache)
  maxMemory?: number; // Maximum memory usage in bytes (for memory cache)
  keyPrefix?: string; // Prefix for all cache keys
  serializer?: CacheSerializer;
}

/**
 * Cache serializer interface
 */
export interface CacheSerializer {
  serialize(value: any): string;
  deserialize<T>(value: string): T;
}

/**
 * Main cache interface
 */
export interface Cache {
  /**
   * Get a value from cache
   */
  get<T = any>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T = any>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a key from cache
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get multiple values at once
   */
  mget<T = any>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Set multiple values at once
   */
  mset<T = any>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;

  /**
   * Delete multiple keys at once
   */
  mdel(keys: string[]): Promise<number>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  stats(): Promise<CacheStats>;

  /**
   * Get all keys matching pattern
   */
  keys(pattern?: string): Promise<string[]>;

  /**
   * Set TTL for existing key
   */
  expire(key: string, ttl: number): Promise<boolean>;

  /**
   * Get TTL for a key
   */
  ttl(key: string): Promise<number>;

  /**
   * Health check
   */
  health(): Promise<boolean>;

  /**
   * Close cache connections
   */
  close(): Promise<void>;
}

/**
 * Multi-level cache interface
 */
export interface MultiLevelCache extends Cache {
  /**
   * Get cache level statistics
   */
  levelStats(): Promise<CacheStats[]>;

  /**
   * Invalidate key from all levels
   */
  invalidate(key: string): Promise<void>;

  /**
   * Invalidate keys matching pattern from all levels
   */
  invalidatePattern(pattern: string): Promise<void>;
}

/**
 * Redis cache configuration
 */
export interface RedisCacheConfig extends CacheConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  connectTimeout?: number;
  lazyConnect?: boolean;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

/**
 * Memory cache configuration
 */
export interface MemoryCacheConfig extends CacheConfig {
  checkPeriod?: number; // How often to check for expired keys (in seconds)
  deleteOnExpire?: boolean; // Whether to delete expired keys automatically
}

/**
 * Cache error types
 */
export class CacheError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CacheError';
  }
}

export class CacheConnectionError extends CacheError {
  constructor(message: string) {
    super(message, 'CACHE_CONNECTION_ERROR');
    this.name = 'CacheConnectionError';
  }
}

export class CacheSerializationError extends CacheError {
  constructor(message: string) {
    super(message, 'CACHE_SERIALIZATION_ERROR');
    this.name = 'CacheSerializationError';
  }
}

/**
 * Default JSON serializer
 */
export class JSONSerializer implements CacheSerializer {
  serialize(value: any): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      throw new CacheSerializationError(`Failed to serialize value: ${error}`);
    }
  }

  deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new CacheSerializationError(`Failed to deserialize value: ${error}`);
    }
  }
}
