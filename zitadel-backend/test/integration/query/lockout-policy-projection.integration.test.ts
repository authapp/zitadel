/**
 * Lockout Policy Projection Integration Tests
 * 
 * Tests the full flow: events -> projection -> database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabaseMigrator } from '../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { LockoutPolicyProjection } from '../../../src/lib/query/projections/lockout-policy-projection';
import { generateId as generateSnowflakeId } from '../../../src/lib/id/snowflake';

describe('Lockout Policy Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;

  beforeAll(async () => {
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register lockout policy projection
    const projection = new LockoutPolicyProjection(eventstore, pool);
    registry.register({
      name: 'lockout_policy_projection',
      tables: ['lockout_policies_projection'],
      eventTypes: [
        'org.lockout.policy.added',
        'org.lockout.policy.changed',
        'org.lockout.policy.removed',
        'instance.lockout.policy.added',
        'instance.lockout.policy.changed',
        'instance.lockout.policy.removed',
      ],
      aggregateTypes: ['org', 'instance'],
      batchSize: 100,
      interval: 50,
      enableLocking: false,
    }, projection);
    
    await registry.start('lockout_policy_projection');
  });

  afterAll(async () => {
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore if already stopped
      }
    }
    
    await closeTestDatabase();
  });

  describe('Organization Lockout Policy Events', () => {
    it('should process org.lockout.policy.added event', async () => {
      const orgID = generateSnowflakeId();
      const policyID = `policy_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'org.lockout.policy.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 5,
          maxOtpAttempts: 3,
          showFailure: true,
        },
        creator: 'system',
        owner: orgID,
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await pool.queryOne<{
        id: string;
        resource_owner: string;
        max_password_attempts: number;
        max_otp_attempts: number;
        show_failure: boolean;
        is_default: boolean;
      }>(
        `SELECT id, resource_owner, max_password_attempts, max_otp_attempts, show_failure, is_default 
         FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', policyID]
      );
      
      expect(result).toBeDefined();
      expect(result!.resource_owner).toBe(orgID);
      expect(result!.max_password_attempts).toBe(5);
      expect(result!.max_otp_attempts).toBe(3);
      expect(result!.show_failure).toBe(true);
      expect(result!.is_default).toBe(false);
    }, 5000);

    it('should process org.lockout.policy.changed event', async () => {
      const orgID = generateSnowflakeId();
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Add policy first
      await eventstore.push({
        eventType: 'org.lockout.policy.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 5,
          maxOtpAttempts: 3,
          showFailure: true,
        },
        creator: 'system',
        owner: orgID,
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify initial values
      let result = await pool.queryOne<{
        max_password_attempts: number;
        max_otp_attempts: number;
        show_failure?: boolean;
      }>(
        `SELECT max_password_attempts, max_otp_attempts 
         FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', policyID]
      );
      expect(result!.max_password_attempts).toBe(5);
      expect(result!.max_otp_attempts).toBe(3);
      
      // Change policy
      await eventstore.push({
        eventType: 'org.lockout.policy.changed',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 10,
          maxOtpAttempts: 5,
          showFailure: false,
        },
        creator: 'system',
        owner: orgID,
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify updated values
      result = await pool.queryOne<{
        max_password_attempts: number;
        max_otp_attempts: number;
        show_failure: boolean;
      }>(
        `SELECT max_password_attempts, max_otp_attempts, show_failure 
         FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', policyID]
      );
      expect(result!.max_password_attempts).toBe(10);
      expect(result!.max_otp_attempts).toBe(5);
      expect(result!.show_failure).toBe(false);
    }, 5000);

    it('should process org.lockout.policy.removed event', async () => {
      const orgID = generateSnowflakeId();
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Add policy first
      await eventstore.push({
        eventType: 'org.lockout.policy.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 5,
          maxOtpAttempts: 3,
        },
        creator: 'system',
        owner: orgID,
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify it exists
      let result = await pool.queryOne(
        `SELECT id FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', policyID]
      );
      expect(result).toBeDefined();
      
      // Remove policy
      await eventstore.push({
        eventType: 'org.lockout.policy.removed',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: policyID,
        },
        creator: 'system',
        owner: orgID,
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify it's deleted
      result = await pool.queryOne(
        `SELECT id FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', policyID]
      );
      expect(result).toBeNull();
    }, 5000);
  });

  describe('Instance Lockout Policy Events', () => {
    it('should process instance.lockout.policy.added event', async () => {
      const instanceID = 'test-instance-' + generateSnowflakeId();
      const policyID = `instance_policy_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 3,
          maxOtpAttempts: 3,
          showFailure: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID: instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await pool.queryOne<{
        id: string;
        max_password_attempts: number;
        is_default: boolean;
      }>(
        `SELECT id, max_password_attempts, is_default 
         FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        [instanceID, policyID]
      );
      
      expect(result).toBeDefined();
      expect(result!.max_password_attempts).toBe(3);
      expect(result!.is_default).toBe(true); // Instance policies are defaults
    }, 5000);

    it('should process instance.lockout.policy.changed event', async () => {
      const instanceID = 'test-instance-' + generateSnowflakeId();
      const policyID = `instance_policy_${generateSnowflakeId()}`;
      
      // Add instance policy
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 5,
          maxOtpAttempts: 5,
        },
        creator: 'system',
        owner: instanceID,
        instanceID: instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Change instance policy
      await eventstore.push({
        eventType: 'instance.lockout.policy.changed',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 7,
        },
        creator: 'system',
        owner: instanceID,
        instanceID: instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await pool.queryOne<{
        max_password_attempts: number;
        max_otp_attempts: number;
      }>(
        `SELECT max_password_attempts, max_otp_attempts 
         FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        [instanceID, policyID]
      );
      
      expect(result!.max_password_attempts).toBe(7);
      expect(result!.max_otp_attempts).toBe(5); // Unchanged
    }, 5000);
  });

  describe('Query Scenarios', () => {
    it('should find default policy for instance', async () => {
      const instanceID = 'test-instance-' + generateSnowflakeId();
      const policyID = `default_policy_${generateSnowflakeId()}`;
      
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 5,
          maxOtpAttempts: 5,
        },
        creator: 'system',
        owner: instanceID,
        instanceID: instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query for default policy
      const result = await pool.queryOne<{
        id: string;
        max_password_attempts: number;
      }>(
        `SELECT id, max_password_attempts 
         FROM lockout_policies_projection 
         WHERE instance_id = $1 AND is_default = true`,
        [instanceID]
      );
      
      expect(result).toBeDefined();
      expect(result!.id).toBe(policyID);
      expect(result!.max_password_attempts).toBe(5);
    }, 5000);

    it('should find org-specific policy', async () => {
      const instanceID = 'test-instance-' + generateSnowflakeId();
      const orgID = generateSnowflakeId();
      const policyID = `org_policy_${generateSnowflakeId()}`;
      
      // Add org-specific policy
      await eventstore.push({
        eventType: 'org.lockout.policy.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 10,
          maxOtpAttempts: 10,
        },
        creator: 'system',
        owner: orgID,
        instanceID: instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query by resource owner
      const result = await pool.queryOne<{
        id: string;
        max_password_attempts: number;
        is_default: boolean;
      }>(
        `SELECT id, max_password_attempts, is_default 
         FROM lockout_policies_projection 
         WHERE instance_id = $1 AND resource_owner = $2`,
        [instanceID, orgID]
      );
      
      expect(result).toBeDefined();
      expect(result!.max_password_attempts).toBe(10);
      expect(result!.is_default).toBe(false);
    }, 5000);

    it('should handle policy inheritance (instance default + org override)', async () => {
      const instanceID = 'test-instance-' + generateSnowflakeId();
      const orgID = generateSnowflakeId();
      const instancePolicyID = `instance_policy_${generateSnowflakeId()}`;
      const orgPolicyID = `org_policy_${generateSnowflakeId()}`;
      
      // Add instance default policy
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: instancePolicyID,
          maxPasswordAttempts: 5,
          maxOtpAttempts: 5,
        },
        creator: 'system',
        owner: instanceID,
        instanceID: instanceID,
      });
      
      // Add org-specific policy
      await eventstore.push({
        eventType: 'org.lockout.policy.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: orgPolicyID,
          maxPasswordAttempts: 10,
          maxOtpAttempts: 10,
        },
        creator: 'system',
        owner: orgID,
        instanceID: instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query should find both policies
      const instancePolicy = await pool.queryOne<{ max_password_attempts: number }>(
        `SELECT max_password_attempts FROM lockout_policies_projection 
         WHERE instance_id = $1 AND is_default = true`,
        [instanceID]
      );
      
      const orgPolicy = await pool.queryOne<{ max_password_attempts: number }>(
        `SELECT max_password_attempts FROM lockout_policies_projection 
         WHERE instance_id = $1 AND resource_owner = $2`,
        [instanceID, orgID]
      );
      
      expect(instancePolicy!.max_password_attempts).toBe(5);
      expect(orgPolicy!.max_password_attempts).toBe(10);
    }, 5000);
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate policies by instance', async () => {
      const instance1ID = 'instance-1-' + generateSnowflakeId();
      const instance2ID = 'instance-2-' + generateSnowflakeId();
      const policy1ID = `policy1_${generateSnowflakeId()}`;
      const policy2ID = `policy2_${generateSnowflakeId()}`;
      
      await eventstore.pushMany([
        {
          eventType: 'instance.lockout.policy.added',
          aggregateType: 'instance',
          aggregateID: instance1ID,
          payload: {
            id: policy1ID,
            maxPasswordAttempts: 5,
          },
          creator: 'system',
          owner: instance1ID,
          instanceID: instance1ID,
        },
        {
          eventType: 'instance.lockout.policy.added',
          aggregateType: 'instance',
          aggregateID: instance2ID,
          payload: {
            id: policy2ID,
            maxPasswordAttempts: 10,
          },
          creator: 'system',
          owner: instance2ID,
          instanceID: instance2ID,
        },
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query instance 1
      const instance1Policy = await pool.queryOne<{ max_password_attempts: number }>(
        `SELECT max_password_attempts FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        [instance1ID, policy1ID]
      );
      
      // Query instance 2
      const instance2Policy = await pool.queryOne<{ max_password_attempts: number }>(
        `SELECT max_password_attempts FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        [instance2ID, policy2ID]
      );
      
      expect(instance1Policy!.max_password_attempts).toBe(5);
      expect(instance2Policy!.max_password_attempts).toBe(10);
      
      // Verify instance 1 can't see instance 2's policy
      const crossQuery = await pool.queryOne(
        `SELECT id FROM lockout_policies_projection 
         WHERE instance_id = $1 AND id = $2`,
        [instance1ID, policy2ID]
      );
      expect(crossQuery).toBeNull();
    }, 5000);
  });
});
