import { SimpleMemoryCache } from './simple/memory';
import {
  Cache,
  MemoryCacheConfig,
} from './types';

/**
 * Create a memory cache instance
 */
export function createMemoryCache(config?: MemoryCacheConfig): Cache {
  return new SimpleMemoryCache(config);
}

/**
 * Create a default cache setup (memory only for now)
 */
export function createDefaultCache(options: {
  memory?: MemoryCacheConfig;
}): Cache {
  const { memory } = options;
  return createMemoryCache(memory);
}

/**
 * Create cache configuration from environment variables
 */
export function createCacheConfigFromEnv(): MemoryCacheConfig {
  return {
    defaultTTL: parseInt(process.env.CACHE_MEMORY_DEFAULT_TTL ?? '3600', 10),
    maxKeys: parseInt(process.env.CACHE_MEMORY_MAX_KEYS ?? '10000', 10),
    maxMemory: parseInt(process.env.CACHE_MEMORY_MAX_MEMORY ?? '104857600', 10), // 100MB
    keyPrefix: process.env.CACHE_KEY_PREFIX ?? 'zitadel',
    checkPeriod: parseInt(process.env.CACHE_MEMORY_CHECK_PERIOD ?? '600', 10),
    deleteOnExpire: process.env.CACHE_MEMORY_DELETE_ON_EXPIRE !== 'false',
  };
}
