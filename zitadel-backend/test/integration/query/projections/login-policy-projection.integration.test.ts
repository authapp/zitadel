/**
 * Integration tests for Login Policy Projection
 * Tests authentication policy management with real database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { LoginPolicyProjection, createLoginPolicyProjectionConfig } from '../../../../src/lib/query/projections/login-policy-projection';
import { LoginPolicyQueries } from '../../../../src/lib/query/login-policy/login-policy-queries';
import { SecondFactorType, MultiFactorType } from '../../../../src/lib/query/login-policy/login-policy-types';
import { generateId } from '../../../../src/lib/id';

describe('Login Policy Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let policyQueries: LoginPolicyQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register login policy projection
    const config = createLoginPolicyProjectionConfig();
    config.interval = 50; // Optimized: 50ms for faster projection detection
    registry.register(config, new LoginPolicyProjection(eventstore, pool));
    
    await registry.start('login_policy_projection');

    policyQueries = new LoginPolicyQueries(pool);
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

  describe('Login Policy Management', () => {
    it('should process org.login.policy.added event', async () => {
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.added',
        payload: {
          allowUsernamePassword: true,
          allowRegister: false,
          allowExternalIDP: true,
          forceMFA: true,
          forceMFALocalOnly: false,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await policyQueries.getLoginPolicy(orgID, instanceID);
      
      expect(policy).toBeTruthy();
      expect(policy!.resourceOwner).toBe(orgID);
      expect(policy!.allowRegister).toBe(false);
      expect(policy!.forceMFA).toBe(true);
    });

    it('should process instance.login.policy.added event', async () => {
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.login.policy.added',
        payload: {
          allowUsernamePassword: true,
          allowRegister: true,
          allowExternalIDP: true,
          forceMFA: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await policyQueries.getDefaultLoginPolicy(instanceID);
      
      expect(policy).toBeTruthy();
      expect(policy!.isDefault).toBe(true);
      expect(policy!.resourceOwner).toBe(instanceID);
    });

    it('should update policy on changed event', async () => {
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      // Add policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.added',
        payload: {
          allowUsernamePassword: true,
          allowRegister: true,
          forceMFA: false,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      // Change policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.changed',
        payload: {
          forceMFA: true,
          allowRegister: false,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await policyQueries.getLoginPolicy(orgID, instanceID);
      
      expect(policy).toBeTruthy();
      expect(policy!.forceMFA).toBe(true);
      expect(policy!.allowRegister).toBe(false);
    });

    it('should delete policy on removed event', async () => {
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      // Add policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.added',
        payload: {
          allowUsernamePassword: true,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      let policy = await policyQueries.getLoginPolicy(orgID, instanceID);
      expect(policy).toBeTruthy();

      // Remove policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.removed',
        payload: {},
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      policy = await policyQueries.getLoginPolicy(orgID, instanceID);
      expect(policy).toBeNull();
    });
  });

  describe('MFA Factor Management', () => {
    it('should add second factor', async () => {
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      // Add policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.added',
        payload: {
          forceMFA: true,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      // Add second factor
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.second.factor.added',
        payload: {
          factorType: SecondFactorType.OTP,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await policyQueries.getLoginPolicy(orgID, instanceID);
      
      expect(policy).toBeTruthy();
      expect(policy!.secondFactors).toContain(SecondFactorType.OTP);
    });

    it('should add multiple second factors', async () => {
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      // Add policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.added',
        payload: {
          forceMFA: true,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      // Add OTP
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.second.factor.added',
        payload: {
          factorType: SecondFactorType.OTP,
        },
        creator: 'admin',
        owner: orgID,
      });

      // Add U2F
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.second.factor.added',
        payload: {
          factorType: SecondFactorType.U2F,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await policyQueries.getLoginPolicy(orgID, instanceID);
      
      expect(policy).toBeTruthy();
      expect(policy!.secondFactors).toHaveLength(2);
      expect(policy!.secondFactors).toContain(SecondFactorType.OTP);
      expect(policy!.secondFactors).toContain(SecondFactorType.U2F);
    });

    it('should add multi-factor', async () => {
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      // Add policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.added',
        payload: {
          forceMFA: true,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      // Add multi-factor
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.multi.factor.added',
        payload: {
          mfaType: MultiFactorType.U2F,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await policyQueries.getLoginPolicy(orgID, instanceID);
      
      expect(policy).toBeTruthy();
      expect(policy!.multiFactors).toContain(MultiFactorType.U2F);
    });

    it('should remove second factor', async () => {
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      // Add policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.added',
        payload: {},
        creator: 'admin',
        owner: orgID,
      });

      // Add factor
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.second.factor.added',
        payload: {
          factorType: SecondFactorType.OTP,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      let policy = await policyQueries.getLoginPolicy(orgID, instanceID);
      expect(policy!.secondFactors).toContain(SecondFactorType.OTP);

      // Remove factor
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.second.factor.removed',
        payload: {
          factorType: SecondFactorType.OTP,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      policy = await policyQueries.getLoginPolicy(orgID, instanceID);
      expect(policy!.secondFactors).not.toContain(SecondFactorType.OTP);
    });
  });

  describe('Policy Inheritance', () => {
    it('should fall back to instance default policy', async () => {
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      // Add instance default policy
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.login.policy.added',
        payload: {
          allowUsernamePassword: true,
          allowRegister: true,
          forceMFA: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Get active policy for org (should fall back to instance)
      const policy = await policyQueries.getActiveLoginPolicy(orgID, instanceID);
      
      expect(policy).toBeTruthy();
      expect(policy!.isOrgPolicy).toBe(false);
      expect(policy!.isDefault).toBe(true);
      expect(policy!.resourceOwner).toBe(instanceID);
    });

    it('should prefer org policy over instance default', async () => {
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      // Add instance default policy
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.login.policy.added',
        payload: {
          forceMFA: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      // Add org-specific policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.login.policy.added',
        payload: {
          forceMFA: true,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      // Get active policy for org
      const policy = await policyQueries.getActiveLoginPolicy(orgID, instanceID);
      
      expect(policy).toBeTruthy();
      expect(policy!.isOrgPolicy).toBe(true);
      expect(policy!.orgID).toBe(orgID);
      expect(policy!.forceMFA).toBe(true);
    });
  });

  describe('Search Operations', () => {
    it('should search policies by instance', async () => {
      const org1 = generateId();
      const org2 = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: org1,
        eventType: 'org.login.policy.added',
        payload: {},
        creator: 'admin',
        owner: org1,
      });

      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: org2,
        eventType: 'org.login.policy.added',
        payload: {},
        creator: 'admin',
        owner: org2,
      });

      await waitForProjection();

      const result = await policyQueries.searchLoginPolicies({
        instanceID,
      });

      expect(result.total).toBeGreaterThanOrEqual(2);
    });
  });
});
