import {
  SnowflakeGenerator,
  initializeGenerator,
  generateId,
  parseId,
} from './snowflake';

describe('SnowflakeGenerator', () => {
  describe('constructor', () => {
    it('should create generator with default config', () => {
      const generator = new SnowflakeGenerator();
      expect(generator).toBeInstanceOf(SnowflakeGenerator);
    });

    it('should create generator with custom machine ID', () => {
      const generator = new SnowflakeGenerator({ machineId: 42 });
      const id = generator.generate();
      const parsed = generator.parse(id);

      expect(parsed.machineId).toBe(42);
    });

    it('should create generator with custom epoch', () => {
      const customEpoch = Date.now() - 1000000;
      const generator = new SnowflakeGenerator({ epoch: customEpoch });
      expect(generator).toBeInstanceOf(SnowflakeGenerator);
    });

    it('should throw error for invalid machine ID', () => {
      expect(() => {
        new SnowflakeGenerator({ machineId: -1 });
      }).toThrow('Machine ID must be between 0 and 1023');

      expect(() => {
        new SnowflakeGenerator({ machineId: 1024 });
      }).toThrow('Machine ID must be between 0 and 1023');
    });

    it('should accept valid machine ID range', () => {
      expect(() => new SnowflakeGenerator({ machineId: 0 })).not.toThrow();
      expect(() => new SnowflakeGenerator({ machineId: 1023 })).not.toThrow();
    });
  });

  describe('generate', () => {
    it('should generate valid ID', () => {
      const generator = new SnowflakeGenerator({ machineId: 1 });
      const id = generator.generate();

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(/^\d+$/.test(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const generator = new SnowflakeGenerator({ machineId: 1 });
      const ids = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        ids.add(generator.generate());
      }

      expect(ids.size).toBe(1000);
    });

    it('should generate chronologically increasing IDs', () => {
      const generator = new SnowflakeGenerator({ machineId: 1 });
      const id1 = BigInt(generator.generate());
      const id2 = BigInt(generator.generate());
      const id3 = BigInt(generator.generate());

      expect(id2).toBeGreaterThan(id1);
      expect(id3).toBeGreaterThan(id2);
    });

    it('should handle sequence overflow within same millisecond', () => {
      const generator = new SnowflakeGenerator({ machineId: 1 });
      const ids: string[] = [];

      // Generate many IDs quickly to test sequence handling
      for (let i = 0; i < 100; i++) {
        ids.push(generator.generate());
      }

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('parse', () => {
    it('should parse generated ID correctly', () => {
      const generator = new SnowflakeGenerator({ machineId: 42 });
      const id = generator.generate();
      const parsed = generator.parse(id);

      expect(parsed.machineId).toBe(42);
      expect(parsed.timestamp).toBeInstanceOf(Date);
      expect(parsed.sequence).toBeGreaterThanOrEqual(0);
      expect(parsed.sequence).toBeLessThan(4096);
    });

    it('should parse timestamp correctly', () => {
      const generator = new SnowflakeGenerator({ machineId: 1 });
      const beforeGenerate = Date.now();
      const id = generator.generate();
      const afterGenerate = Date.now();
      const parsed = generator.parse(id);

      expect(parsed.timestamp.getTime()).toBeGreaterThanOrEqual(beforeGenerate);
      expect(parsed.timestamp.getTime()).toBeLessThanOrEqual(afterGenerate);
    });

    it('should parse multiple IDs correctly', () => {
      const generator = new SnowflakeGenerator({ machineId: 5 });
      const ids = [generator.generate(), generator.generate(), generator.generate()];

      ids.forEach((id) => {
        const parsed = generator.parse(id);
        expect(parsed.machineId).toBe(5);
        expect(parsed.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('generateBatch', () => {
    it('should generate batch of IDs', () => {
      const generator = new SnowflakeGenerator({ machineId: 1 });
      const ids = generator.generateBatch(10);

      expect(ids).toHaveLength(10);
      expect(new Set(ids).size).toBe(10); // All unique
    });

    it('should generate large batch efficiently', () => {
      const generator = new SnowflakeGenerator({ machineId: 1 });
      const startTime = Date.now();
      const ids = generator.generateBatch(10000);
      const endTime = Date.now();

      expect(ids).toHaveLength(10000);
      expect(new Set(ids).size).toBe(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });
  });
});

describe('Global generator functions', () => {
  describe('initializeGenerator', () => {
    it('should initialize global generator', () => {
      initializeGenerator({ machineId: 10 });
      const id = generateId();
      const parsed = parseId(id);

      expect(parsed.machineId).toBe(10);
    });

    it('should allow re-initialization', () => {
      initializeGenerator({ machineId: 20 });
      const id = generateId();
      const parsed = parseId(id);

      expect(parsed.machineId).toBe(20);
    });
  });

  describe('generateId', () => {
    it('should generate ID using default generator', () => {
      const id = generateId();

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(/^\d+$/.test(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }

      expect(ids.size).toBe(100);
    });
  });

  describe('parseId', () => {
    it('should parse ID using default generator', () => {
      const id = generateId();
      const parsed = parseId(id);

      expect(parsed.timestamp).toBeInstanceOf(Date);
      expect(parsed.machineId).toBeGreaterThanOrEqual(0);
      expect(parsed.machineId).toBeLessThan(1024);
      expect(parsed.sequence).toBeGreaterThanOrEqual(0);
      expect(parsed.sequence).toBeLessThan(4096);
    });
  });
});

describe('Snowflake ID properties', () => {
  it('should maintain chronological order across different generators', () => {
    const gen1 = new SnowflakeGenerator({ machineId: 1 });
    const gen2 = new SnowflakeGenerator({ machineId: 2 });

    const id1 = BigInt(gen1.generate());
    const id2 = BigInt(gen2.generate());

    // IDs from later generation should be larger (assuming same millisecond or later)
    expect(id2).toBeGreaterThanOrEqual(id1);
  });

  it('should handle rapid generation without duplicates', () => {
    const generator = new SnowflakeGenerator({ machineId: 1 });
    const ids = new Set<string>();

    // Generate as fast as possible
    for (let i = 0; i < 5000; i++) {
      ids.add(generator.generate());
    }

    expect(ids.size).toBe(5000);
  });

  it('should encode machine ID correctly', () => {
    for (let machineId = 0; machineId < 10; machineId++) {
      const generator = new SnowflakeGenerator({ machineId });
      const id = generator.generate();
      const parsed = generator.parse(id);

      expect(parsed.machineId).toBe(machineId);
    }
  });

  it('should handle sequence numbers correctly', () => {
    const generator = new SnowflakeGenerator({ machineId: 1 });
    const ids: string[] = [];

    // Generate multiple IDs in same millisecond
    for (let i = 0; i < 10; i++) {
      ids.push(generator.generate());
    }

    // Parse and check sequences
    const sequences = ids.map((id) => generator.parse(id).sequence);

    // Sequences should be valid
    sequences.forEach((seq) => {
      expect(seq).toBeGreaterThanOrEqual(0);
      expect(seq).toBeLessThan(4096);
    });
  });
});
