/**
 * Integration tests for Lockout Policy Queries
 * Tests lockout policy queries and enforcement business logic with real database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { LockoutPolicyQueries } from '../../../src/lib/query/policy/lockout-policy-queries';
import { DatabasePool } from '../../../src/lib/database';
import { DatabaseMigrator } from '../../../src/lib/database/migrator';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { generateId as generateSnowflakeId } from '../../../src/lib/id/snowflake';
import { PostgresEventstore } from '../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { LockoutPolicyProjection } from '../../../src/lib/query/projections/lockout-policy-projection';

describe('Lockout Policy Queries Integration Tests', () => {
  let pool: DatabasePool;
  let queries: LockoutPolicyQueries;
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
    
    queries = new LockoutPolicyQueries(pool);
    
    // Set up projection for event processing
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
    
    // Wait for projections to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    if (registry) {
      const names = registry.getNames();
      for (const name of names) {
        try {
          await registry.stop(name);
        } catch (e) {
          // Ignore if already stopped
        }
      }
    }
    
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean up test data between tests to prevent interference
    await pool.query('DELETE FROM lockout_policies_projection WHERE instance_id = $1', ['test-instance']);
    // Wait a bit for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Policy Inheritance', () => {
    it('should return built-in default when no policy exists', async () => {
      const instanceID = `unused-instance-${generateSnowflakeId()}`;
      
      const policy = await queries.getLockoutPolicy(instanceID);
      
      expect(policy).toBeDefined();
      expect(policy.id).toBe('built-in-default');
      expect(policy.instanceID).toBe(instanceID);
      expect(policy.maxPasswordAttempts).toBe(10);
      expect(policy.maxOTPAttempts).toBe(5);
      expect(policy.showFailures).toBe(true);
      expect(policy.isDefault).toBe(true);
    }, 5000);

    it('should return instance policy when available', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create instance-level policy via event
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 3,
          maxOTPAttempts: 3,
          showFailures: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const policy = await queries.getLockoutPolicy(instanceID);
      
      expect(policy).toBeDefined();
      expect(policy.id).toBe(policyID);
      expect(policy.maxPasswordAttempts).toBe(3);
      expect(policy.maxOTPAttempts).toBe(3);
      expect(policy.showFailures).toBe(false);
      expect(policy.isDefault).toBe(true);
    }, 5000);

    it('should return org-specific policy over instance policy', async () => {
      const instanceID = 'test-instance';
      const orgID = `org_${generateSnowflakeId()}`;
      const instancePolicyID = `policy_inst_${generateSnowflakeId()}`;
      const orgPolicyID = `policy_org_${generateSnowflakeId()}`;
      
      // Create instance policy
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: instancePolicyID,
          maxPasswordAttempts: 5,
          maxOTPAttempts: 5,
          showFailures: true,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      // Create org-specific policy (stricter)
      await eventstore.push({
        eventType: 'org.lockout.policy.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          id: orgPolicyID,
          maxPasswordAttempts: 3,
          maxOTPAttempts: 2,
          showFailures: false,
        },
        creator: 'system',
        owner: orgID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query without orgID should return instance policy
      const instancePolicy = await queries.getLockoutPolicy(instanceID);
      expect(instancePolicy.id).toBe(instancePolicyID);
      expect(instancePolicy.maxPasswordAttempts).toBe(5);
      
      // Query with orgID should return org policy
      const orgPolicy = await queries.getLockoutPolicy(instanceID, orgID);
      expect(orgPolicy.id).toBe(orgPolicyID);
      expect(orgPolicy.maxPasswordAttempts).toBe(3);
      expect(orgPolicy.showFailures).toBe(false);
    }, 5000);
  });

  describe('Lockout Logic', () => {
    it('should check if user is locked out based on password attempts', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create policy with 3 max password attempts
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 3,
          maxOTPAttempts: 5,
          showFailures: true,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const policy = await queries.getLockoutPolicy(instanceID);
      
      // 2 attempts - not locked
      expect(queries.shouldLockoutPassword(2, policy)).toBe(false);
      
      // 3 attempts - locked
      expect(queries.shouldLockoutPassword(3, policy)).toBe(true);
      
      // More than 3 - locked
      expect(queries.shouldLockoutPassword(5, policy)).toBe(true);
    }, 5000);

    it('should check if user is locked out based on OTP attempts', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create policy with 2 max OTP attempts
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 10,
          maxOTPAttempts: 2,
          showFailures: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const policy = await queries.getLockoutPolicy(instanceID);
      
      // 1 attempt - not locked
      expect(queries.shouldLockoutOTP(1, policy)).toBe(false);
      
      // 2 attempts - locked
      expect(queries.shouldLockoutOTP(2, policy)).toBe(true);
      
      // More than 2 - locked
      expect(queries.shouldLockoutOTP(3, policy)).toBe(true);
    }, 5000);

    it('should respect showFailures setting', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create policy with showFailures = false
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 5,
          maxOTPAttempts: 5,
          showFailures: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const policy = await queries.getLockoutPolicy(instanceID);
      
      expect(policy.showFailures).toBe(false);
      expect(queries.shouldShowFailureDetails(policy)).toBe(false);
    }, 5000);
  });

  describe('Policy Changes', () => {
    it('should handle policy updates', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create initial policy
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 5,
          maxOTPAttempts: 3,
          showFailures: true,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let policy = await queries.getLockoutPolicy(instanceID);
      expect(policy.maxPasswordAttempts).toBe(5);
      expect(policy.maxOTPAttempts).toBe(3);
      
      // Update policy to be stricter
      await eventstore.push({
        eventType: 'instance.lockout.policy.changed',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 3,
          maxOTPAttempts: 2,
          showFailures: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      policy = await queries.getLockoutPolicy(instanceID);
      expect(policy.maxPasswordAttempts).toBe(3);
      expect(policy.maxOTPAttempts).toBe(2);
      expect(policy.showFailures).toBe(false);
    }, 5000);

    it('should handle policy removal', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Add policy
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 3,
          maxOTPAttempts: 2,
          showFailures: false,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let policy = await queries.getLockoutPolicy(instanceID);
      expect(policy.id).toBe(policyID);
      
      // Remove policy
      await eventstore.push({
        eventType: 'instance.lockout.policy.removed',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Should fall back to built-in default
      policy = await queries.getLockoutPolicy(instanceID);
      expect(policy.id).toBe('built-in-default');
      expect(policy.maxPasswordAttempts).toBe(10);
    }, 5000);
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate policies by instance', async () => {
      const instance1ID = 'test-instance';
      const instance2ID = `other-instance-${generateSnowflakeId()}`;
      const policy1ID = `policy1_${generateSnowflakeId()}`;
      
      // Create policy for instance 1 (lenient)
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instance1ID,
        payload: {
          id: policy1ID,
          maxPasswordAttempts: 10,
          maxOTPAttempts: 10,
          showFailures: true,
        },
        creator: 'system',
        owner: instance1ID,
        instanceID: instance1ID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get policies for each instance
      const policy1 = await queries.getLockoutPolicy(instance1ID);
      const policy2 = await queries.getLockoutPolicy(instance2ID);
      
      // Instance 1 should have the configured policy
      expect(policy1.id).toBe(policy1ID);
      expect(policy1.maxPasswordAttempts).toBe(10);
      
      // Instance 2 should get built-in default (isolation verified)
      expect(policy2.id).toBe('built-in-default');
      expect(policy2.maxPasswordAttempts).toBe(10);
      expect(policy2.showFailures).toBe(true);
      
      // Test lockout behavior - 3 attempts
      expect(queries.shouldLockoutPassword(3, policy1)).toBe(false); // Not locked for lenient
      expect(queries.shouldLockoutPassword(3, policy2)).toBe(false); // Not locked for default
    }, 5000);
  });

  describe('Query Methods', () => {
    it('should get default policy correctly', async () => {
      const instanceID = 'test-instance';
      const policyID = `policy_${generateSnowflakeId()}`;
      
      // Create default policy
      await eventstore.push({
        eventType: 'instance.lockout.policy.added',
        aggregateType: 'instance',
        aggregateID: instanceID,
        payload: {
          id: policyID,
          maxPasswordAttempts: 7,
          maxOTPAttempts: 4,
          showFailures: true,
        },
        creator: 'system',
        owner: instanceID,
        instanceID,
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const policy = await queries.getDefaultLockoutPolicy(instanceID);
      
      expect(policy).toBeDefined();
      expect(policy.id).toBe(policyID);
      expect(policy.isDefault).toBe(true);
      expect(policy.maxPasswordAttempts).toBe(7);
    }, 5000);
  });
});
