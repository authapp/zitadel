import { SimpleMemoryCache } from './simple/memory';
import {
  MemoryCacheConfig,
  JSONSerializer,
  CacheSerializationError,
} from './types';

describe('SimpleMemoryCache', () => {
  let cache: SimpleMemoryCache;

  beforeEach(() => {
    const config: MemoryCacheConfig = {
      defaultTTL: 3600,
      maxKeys: 100,
      maxMemory: 1024 * 1024, // 1MB
      keyPrefix: 'test',
      checkPeriod: 1,
      deleteOnExpire: true,
    };
    cache = new SimpleMemoryCache(config);
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('basic operations', () => {
    it('should set and get values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete keys', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delete('key1');
      expect(deleted).toBe(true);
      
      const result = await cache.get('key1');
      expect(result).toBeNull();
    });

    it('should check key existence', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.exists('key1')).toBe(true);
      expect(await cache.exists('non-existent')).toBe(false);
    });

    it('should handle complex objects', async () => {
      const obj = { name: 'John', age: 30, active: true };
      await cache.set('user', obj);
      const result = await cache.get('user');
      expect(result).toEqual(obj);
    });
  });

  describe('TTL operations', () => {
    it('should expire keys after TTL', async () => {
      await cache.set('key1', 'value1', 1); // 1 second TTL
      expect(await cache.get('key1')).toBe('value1');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(await cache.get('key1')).toBeNull();
    });

    it('should set TTL for existing keys', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.expire('key1', 1);
      expect(result).toBe(true);
      
      const ttl = await cache.ttl('key1');
      expect(ttl).toBeLessThanOrEqual(1);
      expect(ttl).toBeGreaterThan(0);
    });

    it('should return correct TTL values', async () => {
      await cache.set('key1', 'value1', 10);
      const ttl = await cache.ttl('key1');
      expect(ttl).toBeLessThanOrEqual(10);
      expect(ttl).toBeGreaterThan(8);
    });

    it('should return -1 for keys without expiration', async () => {
      await cache.set('key1', 'value1', 0); // TTL = 0 means no expiration
      const ttl = await cache.ttl('key1');
      expect(ttl).toBe(-1);
    });

    it('should return -2 for non-existent keys', async () => {
      const ttl = await cache.ttl('non-existent');
      expect(ttl).toBe(-2);
    });
  });

  describe('bulk operations', () => {
    it('should get multiple values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const results = await cache.mget(['key1', 'key2', 'key4']);
      expect(results).toEqual(['value1', 'value2', null]);
    });

    it('should set multiple values', async () => {
      await cache.mset([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2', ttl: 10 },
      ]);

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
    });

    it('should delete multiple keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const deleted = await cache.mdel(['key1', 'key2', 'key4']);
      expect(deleted).toBe(2);

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBe('value3');
    });
  });

  describe('pattern matching', () => {
    it('should find keys by pattern', async () => {
      await cache.set('user:1', 'user1');
      await cache.set('user:2', 'user2');
      await cache.set('post:1', 'post1');

      const userKeys = await cache.keys('user:*');
      expect(userKeys.sort()).toEqual(['user:1', 'user:2']);

      const allKeys = await cache.keys();
      expect(allKeys.sort()).toEqual(['post:1', 'user:1', 'user:2']);
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', async () => {
      // Generate some hits and misses
      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.get('key2'); // miss
      await cache.get('key1'); // hit

      const stats = await cache.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.keys).toBe(1);
      expect(stats.hitRate).toBe(2/3);
    });
  });

  describe('clear operation', () => {
    it('should clear all cache entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      
      const stats = await cache.stats();
      expect(stats.keys).toBe(0);
    });
  });

  describe('health check', () => {
    it('should return true for healthy cache', async () => {
      const healthy = await cache.health();
      expect(healthy).toBe(true);
    });
  });
});

// MultiLevelCache tests will be added in a future iteration

describe('JSONSerializer', () => {
  let serializer: JSONSerializer;

  beforeEach(() => {
    serializer = new JSONSerializer();
  });

  it('should serialize and deserialize objects', () => {
    const obj = { name: 'John', age: 30, active: true };
    const serialized = serializer.serialize(obj);
    const deserialized = serializer.deserialize(serialized);
    
    expect(deserialized).toEqual(obj);
  });

  it('should handle primitive values', () => {
    expect(serializer.deserialize(serializer.serialize('string'))).toBe('string');
    expect(serializer.deserialize(serializer.serialize(123))).toBe(123);
    expect(serializer.deserialize(serializer.serialize(true))).toBe(true);
    expect(serializer.deserialize(serializer.serialize(null))).toBe(null);
  });

  it('should throw error for invalid JSON', () => {
    expect(() => serializer.deserialize('invalid json')).toThrow(CacheSerializationError);
  });

  it('should throw error for circular references', () => {
    const obj: any = { name: 'test' };
    obj.self = obj; // Create circular reference
    
    expect(() => serializer.serialize(obj)).toThrow(CacheSerializationError);
  });
});
