/**
 * Projection Lifecycle Integration Test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { Projection } from '../../../../src/lib/query/projection/projection';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { Event } from '../../../../src/lib/eventstore/types';

// Simple test projection
class SimpleProjection extends Projection {
  readonly name = 'simple_test_projection';
  readonly tables = ['test_simple'];
  
  eventsProcessed: Event[] = [];

  async reduce(event: Event): Promise<void> {
    this.eventsProcessed.push(event);
  }

  async init(): Promise<void> {
    // Table created by migrations, no-op
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }
}

const mockQuery = jest.fn(
    async <T  = any>(): Promise<T> => ({ rows: [] as T[] } as T)
  )
const mockHealth: jest.MockedFunction<() => Promise<boolean>> = jest.fn();

// Mock dependencies for integration test
// @ts-ignore - Jest mock type inference issues
const mockEventstore: any = {
  query: mockQuery,
  health: mockHealth,
  search: jest.fn(),
  push: jest.fn(),
  pushMany: jest.fn(),
  latestEvent: jest.fn(),
  aggregate: jest.fn(),
  count: jest.fn(),
  eventsAfterPosition: jest.fn(),
  latestPosition: jest.fn(),
  close: jest.fn(),
  filterToReducer: jest.fn(),
  distinctInstanceIDs: jest.fn(),
  pushWithConcurrencyCheck: jest.fn(),
};

// @ts-ignore - Jest mock type inference issues
const mockDatabase: any = {
  query: mockQuery,
  close: jest.fn(),
};

describe('Projection Lifecycle Integration', () => {
  let registry: ProjectionRegistry;
  let projection: SimpleProjection;

  beforeEach(() => {
    // Reset and configure mocks before each test
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    mockHealth.mockResolvedValue(true);
  });

  beforeAll(async () => {
    registry = new ProjectionRegistry({
      eventstore: mockEventstore as any,
      database: mockDatabase as any,
    });

    await registry.init();

    projection = new SimpleProjection(
      mockEventstore as any,
      mockDatabase as any
    );

    await projection.init();
  });

  afterAll(async () => {
    await projection.cleanup();
  });

  it('should register projection', () => {
    expect(() => {
      registry.register({
        name: 'simple_test_projection',
        tables: ['test_simple'],
        eventTypes: ['test.event'],
      }, projection);
    }).not.toThrow();
  });

  it('should track projection in registry', () => {
    const handler = registry.get('simple_test_projection');
    expect(handler).toBeDefined();
  });

  it('should list all projections', () => {
    const names = registry.getNames();
    expect(names).toContain('simple_test_projection');
  });

  it('should get health for projection', async () => {
    const health = await registry.getProjectionHealth('simple_test_projection');
    expect(health).toBeDefined();
    expect(health.name).toBe('simple_test_projection');
  });

  it('should process events through projection', async () => {
    const testEvent: Event = {
      instanceID: 'test-instance',
      aggregateType: 'test',
      aggregateID: 'test-123',
      eventType: 'test.event',
      aggregateVersion: BigInt(1),
      revision: 1,
      createdAt: new Date(),
      payload: { data: 'test' },
      creator: 'test-user',
      owner: 'test-owner',
      position: { position: 1, inTxOrder: 0 },
    };

    await projection.reduce(testEvent);
    expect(projection.eventsProcessed).toHaveLength(1);
    expect(projection.eventsProcessed[0]).toBe(testEvent);
  });

  it('should unregister projection', async () => {
    await registry.unregister('simple_test_projection');
    const handler = registry.get('simple_test_projection');
    expect(handler).toBeUndefined();
  });
});
