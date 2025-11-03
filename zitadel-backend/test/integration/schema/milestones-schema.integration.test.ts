/**
 * Milestones Schema Integration Tests
 * Tests milestones table and reference views
 * Uses MilestoneQueries query model
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { DatabaseMigrator } from '../../../src/lib/database/migrator';
import { MilestoneQueries } from '../../../src/lib/query/milestone/milestone-queries';
import { generateId } from '../../../src/lib/id';

describe('Milestones Schema Integration Tests', () => {
  let pool: DatabasePool;
  let milestoneQueries: MilestoneQueries;
  const TEST_INSTANCE_ID = `test-instance-${generateId()}`;

  beforeAll(async () => {
    pool = await createTestDatabase();
    
    // Initialize query layer
    milestoneQueries = new MilestoneQueries(pool);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Milestones Table via Query Model', () => {
    it('should insert and query milestone via query model', async () => {
      const milestoneId = generateId();
      const aggregateId = generateId();

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [milestoneId, TEST_INSTANCE_ID, 2, 'organization', aggregateId, 'org_created', 1]
      );

      // Use query model
      const milestone = await milestoneQueries.getMilestoneById(TEST_INSTANCE_ID, milestoneId);

      expect(milestone).toBeDefined();
      expect(milestone!.id).toBe(milestoneId);
      expect(milestone!.milestoneType).toBe(2);
      expect(milestone!.name).toBe('org_created');
      expect(milestone!.aggregateType).toBe('organization');
      expect(milestone!.reachedDate).toBeNull();
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

      const milestone = await milestoneQueries.getMilestoneById(TEST_INSTANCE_ID, milestoneId);

      expect(milestone!.reachedDate).not.toBeNull();
      expect(milestone!.reachedDate!.getTime()).toBeCloseTo(reachedDate.getTime(), -2);
    });

    it('should query milestones by type via query model', async () => {
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

      // Query by type using query model
      const orgMilestones = await milestoneQueries.getMilestonesByType(TEST_INSTANCE_ID, 2);

      expect(orgMilestones.length).toBeGreaterThanOrEqual(1);
      expect(orgMilestones.every(m => m.milestoneType === 2)).toBe(true);
    });

    it('should query milestones by aggregate via query model', async () => {
      const aggregateId = generateId();
      const milestone1Id = generateId();
      const milestone2Id = generateId();

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [milestone1Id, TEST_INSTANCE_ID, 4, 'user', aggregateId, 'user_created', 1]
      );

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [milestone2Id, TEST_INSTANCE_ID, 4, 'user', aggregateId, 'user_email_verified', 2]
      );

      // Query by aggregate using query model
      const milestones = await milestoneQueries.getMilestonesByAggregate(TEST_INSTANCE_ID, aggregateId);

      expect(milestones.length).toBe(2);
      expect(milestones.every(m => m.aggregateId === aggregateId)).toBe(true);
    });

    it('should enforce multi-tenant isolation', async () => {
      const milestoneId = generateId();
      const otherInstance = `other-instance-${generateId()}`;

      await pool.query(
        `INSERT INTO projections.milestones (
          id, instance_id, milestone_type, aggregate_type, aggregate_id, name, sequence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [milestoneId, TEST_INSTANCE_ID, 1, 'instance', generateId(), 'test_milestone', 1]
      );

      // Query with different instance should return null
      const milestone = await milestoneQueries.getMilestoneById(otherInstance, milestoneId);
      expect(milestone).toBeNull();
    });
  });

  describe('Milestone Reference Views', () => {
    it('should query milestone types view', async () => {
      const results = await pool.query('SELECT * FROM projections.milestone_types ORDER BY type_id');
      
      expect(results.rows.length).toBe(4);
      expect(results.rows[0].type_name).toBe('INSTANCE');
      expect(results.rows[1].type_name).toBe('ORGANIZATION');
      expect(results.rows[2].type_name).toBe('PROJECT');
      expect(results.rows[3].type_name).toBe('USER');
    });

    it('should query common milestones view', async () => {
      const results = await pool.query('SELECT * FROM projections.common_milestones');
      
      expect(results.rows.length).toBeGreaterThan(0);
      
      // Verify specific milestones exist
      const milestoneNames = results.rows.map((r: any) => r.milestone_name);
      expect(milestoneNames).toContain('org_created');
      expect(milestoneNames).toContain('user_email_verified');
      expect(milestoneNames).toContain('instance_created');
      expect(milestoneNames).toContain('project_created');
    });

    it('should have correct milestone types in view', async () => {
      const results = await pool.query(
        `SELECT * FROM projections.common_milestones WHERE milestone_name = 'org_created'`
      );
      
      expect(results.rows.length).toBe(1);
      expect(results.rows[0].milestone_type).toBe(2); // ORGANIZATION
      expect(results.rows[0].aggregate_type).toBe('organization');
    });

    it('should have all user milestones in view', async () => {
      const results = await pool.query(
        `SELECT * FROM projections.common_milestones WHERE milestone_type = 4`
      );
      
      expect(results.rows.length).toBeGreaterThanOrEqual(2);
      const milestoneNames = results.rows.map((r: any) => r.milestone_name);
      expect(milestoneNames).toContain('user_created');
      expect(milestoneNames).toContain('user_email_verified');
    });
  });
});
