/**
 * Integration tests for Future Enhancements
 * Tests actions, logstore, and milestones tables
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { generateId } from '../../../src/lib/id';

describe('Future Enhancements Integration Tests', () => {
  let pool: DatabasePool;
  const TEST_INSTANCE_ID = `test-instance-${generateId()}`;

  beforeAll(async () => {
    pool = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Actions Tables', () => {
    it('should insert and query actions', async () => {
      const actionId = generateId();
      const resourceOwner = generateId();

      await pool.query(
        `INSERT INTO projections.actions (
          id, instance_id, resource_owner, name, script, timeout, allowed_to_fail, state, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [actionId, TEST_INSTANCE_ID, resourceOwner, 'test-action', 'console.log("test")', '10 seconds', false, 1, 1]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.actions WHERE instance_id = $1 AND id = $2',
        [TEST_INSTANCE_ID, actionId]
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(actionId);
      expect(result.name).toBe('test-action');
      expect(result.state).toBe(1);
    });

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
    });

    it('should insert and query executions', async () => {
      const executionId = generateId();
      const actionId = generateId();
      const aggregateId = generateId();

      await pool.query(
        `INSERT INTO projections.executions (
          id, instance_id, aggregate_type, aggregate_id, action_id, event_type, event_sequence, targets
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [executionId, TEST_INSTANCE_ID, 'user', aggregateId, actionId, 'user.created', 1, JSON.stringify(['webhook'])]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.executions WHERE instance_id = $1 AND id = $2',
        [TEST_INSTANCE_ID, executionId]
      );

      expect(result).toBeDefined();
      expect(result.action_id).toBe(actionId);
      expect(result.event_type).toBe('user.created');
    });

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
      expect(result.state).toBe(0);
      expect(result.retry_count).toBe(0);
    });

    it('should enforce multi-tenant isolation for actions', async () => {
      const actionId = generateId();
      const otherInstance = `other-instance-${generateId()}`;

      await pool.query(
        `INSERT INTO projections.actions (
          id, instance_id, resource_owner, name, script, state, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [actionId, TEST_INSTANCE_ID, 'owner1', 'action1', 'script1', 1, 1]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.actions WHERE instance_id = $1 AND id = $2',
        [otherInstance, actionId]
      );

      expect(result).toBeNull();
    });
  });

  describe('Logstore Tables', () => {
    it('should insert and query logs', async () => {
      const logId = generateId();
      const aggregateId = generateId();

      await pool.query(
        `INSERT INTO logstore.logs (
          instance_id, log_id, aggregate_type, aggregate_id, resource_owner, log_level, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [TEST_INSTANCE_ID, logId, 'user', aggregateId, 'owner1', 1, 'Test log message']
      );

      const result = await pool.queryOne(
        'SELECT * FROM logstore.logs WHERE instance_id = $1 AND log_id = $2',
        [TEST_INSTANCE_ID, logId]
      );

      expect(result).toBeDefined();
      expect(result.aggregate_type).toBe('user');
      expect(result.message).toBe('Test log message');
      expect(result.log_level).toBe(1);
    });

    it('should insert and query execution logs', async () => {
      const logId = generateId();
      const executionId = generateId();

      await pool.query(
        `INSERT INTO logstore.execution_logs (
          instance_id, log_id, execution_id, target_id, log_level, message
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [TEST_INSTANCE_ID, logId, executionId, 'target1', 2, 'Execution warning']
      );

      const result = await pool.queryOne(
        'SELECT * FROM logstore.execution_logs WHERE instance_id = $1 AND log_id = $2',
        [TEST_INSTANCE_ID, logId]
      );

      expect(result).toBeDefined();
      expect(result.execution_id).toBe(executionId);
      expect(result.message).toBe('Execution warning');
    });

    it('should insert and query quota logs', async () => {
      const logId = generateId();
      const quotaId = generateId();

      await pool.query(
        `INSERT INTO logstore.quota_logs (
          instance_id, log_id, quota_id, previous_usage, current_usage, quota_limit, resource_owner, allowed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [TEST_INSTANCE_ID, logId, quotaId, 90, 100, 100, 'owner1', true]
      );

      const result = await pool.queryOne(
        'SELECT * FROM logstore.quota_logs WHERE instance_id = $1 AND log_id = $2',
        [TEST_INSTANCE_ID, logId]
      );

      expect(result).toBeDefined();
      expect(result.quota_id).toBe(quotaId);
      expect(result.current_usage).toBe('100');
      expect(result.allowed).toBe(true);
    });

    it('should query logs by date range', async () => {
      const logId1 = generateId();
      const logId2 = generateId();

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO logstore.logs (
          instance_id, log_id, log_date, aggregate_type, aggregate_id, resource_owner, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [TEST_INSTANCE_ID, logId1, yesterday, 'user', generateId(), 'owner1', 'Old log']
      );

      await pool.query(
        `INSERT INTO logstore.logs (
          instance_id, log_id, log_date, aggregate_type, aggregate_id, resource_owner, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [TEST_INSTANCE_ID, logId2, now, 'user', generateId(), 'owner1', 'New log']
      );

      const results = await pool.query(
        `SELECT * FROM logstore.logs 
         WHERE instance_id = $1 AND log_date >= $2 
         ORDER BY log_date DESC`,
        [TEST_INSTANCE_ID, yesterday]
      );

      expect(results.rows.length).toBeGreaterThanOrEqual(2);
    });

    it('should enforce multi-tenant isolation for logs', async () => {
      const logId = generateId();
      const otherInstance = `other-instance-${generateId()}`;

      await pool.query(
        `INSERT INTO logstore.logs (
          instance_id, log_id, aggregate_type, aggregate_id, resource_owner, message
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [TEST_INSTANCE_ID, logId, 'user', generateId(), 'owner1', 'Test']
      );

      const result = await pool.queryOne(
        'SELECT * FROM logstore.logs WHERE instance_id = $1 AND log_id = $2',
        [otherInstance, logId]
      );

      expect(result).toBeNull();
    });
  });

  describe('Milestones Table', () => {
    it('should insert and query milestones', async () => {
      const milestoneId = generateId();
      const aggregateId = generateId();

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [milestoneId, TEST_INSTANCE_ID, 2, 'organization', aggregateId, 'org_created', 1]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.milestones WHERE instance_id = $1 AND id = $2',
        [TEST_INSTANCE_ID, milestoneId]
      );

      expect(result).toBeDefined();
      expect(result.milestone_type).toBe(2);
      expect(result.name).toBe('org_created');
      expect(result.reached_date).toBeNull();
    });

    it('should update milestone reached date', async () => {
      const milestoneId = generateId();
      const aggregateId = generateId();
      const reachedDate = new Date();

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [milestoneId, TEST_INSTANCE_ID, 1, 'instance', aggregateId, 'instance_created', 1]
      );

      await pool.query(
        `UPDATE projections.milestones SET reached_date = $1 WHERE instance_id = $2 AND id = $3`,
        [reachedDate, TEST_INSTANCE_ID, milestoneId]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.milestones WHERE instance_id = $1 AND id = $2',
        [TEST_INSTANCE_ID, milestoneId]
      );

      expect(result).toBeDefined();
      expect(result.reached_date).not.toBeNull();
    });

    it('should query unreached milestones', async () => {
      const reachedId = generateId();
      const unreachedId = generateId();

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, reached_date, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [reachedId, TEST_INSTANCE_ID, 4, 'user', generateId(), 'user_created', new Date(), 1]
      );

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [unreachedId, TEST_INSTANCE_ID, 4, 'user', generateId(), 'user_email_verified', 1]
      );

      const results = await pool.query(
        `SELECT * FROM projections.milestones 
         WHERE instance_id = $1 AND reached_date IS NULL`,
        [TEST_INSTANCE_ID]
      );

      expect(results.rows.length).toBeGreaterThanOrEqual(1);
      expect(results.rows.some((r: any) => r.id === unreachedId)).toBe(true);
    });

    it('should query milestones by type', async () => {
      const orgMilestoneId = generateId();
      const userMilestoneId = generateId();

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orgMilestoneId, TEST_INSTANCE_ID, 2, 'organization', generateId(), 'org_custom_domain', 1]
      );

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userMilestoneId, TEST_INSTANCE_ID, 4, 'user', generateId(), 'user_mfa_enabled', 1]
      );

      const orgResults = await pool.query(
        `SELECT * FROM projections.milestones 
         WHERE instance_id = $1 AND milestone_type = $2`,
        [TEST_INSTANCE_ID, 2]
      );

      expect(orgResults.rows.length).toBeGreaterThanOrEqual(1);
      expect(orgResults.rows.every((r: any) => r.milestone_type === 2)).toBe(true);
    });

    it('should enforce multi-tenant isolation for milestones', async () => {
      const milestoneId = generateId();
      const otherInstance = `other-instance-${generateId()}`;

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [milestoneId, TEST_INSTANCE_ID, 1, 'instance', generateId(), 'test_milestone', 1]
      );

      const result = await pool.queryOne(
        'SELECT * FROM projections.milestones WHERE instance_id = $1 AND id = $2',
        [otherInstance, milestoneId]
      );

      expect(result).toBeNull();
    });
  });

  describe('Reference Views', () => {
    it('should query milestone types view', async () => {
      const results = await pool.query('SELECT * FROM projections.milestone_types');
      
      expect(results.rows.length).toBe(4);
      expect(results.rows.some((r: any) => r.type_name === 'INSTANCE')).toBe(true);
      expect(results.rows.some((r: any) => r.type_name === 'ORGANIZATION')).toBe(true);
      expect(results.rows.some((r: any) => r.type_name === 'PROJECT')).toBe(true);
      expect(results.rows.some((r: any) => r.type_name === 'USER')).toBe(true);
    });

    it('should query common milestones view', async () => {
      const results = await pool.query('SELECT * FROM projections.common_milestones');
      
      expect(results.rows.length).toBeGreaterThan(0);
      expect(results.rows.some((r: any) => r.milestone_name === 'org_created')).toBe(true);
      expect(results.rows.some((r: any) => r.milestone_name === 'user_email_verified')).toBe(true);
    });
  });
});
