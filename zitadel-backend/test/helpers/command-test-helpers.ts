/**
 * Command Test Helpers
 * 
 * Reusable utilities for testing command implementations
 * - Test context setup
 * - Event assertions
 * - Mock infrastructure
 * - Test data builders
 */

import { DatabasePool } from '../../src/lib/database';
import { PostgresEventstore } from '../../src/lib/eventstore/postgres/eventstore';
import { Commands } from '../../src/lib/command/commands';
import { Context } from '../../src/lib/command/context';
import { Event } from '../../src/lib/eventstore/types';
import { SimpleMemoryCache } from '../../src/lib/cache/simple/memory';
import { LocalStorage } from '../../src/lib/static/local/storage';
import { SnowflakeGenerator } from '../../src/lib/id';

/**
 * Test context for command execution
 */
export interface CommandTestContext {
  pool: DatabasePool;
  eventstore: PostgresEventstore;
  commands: Commands;
  
  // Helper methods
  createContext(overrides?: Partial<Context>): Context;
  assertEventPublished(eventType: string, aggregateID?: string): Promise<Event>;
  assertEventsPublished(assertions: EventAssertion[]): Promise<void>;
  assertEventPayload(eventType: string, expectedPayload: any): Promise<void>;
  getEvents(aggregateType: string, aggregateID: string): Promise<Event[]>;
  getLatestEvent(aggregateType: string, aggregateID: string): Promise<Event | null>;
  clearEvents(): Promise<void>;
}

/**
 * Event assertion structure
 */
export interface EventAssertion {
  type: string;
  count?: number;
  aggregateID?: string;
  payload?: any;
}

/**
 * Setup command test context
 */
export async function setupCommandTest(pool: DatabasePool): Promise<CommandTestContext> {
  // Create eventstore
  const eventstore = new PostgresEventstore(pool, {
    instanceID: 'test-instance',
    maxPushBatchSize: 100,
    enableSubscriptions: false,
  });

  // Create cache
  const cache = new SimpleMemoryCache();

  // Create storage
  const storage = new LocalStorage({ basePath: '/tmp/test-uploads' });

  // Create ID generator
  const idGenerator = new SnowflakeGenerator({ machineId: 1 });

  // Create commands instance with all dependencies
  const commands = new Commands(
    eventstore,
    cache,
    storage,
    idGenerator,
    {
      externalDomain: 'localhost',
      externalSecure: false,
      externalPort: 8080,
    }
  );

  // Helper to create test context
  const createContext = (overrides?: Partial<Context>): Context => {
    return {
      instanceID: overrides?.instanceID || 'test-instance',
      orgID: overrides?.orgID || 'test-org',
      userID: overrides?.userID || 'test-user',
      ...overrides,
    };
  };

  // Helper to assert event was published
  const assertEventPublished = async (
    eventType: string,
    aggregateID?: string
  ): Promise<Event> => {
    const events = await getEvents('*', '*');
    const matchingEvents = events.filter(e => {
      if (e.eventType !== eventType) return false;
      if (aggregateID && e.aggregateID !== aggregateID) return false;
      return true;
    });

    if (matchingEvents.length === 0) {
      throw new Error(
        `Expected event "${eventType}"${aggregateID ? ` for aggregate ${aggregateID}` : ''} to be published, but it was not found`
      );
    }

    return matchingEvents[0];
  };

  // Helper to assert multiple events
  const assertEventsPublished = async (assertions: EventAssertion[]): Promise<void> => {
    const events = await getEvents('*', '*');

    for (const assertion of assertions) {
      const matchingEvents = events.filter(e => {
        if (e.eventType !== assertion.type) return false;
        if (assertion.aggregateID && e.aggregateID !== assertion.aggregateID) return false;
        return true;
      });

      const expectedCount = assertion.count ?? 1;
      if (matchingEvents.length !== expectedCount) {
        throw new Error(
          `Expected ${expectedCount} event(s) of type "${assertion.type}", but found ${matchingEvents.length}`
        );
      }

      // Check payload if specified
      if (assertion.payload) {
        const event = matchingEvents[0];
        for (const [key, value] of Object.entries(assertion.payload)) {
          if (event.payload?.[key] !== value) {
            throw new Error(
              `Event "${assertion.type}" payload mismatch: expected ${key}=${value}, got ${event.payload?.[key]}`
            );
          }
        }
      }
    }
  };

  // Helper to assert event payload
  const assertEventPayload = async (
    eventType: string,
    expectedPayload: any
  ): Promise<void> => {
    const event = await assertEventPublished(eventType);
    
    for (const [key, value] of Object.entries(expectedPayload)) {
      if (event.payload?.[key] !== value) {
        throw new Error(
          `Event "${eventType}" payload mismatch: expected ${key}=${value}, got ${event.payload?.[key]}`
        );
      }
    }
  };

  // Helper to get all events for an aggregate
  const getEvents = async (
    aggregateType: string,
    aggregateID: string
  ): Promise<Event[]> => {
    // Query events directly from the database
    const query = `
      SELECT *
      FROM events
      WHERE 
        ($1 = '*' OR aggregate_type = $1)
        AND ($2 = '*' OR aggregate_id = $2)
      ORDER BY position ASC
    `;
    
    const rows = await pool.queryMany(query, [aggregateType, aggregateID]);
    return rows.map((row: any) => ({
      eventType: row.event_type,
      aggregateType: row.aggregate_type,
      aggregateID: row.aggregate_id,
      aggregateVersion: row.aggregate_version,
      revision: row.revision || 1,
      payload: row.payload,
      creator: row.creator,
      owner: row.owner,
      instanceID: row.instance_id,
      createdAt: row.created_at,
      position: {
        position: row.position,
        inTxOrder: row.in_tx_order || 0,
      },
    }));
  };

  // Helper to get latest event
  const getLatestEvent = async (
    aggregateType: string,
    aggregateID: string
  ): Promise<Event | null> => {
    const events = await getEvents(aggregateType, aggregateID);
    return events.length > 0 ? events[events.length - 1] : null;
  };

  // Helper to clear events (for test cleanup)
  const clearEvents = async (): Promise<void> => {
    await pool.query('TRUNCATE events CASCADE');
  };

  return {
    pool,
    eventstore,
    commands,
    createContext,
    assertEventPublished,
    assertEventsPublished,
    assertEventPayload,
    getEvents,
    getLatestEvent,
    clearEvents,
  };
}

/**
 * Generate unique test ID
 */
export function generateTestID(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique email
 */
export function generateTestEmail(username?: string): string {
  const user = username || generateTestID('user');
  return `${user}@test.example.com`;
}

/**
 * Generate unique username
 */
export function generateTestUsername(prefix: string = 'testuser'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Create test context with common defaults
 */
export function createTestContext(overrides?: Partial<Context>): Context {
  return {
    instanceID: 'test-instance',
    orgID: 'test-org',
    userID: 'test-user',
    ...overrides,
  };
}
