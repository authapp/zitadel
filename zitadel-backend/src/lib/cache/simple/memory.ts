import {
  Cache,
  CacheStats,
  MemoryCacheConfig,
} from '../types';

/**
 * Simple in-memory cache implementation
 */
export class SimpleMemoryCache implements Cache {
  private store = new Map<string, { value: any; expiresAt?: number }>();
  private hitCount = 0;
  private missCount = 0;
  private defaultTTL: number;
  private keyPrefix: string;

  constructor(config: MemoryCacheConfig = {}) {
    this.defaultTTL = config.defaultTTL ?? 3600;
    this.keyPrefix = config.keyPrefix ?? '';
  }

  async get<T = any>(key: string): Promise<T | null> {
    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.store.get(prefixedKey);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(prefixedKey);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.value as T;
  }

  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    const effectiveTTL = ttl !== undefined ? ttl : this.defaultTTL;
    const expiresAt = effectiveTTL > 0 ? Date.now() + effectiveTTL * 1000 : undefined;

    this.store.set(prefixedKey, { value, expiresAt });
  }

  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.getPrefixedKey(key);
    return this.store.delete(prefixedKey);
  }

  async exists(key: string): Promise<boolean> {
    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.store.get(prefixedKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(prefixedKey);
      return false;
    }

    return true;
  }

  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    return results;
  }

  async mset<T = any>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async mdel(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (await this.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  async stats(): Promise<CacheStats> {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      hits: this.hitCount,
      misses: this.missCount,
      keys: this.store.size,
      hitRate,
    };
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys()).map(key => this.removePrefixFromKey(key));
    
    if (!pattern) {
      return allKeys;
    }

    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.store.get(prefixedKey);

    if (!entry) {
      return false;
    }

    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : undefined;
    entry.expiresAt = expiresAt;
    return true;
  }

  async ttl(key: string): Promise<number> {
    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.store.get(prefixedKey);

    if (!entry) {
      return -2; // Key doesn't exist
    }

    if (!entry.expiresAt) {
      return -1; // Key exists but has no expiration
    }

    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return Math.max(0, remaining);
  }

  async health(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.store.clear();
  }

  private getPrefixedKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }

  private removePrefixFromKey(prefixedKey: string): string {
    if (!this.keyPrefix) {
      return prefixedKey;
    }
    
    const prefix = `${this.keyPrefix}:`;
    return prefixedKey.startsWith(prefix) ? prefixedKey.slice(prefix.length) : prefixedKey;
  }
}
