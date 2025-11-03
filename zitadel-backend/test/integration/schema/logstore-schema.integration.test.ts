/**
 * Logstore Schema Integration Tests
 * Tests logstore tables: logs, execution_logs, quota_logs
 * No query models yet - direct schema testing
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { DatabaseMigrator } from '../../../src/lib/database/migrator';
import { generateId } from '../../../src/lib/id';

describe('Logstore Schema Integration Tests', () => {
  let pool: DatabasePool;
  const TEST_INSTANCE_ID = `test-instance-${generateId()}`;

  beforeAll(async () => {
    pool = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('General Logs Table', () => {
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
      expect(result.log_date).toBeDefined();
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

    it('should support different log levels', async () => {
      const infoLog = generateId();
      const warnLog = generateId();
      const errorLog = generateId();

      // INFO (0)
      await pool.query(
        `INSERT INTO logstore.logs (
          instance_id, log_id, aggregate_type, aggregate_id, resource_owner, log_level, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [TEST_INSTANCE_ID, infoLog, 'user', generateId(), 'owner1', 0, 'Info message']
      );

      // WARN (1)
      await pool.query(
        `INSERT INTO logstore.logs (
          instance_id, log_id, aggregate_type, aggregate_id, resource_owner, log_level, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [TEST_INSTANCE_ID, warnLog, 'user', generateId(), 'owner1', 1, 'Warning message']
      );

      // ERROR (2)
      await pool.query(
        `INSERT INTO logstore.logs (
          instance_id, log_id, aggregate_type, aggregate_id, resource_owner, log_level, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [TEST_INSTANCE_ID, errorLog, 'user', generateId(), 'owner1', 2, 'Error message']
      );

      // Query error logs only
      const errorLogs = await pool.query(
        'SELECT * FROM logstore.logs WHERE instance_id = $1 AND log_level = 2',
        [TEST_INSTANCE_ID]
      );

      expect(errorLogs.rows.length).toBeGreaterThanOrEqual(1);
      expect(errorLogs.rows.every((r: any) => r.log_level === 2)).toBe(true);
    });

    it('should enforce multi-tenant isolation', async () => {
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

  describe('Execution Logs Table', () => {
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
      expect(result.target_id).toBe('target1');
      expect(result.log_level).toBe(2);
    });

    it('should track execution logs for specific execution', async () => {
      const executionId = generateId();
      const log1 = generateId();
      const log2 = generateId();

      await pool.query(
        `INSERT INTO logstore.execution_logs (
          instance_id, log_id, execution_id, target_id, log_level, message
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [TEST_INSTANCE_ID, log1, executionId, 'webhook1', 0, 'Started']
      );

      await pool.query(
        `INSERT INTO logstore.execution_logs (
          instance_id, log_id, execution_id, target_id, log_level, message
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [TEST_INSTANCE_ID, log2, executionId, 'webhook1', 2, 'Failed']
      );

      const results = await pool.query(
        'SELECT * FROM logstore.execution_logs WHERE instance_id = $1 AND execution_id = $2 ORDER BY log_date',
        [TEST_INSTANCE_ID, executionId]
      );

      expect(results.rows.length).toBe(2);
      expect(results.rows[0].message).toBe('Started');
      expect(results.rows[1].message).toBe('Failed');
    });

    it('should support error details in JSONB', async () => {
      const logId = generateId();
      const executionId = generateId();
      const errorDetails = {
        code: 'WEBHOOK_TIMEOUT',
        url: 'https://example.com/webhook',
        timeout_ms: 5000,
        attempts: 3
      };

      await pool.query(
        `INSERT INTO logstore.execution_logs (
          instance_id, log_id, execution_id, target_id, log_level, message, error_details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [TEST_INSTANCE_ID, logId, executionId, 'webhook', 2, 'Timeout error', JSON.stringify(errorDetails)]
      );

      const result = await pool.queryOne(
        'SELECT * FROM logstore.execution_logs WHERE instance_id = $1 AND log_id = $2',
        [TEST_INSTANCE_ID, logId]
      );

      expect(result.error_details).toBeDefined();
      const parsedDetails = typeof result.error_details === 'string' 
        ? JSON.parse(result.error_details) 
        : result.error_details;
      expect(parsedDetails.code).toBe('WEBHOOK_TIMEOUT');
      expect(parsedDetails.attempts).toBe(3);
    });
  });

  describe('Quota Logs Table', () => {
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
      expect(Number(result.current_usage)).toBe(100);
      expect(Number(result.quota_limit)).toBe(100);
      expect(result.allowed).toBe(true);
    });

    it('should track quota violations', async () => {
      const quotaId = generateId();
      const log1 = generateId();
      const log2 = generateId();

      // Approaching limit (allowed)
      await pool.query(
        `INSERT INTO logstore.quota_logs (
          instance_id, log_id, quota_id, previous_usage, current_usage, quota_limit, resource_owner, allowed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [TEST_INSTANCE_ID, log1, quotaId, 80, 95, 100, 'owner1', true]
      );

      // Over limit (blocked)
      await pool.query(
        `INSERT INTO logstore.quota_logs (
          instance_id, log_id, quota_id, previous_usage, current_usage, quota_limit, resource_owner, allowed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [TEST_INSTANCE_ID, log2, quotaId, 95, 105, 100, 'owner1', false]
      );

      // Query violations only
      const violations = await pool.query(
        'SELECT * FROM logstore.quota_logs WHERE instance_id = $1 AND allowed = false',
        [TEST_INSTANCE_ID]
      );

      expect(violations.rows.length).toBeGreaterThanOrEqual(1);
      expect(violations.rows.every((r: any) => r.allowed === false)).toBe(true);
    });

    it('should track quota usage history', async () => {
      const quotaId = generateId();

      for (let i = 0; i < 5; i++) {
        await pool.query(
          `INSERT INTO logstore.quota_logs (
            instance_id, log_id, quota_id, previous_usage, current_usage, quota_limit, resource_owner, allowed
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [TEST_INSTANCE_ID, generateId(), quotaId, i * 20, (i + 1) * 20, 100, 'owner1', true]
        );
      }

      const history = await pool.query(
        'SELECT * FROM logstore.quota_logs WHERE instance_id = $1 AND quota_id = $2 ORDER BY log_date',
        [TEST_INSTANCE_ID, quotaId]
      );

      expect(history.rows.length).toBe(5);
      expect(Number(history.rows[0].current_usage)).toBe(20);
      expect(Number(history.rows[4].current_usage)).toBe(100);
    });
  });
});
