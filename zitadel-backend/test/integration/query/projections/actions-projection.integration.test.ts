/**
 * Integration tests for Actions Projection
 * Tests action and execution event handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { ActionsProjection, createActionsProjectionConfig } from '../../../../src/lib/query/projections/actions-projection';
import { ActionQueries } from '../../../../src/lib/query/action/action-queries';
import { generateId } from '../../../../src/lib/id';
import { waitForProjectionCatchUp, delay } from '../../../helpers/projection-test-helpers';

describe('Actions Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let actionQueries: ActionQueries;

  const TEST_INSTANCE_ID = 'test-instance';

  beforeAll(async () => {
    pool = await createTestDatabase();

    eventstore = new PostgresEventstore(pool, {
      instanceID: TEST_INSTANCE_ID,
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });

    await registry.init();

    const config = createActionsProjectionConfig();
    config.interval = 50;
    registry.register(config, new ActionsProjection(eventstore, pool));

    await registry.start('actions_projection');

    // Initialize query layer
    actionQueries = new ActionQueries(pool);

    // Give projection time to start and establish subscriptions
    await delay(100);
  });

  afterAll(async () => {
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore
      }
    }

    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM projections.actions WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await pool.query('DELETE FROM projections.action_flows WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await delay(100);
  });

  // Helper to wait for projection to process events
  const waitForEvents = async () => {
    await waitForProjectionCatchUp(registry, eventstore, 'actions_projection', 2000);
  };

  describe('Action Added Events', () => {
    it('should process action.added event', async () => {
      const actionId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.added',
        payload: {
          id: actionId,
          name: 'test-action',
          script: 'console.log("test")',
          timeout: '10 seconds',
          allowedToFail: false,
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await actionQueries.getActionByID(TEST_INSTANCE_ID, actionId);

      expect(result).toBeDefined();
      expect(result!.name).toBe('test-action');
      expect(result!.script).toBe('console.log("test")');
      expect(result!.state).toBe(2); // active (ActionState.ACTIVE = 2)
    });

    it('should process action.v2.added event', async () => {
      const actionId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.v2.added',
        payload: {
          id: actionId,
          name: 'test-action-v2',
          script: 'return "hello"',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await actionQueries.getActionByID(TEST_INSTANCE_ID, actionId);

      expect(result).toBeDefined();
      expect(result!.name).toBe('test-action-v2');
    });
  });

  describe('Action Changed Events', () => {
    it('should update action on changed event', async () => {
      const actionId = generateId();

      // Add action
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.added',
        payload: {
          id: actionId,
          name: 'original-name',
          script: 'console.log("original")',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      // Change action
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.changed',
        payload: {
          id: actionId,
          name: 'updated-name',
          script: 'console.log("updated")',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await actionQueries.getActionByID(TEST_INSTANCE_ID, actionId);

      expect(result).toBeDefined();
      expect(result!.name).toBe('updated-name');
      expect(result!.script).toBe('console.log("updated")');
    });
  });

  describe('Action State Events', () => {
    it('should deactivate action', async () => {
      const actionId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.added',
        payload: {
          id: actionId,
          name: 'test-action',
          script: 'test',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.deactivated',
        payload: { id: actionId },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await actionQueries.getActionByID(TEST_INSTANCE_ID, actionId);

      expect(result).toBeDefined();
      expect(result!.state).toBe(1); // inactive (ActionState.INACTIVE = 1)
    });

    it('should reactivate action', async () => {
      const actionId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.added',
        payload: { id: actionId, name: 'test', script: 'test' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.deactivated',
        payload: { id: actionId },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.reactivated',
        payload: { id: actionId },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await actionQueries.getActionByID(TEST_INSTANCE_ID, actionId);

      expect(result).toBeDefined();
      expect(result!.state).toBe(2); // active (ActionState.ACTIVE = 2)
    });
  });

  describe('Action Removed Events', () => {
    it('should remove action', async () => {
      const actionId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.added',
        payload: { id: actionId, name: 'test', script: 'test' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.removed',
        payload: { id: actionId },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await actionQueries.getActionByID(TEST_INSTANCE_ID, actionId);

      expect(result).toBeNull();
    });
  });

  describe('Execution Flow Events', () => {
    it('should create action flow on execution.set', async () => {
      const actionId = generateId();

      // First create the action
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.added',
        payload: { id: actionId, name: 'test', script: 'test' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      // Set execution flow
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'execution',
        aggregateID: generateId(),
        eventType: 'execution.set',
        payload: {
          condition: {
            type: 'pre_creation',
            request: { type: 'user.created' },
          },
          targets: [
            {
              type: 'action',
              actionId: actionId,
              sequence: 1,
            },
          ],
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      // TODO: Add ActionQueries.getActionFlow() method to query layer
      // For now, using direct table query for action_flows
      const result = await pool.queryOne(
        'SELECT * FROM projections.action_flows WHERE instance_id = $1 AND action_id = $2',
        [TEST_INSTANCE_ID, actionId]
      );

      expect(result).toBeDefined();
      expect(result.flow_type).toBe('pre_creation');
      expect(result.trigger_type).toBe('user.created');
      expect(result.trigger_sequence).toBe(1);
    });

    it('should remove action flow on execution.removed', async () => {
      const actionId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.added',
        payload: { id: actionId, name: 'test', script: 'test' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'execution',
        aggregateID: generateId(),
        eventType: 'execution.set',
        payload: {
          condition: { type: 'pre_creation', request: { type: 'user.created' } },
          targets: [{ type: 'action', actionId: actionId }],
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'execution',
        aggregateID: generateId(),
        eventType: 'execution.removed',
        payload: {
          condition: { type: 'pre_creation', request: { type: 'user.created' } },
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      // TODO: Add ActionQueries.getActionFlow() method to query layer
      // For now, using direct table query for action_flows
      const result = await pool.queryOne(
        'SELECT * FROM projections.action_flows WHERE instance_id = $1 AND action_id = $2',
        [TEST_INSTANCE_ID, actionId]
      );

      expect(result).toBeNull();
    });
  });

  describe('Cleanup Events', () => {
    it('should delete actions when org is removed', async () => {
      const orgId = generateId();
      const actionId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.added',
        payload: { id: actionId, name: 'test', script: 'test' },
        creator: 'admin',
        owner: orgId,
      });

      await waitForEvents();

      let result = await actionQueries.getActionByID(TEST_INSTANCE_ID, actionId);
      expect(result).toBeDefined();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.removed',
        payload: {},
        creator: 'admin',
        owner: orgId,
      });

      await waitForEvents();

      result = await actionQueries.getActionByID(TEST_INSTANCE_ID, actionId);
      expect(result).toBeNull();
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate actions by instance', async () => {
      const actionId = generateId();
      const otherInstance = `other-instance-${generateId()}`;

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'action',
        aggregateID: actionId,
        eventType: 'action.added',
        payload: { id: actionId, name: 'test', script: 'test' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForEvents();

      const result = await actionQueries.getActionByID(otherInstance, actionId);

      expect(result).toBeNull();
    });
  });
});
