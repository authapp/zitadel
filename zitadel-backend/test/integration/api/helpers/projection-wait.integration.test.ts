/**
 * ProjectionWaitHelper Integration Tests
 * 
 * Tests the projection synchronization helper that replaces setTimeout
 * Tests complete flow: Command → Event → Projection → Wait → Verify
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { ProjectionWaitHelper } from '../../../../src/api/helpers/projection-wait';
import { UserProjection } from '../../../../src/lib/query/projections/user-projection';
import { OrgProjection } from '../../../../src/lib/query/projections/org-projection';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { OrgQueries } from '../../../../src/lib/query/org/org-queries';

describe('ProjectionWaitHelper Integration Tests', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let projectionWait: ProjectionWaitHelper;
  let userProjection: UserProjection;
  let orgProjection: OrgProjection;
  let userQueries: UserQueries;
  let orgQueries: OrgQueries;

  const TEST_INSTANCE_ID = 'test-instance';
  const TEST_ORG_ID = 'test-org';

  beforeAll(async () => {
    // Setup database
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();

    // Setup command infrastructure
    ctx = await setupCommandTest(pool);

    // Initialize projections
    userProjection = new UserProjection(ctx.eventstore, pool);
    await userProjection.init();
    await userProjection.start();

    orgProjection = new OrgProjection(ctx.eventstore, pool);
    await orgProjection.init();
    await orgProjection.start();

    // Initialize queries
    userQueries = new UserQueries(pool);
    orgQueries = new OrgQueries(pool);

    // Initialize projection wait helper
    projectionWait = new ProjectionWaitHelper(ctx.eventstore, pool);
  });

  afterAll(async () => {
    if (userProjection) await userProjection.stop();
    if (orgProjection) await orgProjection.stop();
    await closeTestDatabase();
  });

  // Helper function to manually process projections
  async function processUserProjection(aggregateID: string) {
    const events = await ctx.getEvents('user', aggregateID);
    for (const event of events) {
      await userProjection.reduce(event);
      await userProjection.setCurrentPosition(
        event.position.position,
        event.position.inTxOrder ?? 0,
        event.createdAt,
        event.instanceID,
        event.aggregateType,
        event.aggregateID
      );
    }
  }

  async function processOrgProjection(aggregateID: string) {
    const events = await ctx.getEvents('org', aggregateID);
    for (const event of events) {
      await orgProjection.reduce(event);
      await orgProjection.setCurrentPosition(
        event.position.position,
        event.position.inTxOrder ?? 0,
        event.createdAt,
        event.instanceID,
        event.aggregateType,
        event.aggregateID
      );
    }
  }

  describe('waitForProjection', () => {
    it('should wait for single projection to catch up', async () => {
      const context = {
        instanceID: TEST_INSTANCE_ID,
        orgID: TEST_ORG_ID,
        userID: 'admin',
      };

      // Create a user (generates events)
      const result = await ctx.commands.addHumanUser(context, {
        orgID: TEST_ORG_ID,
        username: 'testuser1',
        email: 'test1@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      console.log('✓ User created, waiting for projection...');

      // Manually trigger projection processing
      await processUserProjection(result.userID);

      console.log('✓ Projection manually processed');

      // Wait for user projection to catch up (should be immediate now)
      await projectionWait.waitForProjection('user_projection', 3000);

      console.log('✓ Projection caught up');

      // Verify user is now queryable
      const user = await userQueries.getUserByID(result.userID, TEST_INSTANCE_ID);
      expect(user).toBeDefined();
      expect(user!.username).toBe('testuser1');
    }, 10000); // Increase Jest timeout to 10s

    it('should return immediately if projection is already caught up', async () => {
      const startTime = Date.now();

      // Wait for projection (should be instant since no new events)
      await projectionWait.waitForProjection('user_projection', 2000);

      const duration = Date.now() - startTime;

      // Should complete very quickly (< 200ms)
      expect(duration).toBeLessThan(200);
      console.log(`✓ Completed in ${duration}ms`);
    });

    it('should throw error if projection does not catch up within timeout', async () => {
      // Use a very short timeout for a projection that doesn't exist
      await expect(
        projectionWait.waitForProjection('non_existent_projection', 100)
      ).rejects.toThrow();
    });

    it('should handle multiple sequential waits', async () => {
      const context = {
        instanceID: TEST_INSTANCE_ID,
        orgID: TEST_ORG_ID,
        userID: 'admin',
      };

      // Create user 1
      const result1 = await ctx.commands.addHumanUser(context, {
        orgID: TEST_ORG_ID,
        username: 'user2',
        email: 'user2@example.com',
        firstName: 'User',
        lastName: 'Two',
      });

      await processUserProjection(result1.userID);
      await projectionWait.waitForProjection('user_projection', 2000);

      // Create user 2
      const result2 = await ctx.commands.addHumanUser(context, {
        orgID: TEST_ORG_ID,
        username: 'user3',
        email: 'user3@example.com',
        firstName: 'User',
        lastName: 'Three',
      });

      await processUserProjection(result2.userID);
      await projectionWait.waitForProjection('user_projection', 2000);

      // Both users should be queryable
      const user1 = await userQueries.getUserByID(result1.userID, TEST_INSTANCE_ID);
      const user2 = await userQueries.getUserByID(result2.userID, TEST_INSTANCE_ID);

      expect(user1).toBeDefined();
      expect(user2).toBeDefined();
    });
  });

  describe('waitForProjections', () => {
    it('should wait for multiple projections to catch up', async () => {
      const context = {
        instanceID: TEST_INSTANCE_ID,
        orgID: TEST_ORG_ID,
        userID: 'admin',
      };

      // Create operations that affect both projections
      const orgResult = await ctx.commands.setupOrg(context, {
        name: 'Test Org',
        admins: [{
          username: 'orgadmin',
          email: 'admin@testorg.com',
          firstName: 'Admin',
          lastName: 'User',
        }],
      });

      console.log('✓ Created org and admin user');

      // Manually process projections
      await processOrgProjection(orgResult.orgID);
      await processUserProjection(orgResult.createdAdmins[0].userID);

      // Wait for both projections
      await projectionWait.waitForProjections(
        ['user_projection', 'org_projection'],
        2000
      );

      console.log('✓ Both projections caught up');

      // Verify both are queryable
      const org = await orgQueries.getOrgByID(orgResult.orgID, TEST_INSTANCE_ID);
      const user = await userQueries.getUserByID(orgResult.createdAdmins[0].userID, TEST_INSTANCE_ID);

      expect(org).toBeDefined();
      expect(user).toBeDefined();
    });

    it('should handle empty projection list', async () => {
      // Should not throw, just return
      await projectionWait.waitForProjections([], 1000);
    });

    it('should throw if any projection times out', async () => {
      // One valid, one invalid - should throw
      await expect(
        projectionWait.waitForProjections(
          ['user_projection', 'invalid_projection'],
          100
        )
      ).rejects.toThrow();
    });
  });

  describe('isProjectionHealthy', () => {
    it('should return true for healthy projection with low lag', async () => {
      const isHealthy = await projectionWait.isProjectionHealthy(
        'user_projection',
        5000 // 5 second max lag
      );

      expect(isHealthy).toBe(true);
    });

    it('should return false for projection with high lag', async () => {
      // Create a projection state with very old position
      await pool.query(`
        INSERT INTO projections.projection_states 
        (name, position, position_offset, updated_at, event_timestamp, instance_id)
        VALUES ($1, $2, $3, NOW() - INTERVAL '10 seconds', NOW() - INTERVAL '10 seconds', $4)
        ON CONFLICT (name)
        DO UPDATE SET position = $2, updated_at = NOW() - INTERVAL '10 seconds'
      `, ['old_projection', 100, 0, TEST_INSTANCE_ID]);

      const isHealthy = await projectionWait.isProjectionHealthy(
        'old_projection',
        1000 // 1 second max lag - should fail
      );

      // Projection is way behind, should be unhealthy
      expect(isHealthy).toBe(false);
    });

    it('should return false for non-existent projection', async () => {
      const isHealthy = await projectionWait.isProjectionHealthy(
        'non_existent_projection',
        5000
      );

      expect(isHealthy).toBe(false);
    });
  });

  describe('Real-world scenario: SCIM-like operations', () => {
    it('should handle rapid user updates with projection sync', async () => {
      const context = {
        instanceID: TEST_INSTANCE_ID,
        orgID: TEST_ORG_ID,
        userID: 'admin',
      };

      // Create user
      const result = await ctx.commands.addHumanUser(context, {
        orgID: TEST_ORG_ID,
        username: 'rapiduser',
        email: 'rapid@example.com',
        firstName: 'Rapid',
        lastName: 'User',
      });

      // Manually process and wait for projection (like SCIM does)
      await processUserProjection(result.userID);
      await projectionWait.waitForProjection('user_projection', 2000);

      // Update username
      await ctx.commands.changeUsername(context, result.userID, TEST_ORG_ID, 'rapiduser2');

      // Manually process and wait again
      await processUserProjection(result.userID);
      await projectionWait.waitForProjection('user_projection', 2000);

      // Verify final state
      const user = await userQueries.getUserByID(result.userID, TEST_INSTANCE_ID);
      expect(user!.username).toBe('rapiduser2');

      console.log('✓ Rapid updates with projection sync successful');
    });

    it('should be faster than fixed setTimeout (performance test)', async () => {
      const context = {
        instanceID: TEST_INSTANCE_ID,
        orgID: TEST_ORG_ID,
        userID: 'admin',
      };

      // Measure projection wait time
      const waitStart = Date.now();
      
      const result = await ctx.commands.addHumanUser(context, {
        orgID: TEST_ORG_ID,
        username: 'perfuser',
        email: 'perf@example.com',
        firstName: 'Perf',
        lastName: 'User',
      });

      await processUserProjection(result.userID);
      await projectionWait.waitForProjection('user_projection', 2000);
      
      const waitDuration = Date.now() - waitStart;

      // Should typically complete in < 100ms (vs 100ms fixed setTimeout)
      // Being lenient with 500ms max for CI environments
      expect(waitDuration).toBeLessThan(500);

      console.log(`✓ Projection wait completed in ${waitDuration}ms (vs 100ms setTimeout)`);

      // Verify data is ready
      const user = await userQueries.getUserByID(result.userID, TEST_INSTANCE_ID);
      expect(user).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should provide meaningful error on timeout', async () => {
      const context = {
        instanceID: TEST_INSTANCE_ID,
        orgID: TEST_ORG_ID,
        userID: 'admin',
      };

      // Create user but use impossibly short timeout
      await ctx.commands.addHumanUser(context, {
        orgID: TEST_ORG_ID,
        username: 'timeoutuser',
        email: 'timeout@example.com',
        firstName: 'Timeout',
        lastName: 'User',
      });

      try {
        await projectionWait.waitForProjection('user_projection', 1); // 1ms timeout
        throw new Error('Should have thrown timeout error');
      } catch (error: any) {
        expect(error.message).toContain('Timeout');
        expect(error.message).toContain('user_projection');
        console.log(`✓ Got expected error: ${error.message}`);
      }
    });
  });
});
