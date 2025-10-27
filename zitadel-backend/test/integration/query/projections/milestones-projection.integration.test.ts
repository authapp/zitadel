/**
 * Integration tests for Milestones Projection
 * Tests milestone tracking and achievement events
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { MilestonesProjection, createMilestonesProjectionConfig } from '../../../../src/lib/query/projections/milestones-projection';
import { MilestoneQueries } from '../../../../src/lib/query/milestone/milestone-queries';
import { generateId } from '../../../../src/lib/id';

describe('Milestones Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let milestoneQueries: MilestoneQueries;

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

    const config = createMilestonesProjectionConfig();
    config.interval = 50;
    registry.register(config, new MilestonesProjection(eventstore, pool));

    await registry.start('milestones_projection');

    // Initialize query layer
    milestoneQueries = new MilestoneQueries(pool);
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
    await pool.query('DELETE FROM projections.milestones WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  const waitForProjection = (ms: number = 300) =>
    new Promise(resolve => setTimeout(resolve, ms));

  describe('Direct Milestone Events', () => {
    it('should process milestone.pushed event', async () => {
      const milestoneId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'instance',
        aggregateID: TEST_INSTANCE_ID,
        eventType: 'milestone.pushed',
        payload: {
          id: milestoneId,
          type: 'instance_created',
          primaryDomain: 'example.com',
        },
        creator: 'system',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await milestoneQueries.getMilestoneById(TEST_INSTANCE_ID, milestoneId);

      expect(result).toBeDefined();
      expect(result!.name).toBe('instance_created');
      expect(result!.milestoneType).toBe(1); // instance
      expect(result!.pushedDate).not.toBeNull();
      expect(result!.reachedDate).toBeNull();
    });

    it('should process milestone.reached event', async () => {
      const milestoneId = generateId();

      // First push the milestone
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: generateId(),
        eventType: 'milestone.pushed',
        payload: {
          id: milestoneId,
          type: 'org_smtp_configured',
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      // Then mark it as reached
      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: generateId(),
        eventType: 'milestone.reached',
        payload: {
          id: milestoneId,
          reachedDate: new Date(),
        },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const result = await milestoneQueries.getMilestoneById(TEST_INSTANCE_ID, milestoneId);

      expect(result!.reachedDate).not.toBeNull();
    });
  });

  describe('Auto-tracked Instance Milestones', () => {
    it('should track instance_created milestone on instance.added', async () => {
      const instanceId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'instance',
        aggregateID: instanceId,
        eventType: 'instance.added',
        payload: {},
        creator: 'system',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByName(TEST_INSTANCE_ID, 'instance_created');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].milestoneType).toBe(1);
      expect(results[0].reachedDate).not.toBeNull(); // Auto-reached
    });

    it('should track instance_custom_domain milestone on instance.domain.added', async () => {
      const instanceId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'instance',
        aggregateID: instanceId,
        eventType: 'instance.domain.added',
        payload: { domain: 'custom.example.com' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByName(TEST_INSTANCE_ID, 'instance_custom_domain');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-tracked Organization Milestones', () => {
    it('should track org_created milestone on org.added', async () => {
      const orgId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.added',
        payload: { name: 'Test Org' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByAggregate(TEST_INSTANCE_ID, orgId);
      const orgCreated = results.filter(m => m.name === 'org_created');

      expect(orgCreated.length).toBeGreaterThan(0);
      expect(orgCreated[0].milestoneType).toBe(2); // organization
      expect(orgCreated[0].reachedDate).not.toBeNull();
    });

    it('should track org_custom_domain milestone on org.domain.added', async () => {
      const orgId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.domain.added',
        payload: { domain: 'org.example.com' },
        creator: 'admin',
        owner: orgId,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByName(TEST_INSTANCE_ID, 'org_custom_domain');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-tracked Project Milestones', () => {
    it('should track project_created milestone on project.added', async () => {
      const projectId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'project',
        aggregateID: projectId,
        eventType: 'project.added',
        payload: { name: 'Test Project' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByAggregate(TEST_INSTANCE_ID, projectId);
      const projectCreated = results.filter(m => m.name === 'project_created');

      expect(projectCreated.length).toBeGreaterThan(0);
      expect(projectCreated[0].milestoneType).toBe(3); // project
    });

    it('should track project_app_added milestone', async () => {
      const projectId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'project',
        aggregateID: projectId,
        eventType: 'project.application.added',
        payload: { appId: generateId() },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByName(TEST_INSTANCE_ID, 'project_app_added');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-tracked User Milestones', () => {
    it('should track user_created milestone on user.added', async () => {
      const userId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.added',
        payload: { userName: 'testuser' },
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByAggregate(TEST_INSTANCE_ID, userId);
      const userCreated = results.filter(m => m.name === 'user_created');

      expect(userCreated.length).toBeGreaterThan(0);
      expect(userCreated[0].milestoneType).toBe(4); // user
    });

    it('should track user_email_verified milestone', async () => {
      const userId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.email.verified',
        payload: {},
        creator: 'system',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByName(TEST_INSTANCE_ID, 'user_email_verified');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should track user_mfa_enabled milestone', async () => {
      const userId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.mfa.otp.added',
        payload: {},
        creator: 'user',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByName(TEST_INSTANCE_ID, 'user_mfa_enabled');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should track user_first_login milestone on session.added', async () => {
      const userId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'session.added',
        payload: { userId: userId },
        creator: 'system',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByName(TEST_INSTANCE_ID, 'user_first_login');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup Events', () => {
    it('should delete milestones when org is removed', async () => {
      const orgId = generateId();

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.added',
        payload: {},
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      let results = await milestoneQueries.getMilestonesByAggregate(TEST_INSTANCE_ID, orgId);
      expect(results.length).toBeGreaterThan(0);

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.removed',
        payload: {},
        creator: 'admin',
        owner: orgId,
      });

      await waitForProjection();

      results = await milestoneQueries.getMilestonesByAggregate(TEST_INSTANCE_ID, orgId);
      expect(results.length).toBe(0);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate milestones by instance', async () => {
      const orgId = generateId();
      const otherInstance = `other-instance-${generateId()}`;

      await eventstore.push({
        instanceID: TEST_INSTANCE_ID,
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.added',
        payload: {},
        creator: 'admin',
        owner: TEST_INSTANCE_ID,
      });

      await waitForProjection();

      const results = await milestoneQueries.getMilestonesByAggregate(otherInstance, orgId);

      expect(results.length).toBe(0);
    });
  });

  describe('Idempotency', () => {
    it('should not create duplicate milestones', async () => {
      const userId = generateId();

      // Send same event twice
      for (let i = 0; i < 2; i++) {
        await eventstore.push({
          instanceID: TEST_INSTANCE_ID,
          aggregateType: 'user',
          aggregateID: userId,
          eventType: 'user.added',
          payload: {},
          creator: 'admin',
          owner: TEST_INSTANCE_ID,
        });
      }

      await waitForProjection(500);

      const results = await milestoneQueries.getMilestonesByAggregate(TEST_INSTANCE_ID, userId);
      const userCreated = results.filter(m => m.name === 'user_created');

      // Should only have one milestone despite two events
      expect(userCreated.length).toBe(1);
    });
  });
});
