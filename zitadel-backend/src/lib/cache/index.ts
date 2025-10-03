/**
 * Cache module - Caching layer implementation for Zitadel
 * 
 * This module provides caching capabilities including:
 * - In-memory caching for fast access
 * - Redis caching for distributed scenarios
 * - Multi-level caching combining memory and Redis
 * - TTL support and automatic expiration
 * - Cache statistics and monitoring
 */

export * from './types';
export { SimpleMemoryCache } from './simple/memory';

// Re-export commonly used types for convenience
export type {
  Cache,
  CacheEntry,
  CacheStats,
  MemoryCacheConfig,
  CacheSerializer,
} from './types';

export {
  CacheError,
  CacheConnectionError,
  CacheSerializationError,
  JSONSerializer,
} from './types';
