/**
 * Actions Schema Integration Tests
 * Tests actions, action_flows, executions, and execution_states tables
 * Uses query models where available
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { DatabaseMigrator } from '../../../src/lib/database/migrator';
import { ActionQueries } from '../../../src/lib/query/action/action-queries';
import { generateId } from '../../../src/lib/id';

describe('Actions Schema Integration Tests', () => {
  let pool: DatabasePool;
  let actionQueries: ActionQueries;
  const TEST_INSTANCE_ID = `test-instance-${generateId()}`;

  beforeAll(async () => {
    pool = await createTestDatabase();
    
    // Reset and re-migrate to ensure fresh schema
    const migrator = new DatabaseMigrator(pool);
    await migrator.reset();
    await migrator.migrate();
    
    // Initialize query layer
    actionQueries = new ActionQueries(pool);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Actions Table', () => {
    it('should insert and query action via query model', async () => {
      const actionId = generateId();
      const resourceOwner = generateId();

      await pool.query(
        `INSERT INTO projections.actions (
          id, instance_id, resource_owner, name, script, timeout, allowed_to_fail, state, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [actionId, TEST_INSTANCE_ID, resourceOwner, 'test-action', 'console.log("test")', '10 seconds', false, 1, 1]
      );

      // Use query model
      const action = await actionQueries.getActionByID(TEST_INSTANCE_ID, actionId);

      expect(action).toBeDefined();
      expect(action!.id).toBe(actionId);
      expect(action!.name).toBe('test-action');
      expect(action!.script).toBe('console.log("test")');
      expect(action!.timeout).toBe(10000);
      expect(action!.allowedToFail).toBe(false);
      expect(action!.state).toBe(1);
    });

    it('should handle multiple actions in same instance', async () => {
      const action1Id = generateId();
      const action2Id = generateId();
      const resourceOwner = generateId();

      await pool.query(
        `INSERT INTO projections.actions (
          id, instance_id, resource_owner, name, script, state, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [action1Id, TEST_INSTANCE_ID, resourceOwner, 'action1', 'script1()', 1, 1]
      );

      await pool.query(
        `INSERT INTO projections.actions (
          id, instance_id, resource_owner, name, script, state, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [action2Id, TEST_INSTANCE_ID, resourceOwner, 'action2', 'script2()', 1, 2]
      );

      const action1 = await actionQueries.getActionByID(TEST_INSTANCE_ID, action1Id);
      const action2 = await actionQueries.getActionByID(TEST_INSTANCE_ID, action2Id);

      expect(action1!.name).toBe('action1');
      expect(action2!.name).toBe('action2');
    });

    it('should enforce multi-tenant isolation', async () => {
      const actionId = generateId();
      const otherInstance = `other-instance-${generateId()}`;

      await pool.query(
        `INSERT INTO projections.actions (
          id, instance_id, resource_owner, name, script, state, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [actionId, TEST_INSTANCE_ID, 'owner1', 'action1', 'script1', 1, 1]
      );

      // Query with different instance should return null
      const action = await actionQueries.getActionByID(actionId, otherInstance);
      expect(action).toBeNull();
    });
  });

  describe('Action Flows Table', () => {
    it('should insert and query action flows', async () => {
      const actionId = generateId();
      const resourceOwner = generateId();

      await pool.query(
        `INSERT INTO projections.action_flows (
          flow_type, trigger_type, action_id, instance_id, resource_owner, trigger_sequence, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['pre_creation', 'user.created', actionId, TEST_INSTANCE_ID, resourceOwner, 1, 1]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.action_flows WHERE instance_id = $1 AND action_id = $2',
        [TEST_INSTANCE_ID, actionId]
      );

      expect(result).toBeDefined();
      expect(result.flow_type).toBe('pre_creation');
      expect(result.trigger_type).toBe('user.created');
      expect(result.action_id).toBe(actionId);
    });

    it('should support multiple flows for same action', async () => {
      const actionId = generateId();
      const resourceOwner = generateId();

      await pool.query(
        `INSERT INTO projections.action_flows (
          flow_type, trigger_type, action_id, instance_id, resource_owner, trigger_sequence, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['pre_creation', 'user.created', actionId, TEST_INSTANCE_ID, resourceOwner, 1, 1]
      );

      await pool.query(
        `INSERT INTO projections.action_flows (
          flow_type, trigger_type, action_id, instance_id, resource_owner, trigger_sequence, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['post_creation', 'user.created', actionId, TEST_INSTANCE_ID, resourceOwner, 2, 2]
      );

      const results = await pool.query(
        'SELECT * FROM projections.action_flows WHERE instance_id = $1 AND action_id = $2 ORDER BY trigger_sequence',
        [TEST_INSTANCE_ID, actionId]
      );

      expect(results.rows.length).toBe(2);
      expect(results.rows[0].flow_type).toBe('pre_creation');
      expect(results.rows[1].flow_type).toBe('post_creation');
    });
  });

  describe('Executions Table', () => {
    it('should insert and query executions', async () => {
      const executionId = generateId();
      const resourceOwner = generateId();

      await pool.query(
        `INSERT INTO projections.executions (
          id, instance_id, resource_owner, creation_date, change_date, sequence, execution_type, targets, state
        ) VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6, $7)`,
        [executionId, TEST_INSTANCE_ID, resourceOwner, 1, 4, JSON.stringify([{type: 1, target: 'webhook-1'}]), 1]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.executions WHERE instance_id = $1 AND id = $2',
        [TEST_INSTANCE_ID, executionId]
      );

      expect(result).toBeDefined();
      expect(result.resource_owner).toBe(resourceOwner);
      expect(result.execution_type).toBe(4); // EVENT type
      expect(result.state).toBe(1); // ACTIVE
      // targets is already an array if stored as JSONB, or needs parsing if TEXT
      const targets = typeof result.targets === 'string' ? JSON.parse(result.targets) : result.targets;
      expect(targets).toHaveLength(1);
      expect(targets[0].target).toBe('webhook-1');
    });

    it('should track execution history for resource owner', async () => {
      const resourceOwner = generateId();
      const execution1 = generateId();
      const execution2 = generateId();

      await pool.query(
        `INSERT INTO projections.executions (
          id, instance_id, resource_owner, creation_date, change_date, sequence, execution_type, targets, state
        ) VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6, $7)`,
        [execution1, TEST_INSTANCE_ID, resourceOwner, 1, 4, JSON.stringify([]), 1]
      );

      await pool.query(
        `INSERT INTO projections.executions (
          id, instance_id, resource_owner, creation_date, change_date, sequence, execution_type, targets, state
        ) VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6, $7)`,
        [execution2, TEST_INSTANCE_ID, resourceOwner, 2, 4, JSON.stringify([]), 1]
      );

      const results = await pool.query(
        'SELECT * FROM projections.executions WHERE instance_id = $1 AND resource_owner = $2 ORDER BY sequence',
        [TEST_INSTANCE_ID, resourceOwner]
      );

      expect(results.rows.length).toBe(2);
      expect(Number(results.rows[0].sequence)).toBe(1);
      expect(Number(results.rows[1].sequence)).toBe(2);
    });
  });

  describe('Execution States Table', () => {
    it('should insert and query execution states', async () => {
      const executionId = generateId();
      const targetId = 'webhook-1';

      await pool.query(
        `INSERT INTO projections.execution_states (
          execution_id, instance_id, target_id, state, retry_count
        ) VALUES ($1, $2, $3, $4, $5)`,
        [executionId, TEST_INSTANCE_ID, targetId, 0, 0]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.execution_states WHERE instance_id = $1 AND execution_id = $2',
        [TEST_INSTANCE_ID, executionId]
      );

      expect(result).toBeDefined();
      expect(result.execution_id).toBe(executionId);
      expect(result.target_id).toBe(targetId);
      expect(result.state).toBe(0);
      expect(result.retry_count).toBe(0);
    });

    it('should track retry attempts', async () => {
      const executionId = generateId();
      const targetId = 'failing-webhook';

      await pool.query(
        `INSERT INTO projections.execution_states (
          execution_id, instance_id, target_id, state, retry_count
        ) VALUES ($1, $2, $3, $4, $5)`,
        [executionId, TEST_INSTANCE_ID, targetId, 1, 3]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.execution_states WHERE instance_id = $1 AND execution_id = $2',
        [TEST_INSTANCE_ID, executionId]
      );

      expect(result.state).toBe(1); // Failed state
      expect(result.retry_count).toBe(3);
    });
  });
});
