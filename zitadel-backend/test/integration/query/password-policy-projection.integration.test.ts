/**
 * Integration tests for Password Policy Projection
 * Tests password complexity and age policies with real database and projections
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PasswordComplexityQueries } from '../../../src/lib/query/policy/password-complexity-queries';
import { PasswordAgeQueries } from '../../../src/lib/query/policy/password-age-queries';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { PasswordPolicyProjection, createPasswordPolicyProjectionConfig } from '../../../src/lib/query/projections/password-policy-projection';
import { generateId } from '../../../src/lib/id';

describe('Password Policy Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let complexityQueries: PasswordComplexityQueries;
  let ageQueries: PasswordAgeQueries;

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
    
    // Register password policy projection
    const config = createPasswordPolicyProjectionConfig();
    config.interval = 50; // Optimized: 50ms for faster projection detection
    registry.register(config, new PasswordPolicyProjection(eventstore, pool));
    
    await registry.start('password_policy_projection');

    complexityQueries = new PasswordComplexityQueries(pool);
    ageQueries = new PasswordAgeQueries(pool);
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

  const waitForProjection = (ms: number = 300) => // Optimized: 300ms sufficient for most projections
    new Promise(resolve => setTimeout(resolve, ms));

  describe('Password Complexity Policy', () => {
    it('should return built-in default when no policies exist', async () => {
      // Use unique instanceID to ensure no policies exist for it
      const uniqueInstanceID = generateId();
      const policy = await complexityQueries.getDefaultPasswordComplexityPolicy(uniqueInstanceID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.instanceID).toBe(uniqueInstanceID);
      expect(policy.minLength).toBe(8);
      expect(policy.hasUppercase).toBe(true);
      expect(policy.hasLowercase).toBe(true);
      expect(policy.hasNumber).toBe(true);
      expect(policy.hasSymbol).toBe(false);
    });

    it('should process instance.password.complexity.policy.added event', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.password.complexity.policy.added',
        payload: {
          minLength: 12,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: true,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await complexityQueries.getDefaultPasswordComplexityPolicy(instanceID);

      expect(policy.instanceID).toBe(instanceID);
      expect(policy.minLength).toBe(12);
      expect(policy.hasSymbol).toBe(true);
      expect(policy.isDefault).toBe(true);
    });

    it('should retrieve org-specific policy over instance default', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      
      // Add instance default policy
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.password.complexity.policy.added',
        payload: {
          minLength: 8,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Add org-specific policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.password.complexity.policy.added',
        payload: {
          minLength: 16,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: true,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await complexityQueries.getPasswordComplexityPolicy(instanceID, orgID);

      expect(policy.organizationID).toBe(orgID);
      expect(policy.minLength).toBe(16);
      expect(policy.hasSymbol).toBe(true);
      expect(policy.isDefault).toBe(false);
    });

    it('should validate password against complexity requirements', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.password.complexity.policy.added',
        payload: {
          minLength: 12,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: true,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await complexityQueries.getDefaultPasswordComplexityPolicy(instanceID);

      // Test valid password
      const validResult = await complexityQueries.validatePassword('MyP@ssw0rd123', policy);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Test invalid password (too short)
      const invalidResult = await complexityQueries.validatePassword('Short1!', policy);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('should update complexity policy on changed event', async () => {
      const instanceID = generateId();
      
      // Add initial policy
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.password.complexity.policy.added',
        payload: {
          minLength: 8,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Update policy
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.password.complexity.policy.changed',
        payload: {
          minLength: 14,
          hasSymbol: true,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await complexityQueries.getDefaultPasswordComplexityPolicy(instanceID);

      expect(policy.minLength).toBe(14);
      expect(policy.hasSymbol).toBe(true);
    });
  });

  describe('Password Age Policy', () => {
    it('should return built-in default when no policies exist', async () => {
      // Use unique instanceID to ensure no policies exist for it
      const uniqueInstanceID = generateId();
      const policy = await ageQueries.getDefaultPasswordAgePolicy(uniqueInstanceID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.instanceID).toBe(uniqueInstanceID);
      expect(policy.maxAgeDays).toBe(0); // No expiration
      expect(policy.expireWarnDays).toBe(0);
    });

    it('should process instance.password.age.policy.added event', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.password.age.policy.added',
        payload: {
          maxAgeDays: 90,
          expireWarnDays: 7,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await ageQueries.getDefaultPasswordAgePolicy(instanceID);

      expect(policy.instanceID).toBe(instanceID);
      expect(policy.maxAgeDays).toBe(90);
      expect(policy.expireWarnDays).toBe(7);
      expect(policy.isDefault).toBe(true);
    });

    it('should retrieve org-specific age policy over instance default', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      
      // Add instance default
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.password.age.policy.added',
        payload: {
          maxAgeDays: 90,
          expireWarnDays: 7,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Add org-specific policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.password.age.policy.added',
        payload: {
          maxAgeDays: 60,
          expireWarnDays: 14,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await ageQueries.getPasswordAgePolicy(instanceID, orgID);

      expect(policy.organizationID).toBe(orgID);
      expect(policy.maxAgeDays).toBe(60);
      expect(policy.expireWarnDays).toBe(14);
      expect(policy.isDefault).toBe(false);
    });

    it('should check password age against policy', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.password.age.policy.added',
        payload: {
          maxAgeDays: 90,
          expireWarnDays: 7,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await ageQueries.getDefaultPasswordAgePolicy(instanceID);

      // Test recent password (not expired)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const recentResult = ageQueries.checkPasswordAge(recentDate, policy);
      expect(recentResult.expired).toBe(false);
      expect(recentResult.shouldWarn).toBe(false);

      // Test old password (expired)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const expiredResult = ageQueries.checkPasswordAge(oldDate, policy);
      expect(expiredResult.expired).toBe(true);

      // Test password in warning period
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() - 85);
      const warningResult = ageQueries.checkPasswordAge(warningDate, policy);
      expect(warningResult.expired).toBe(false);
      expect(warningResult.shouldWarn).toBe(true);
    });
  });

  describe('Policy Inheritance', () => {
    it('should demonstrate 3-level inheritance for complexity', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      
      // Level 1: Built-in default (minLength: 8)
      const builtIn = await complexityQueries.getPasswordComplexityPolicy(instanceID);
      expect(builtIn.minLength).toBe(8);

      // Level 2: Instance default (minLength: 10)
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.password.complexity.policy.added',
        payload: {
          minLength: 10,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const instance = await complexityQueries.getPasswordComplexityPolicy(instanceID);
      expect(instance.minLength).toBe(10);

      // Level 3: Org-specific (minLength: 12)
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.password.complexity.policy.added',
        payload: {
          minLength: 12,
          hasUppercase: true,
          hasLowercase: true,
          hasNumber: true,
          hasSymbol: false,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const org = await complexityQueries.getPasswordComplexityPolicy(instanceID, orgID);
      expect(org.minLength).toBe(12);
    });
  });
});
