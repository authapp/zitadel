/**
 * Integration tests for Security & Notification Policy Projection
 * Tests lockout, privacy, notification, and security policies with real database and projections
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { SecurityNotificationPolicyProjection, createSecurityNotificationPolicyProjectionConfig } from '../../../src/lib/query/projections/security-notification-policy-projection';
import { LockoutPolicyProjection } from '../../../src/lib/query/projections/lockout-policy-projection';
import { LockoutPolicyQueries } from '../../../src/lib/query/policy/lockout-policy-queries';
import { PrivacyPolicyQueries } from '../../../src/lib/query/policy/privacy-policy-queries';
import { NotificationPolicyQueries } from '../../../src/lib/query/policy/notification-policy-queries';
import { SecurityPolicyQueries } from '../../../src/lib/query/policy/security-policy-queries';
import { generateId } from '../../../src/lib/id';

describe('Security & Notification Policy Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let lockoutQueries: LockoutPolicyQueries;
  let privacyQueries: PrivacyPolicyQueries;
  let notificationQueries: NotificationPolicyQueries;
  let securityQueries: SecurityPolicyQueries;

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
    
    // Register projections
    const config = createSecurityNotificationPolicyProjectionConfig();
    config.interval = 50; // Optimized: 50ms for faster projection detection
    registry.register(config, new SecurityNotificationPolicyProjection(eventstore, pool));
    
    // Also register lockout policy projection since this test suite tests lockout policies
    const lockoutConfig = {
      name: 'lockout_policy_projection',
      tables: ['lockout_policies_projection'],
      eventTypes: ['instance.lockout.policy.added', 'instance.lockout.policy.changed', 'org.lockout.policy.added', 'org.lockout.policy.changed', 'org.removed'],
      interval: 50,
    };
    registry.register(lockoutConfig, new LockoutPolicyProjection(eventstore, pool));
    
    await registry.start('security_notification_policy_projection');
    await registry.start('lockout_policy_projection');

    // Initialize query classes
    lockoutQueries = new LockoutPolicyQueries(pool);
    privacyQueries = new PrivacyPolicyQueries(pool);
    notificationQueries = new NotificationPolicyQueries(pool);
    securityQueries = new SecurityPolicyQueries(pool);
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
    // Clean up test data between tests to prevent interference
    await pool.query('DELETE FROM lockout_policies_projection WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await pool.query('DELETE FROM projections.privacy_policies WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await pool.query('DELETE FROM projections.notification_policies WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    await pool.query('DELETE FROM projections.security_policies WHERE instance_id = $1', [TEST_INSTANCE_ID]);
    // Wait a bit for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  const waitForProjection = (ms: number = 300) => // Optimized: 300ms sufficient for most projections
    new Promise(resolve => setTimeout(resolve, ms));

  describe('Lockout Policy', () => {
    it('should return built-in default when no policies exist', async () => {
      const policy = await lockoutQueries.getDefaultLockoutPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.maxPasswordAttempts).toBe(10);
      expect(policy.maxOTPAttempts).toBe(5);
      expect(policy.showFailures).toBe(true);
      expect(policy.isDefault).toBe(true);
    });

    it('should process instance.lockout.policy.added event', async () => {
      const instanceID = TEST_INSTANCE_ID;
      const policyID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.lockout.policy.added',
        payload: {
          id: policyID,
          maxPasswordAttempts: 15,
          maxOTPAttempts: 10,
          showFailures: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await lockoutQueries.getDefaultLockoutPolicy(instanceID);
      
      expect(policy.instanceID).toBe(instanceID);
      expect(policy.maxPasswordAttempts).toBe(15);
      expect(policy.maxOTPAttempts).toBe(10);
      expect(policy.showFailures).toBe(false);
      expect(policy.isDefault).toBe(true);
    });

    it('should retrieve org-specific policy over instance default', async () => {
      const instanceID = TEST_INSTANCE_ID;
      const orgID = generateId();
      
      // Instance policy
      const instancePolicyID = generateId();
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.lockout.policy.added',
        payload: {
          id: instancePolicyID,
          maxPasswordAttempts: 10,
          maxOTPAttempts: 5,
          showFailures: true,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Org-specific policy
      const orgPolicyID = generateId();
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.lockout.policy.added',
        payload: {
          id: orgPolicyID,
          maxPasswordAttempts: 3,
          maxOTPAttempts: 2,
          showFailures: false,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await lockoutQueries.getLockoutPolicy(instanceID, orgID);
      
      expect(policy.organizationID).toBe(orgID);
      expect(policy.maxPasswordAttempts).toBe(3);
      expect(policy.maxOTPAttempts).toBe(2);
      expect(policy.isDefault).toBe(false);
    });

    it('should update lockout policy on changed event', async () => {
      const instanceID = TEST_INSTANCE_ID;
      const policyID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.lockout.policy.added',
        payload: {
          id: policyID,
          maxPasswordAttempts: 5,
          maxOTPAttempts: 3,
          showFailures: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Change policy
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.lockout.policy.changed',
        payload: {
          id: policyID,
          maxPasswordAttempts: 20,
          showFailures: true,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await lockoutQueries.getDefaultLockoutPolicy(instanceID);
      
      expect(policy.maxPasswordAttempts).toBe(20);
      expect(policy.maxOTPAttempts).toBe(3); // Unchanged
      expect(policy.showFailures).toBe(true);
    });
  });

  describe('Privacy Policy', () => {
    it('should return built-in default when no policies exist', async () => {
      const policy = await privacyQueries.getDefaultPrivacyPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.docsLink).toBe('https://zitadel.com/docs');
      expect(policy.tosLink).toBe('');
      expect(policy.isDefault).toBe(true);
    });

    it('should process instance.privacy.policy.added event', async () => {
      const instanceID = TEST_INSTANCE_ID;
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.privacy.policy.added',
        payload: {
          tosLink: 'https://example.com/tos',
          privacyLink: 'https://example.com/privacy',
          helpLink: 'https://example.com/help',
          supportEmail: 'support@example.com',
          docsLink: 'https://example.com/docs',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await privacyQueries.getDefaultPrivacyPolicy(instanceID);
      
      expect(policy.tosLink).toBe('https://example.com/tos');
      expect(policy.privacyLink).toBe('https://example.com/privacy');
      expect(policy.supportEmail).toBe('support@example.com');
      expect(policy.isDefault).toBe(true);
    });

    it('should retrieve org-specific privacy policy', async () => {
      const instanceID = TEST_INSTANCE_ID;
      const orgID = generateId();
      
      // Instance policy
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.privacy.policy.added',
        payload: {
          tosLink: 'https://instance.com/tos',
          supportEmail: 'support@instance.com',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Org policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.privacy.policy.added',
        payload: {
          tosLink: 'https://org.com/tos',
          privacyLink: 'https://org.com/privacy',
          supportEmail: 'support@org.com',
          customLink: 'https://org.com/custom',
          customLinkText: 'Custom',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await privacyQueries.getPrivacyPolicy(instanceID, orgID);
      
      expect(policy.organizationID).toBe(orgID);
      expect(policy.tosLink).toBe('https://org.com/tos');
      expect(policy.supportEmail).toBe('support@org.com');
      expect(policy.customLinkText).toBe('Custom');
      expect(policy.isDefault).toBe(false);
    });
  });

  describe('Notification Policy', () => {
    it('should return built-in default when no policies exist', async () => {
      const policy = await notificationQueries.getDefaultNotificationPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.passwordChange).toBe(true);
      expect(policy.isDefault).toBe(true);
    });

    it('should process instance.notification.policy.added event', async () => {
      const instanceID = TEST_INSTANCE_ID;
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.notification.policy.added',
        payload: {
          passwordChange: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await notificationQueries.getDefaultNotificationPolicy(instanceID);
      
      expect(policy.passwordChange).toBe(false);
      expect(policy.isDefault).toBe(true);
    });

    it('should retrieve org-specific notification policy', async () => {
      const instanceID = TEST_INSTANCE_ID;
      const orgID = generateId();
      
      // Instance policy
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.notification.policy.added',
        payload: {
          passwordChange: true,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Org policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.notification.policy.added',
        payload: {
          passwordChange: false,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await notificationQueries.getNotificationPolicy(instanceID, orgID);
      
      expect(policy.organizationID).toBe(orgID);
      expect(policy.passwordChange).toBe(false);
      expect(policy.isDefault).toBe(false);
    });
  });

  describe('Security Policy', () => {
    it('should return built-in default when no policy exists', async () => {
      const policy = await securityQueries.getSecurityPolicy(TEST_INSTANCE_ID);

      expect(policy.aggregateID).toBe(TEST_INSTANCE_ID);
      expect(policy.enableIframeEmbedding).toBe(false);
      expect(policy.allowedOrigins).toEqual([]);
      expect(policy.enableImpersonation).toBe(false);
    });

    it('should process instance.security.policy.added event', async () => {
      const instanceID = TEST_INSTANCE_ID;
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.security.policy.added',
        payload: {
          enableIframeEmbedding: true,
          allowedOrigins: ['https://example.com', 'https://app.example.com'],
          enableImpersonation: true,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await securityQueries.getSecurityPolicy(instanceID);
      
      expect(policy.enableIframeEmbedding).toBe(true);
      expect(policy.allowedOrigins).toEqual(['https://example.com', 'https://app.example.com']);
      expect(policy.enableImpersonation).toBe(true);
    });

    it('should update security policy on changed event', async () => {
      const instanceID = TEST_INSTANCE_ID;
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.security.policy.added',
        payload: {
          enableIframeEmbedding: false,
          allowedOrigins: [],
          enableImpersonation: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Change policy
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.security.policy.changed',
        payload: {
          enableIframeEmbedding: true,
          allowedOrigins: ['https://trusted.com'],
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await securityQueries.getSecurityPolicy(instanceID);
      
      expect(policy.enableIframeEmbedding).toBe(true);
      expect(policy.allowedOrigins).toEqual(['https://trusted.com']);
      expect(policy.enableImpersonation).toBe(false); // Unchanged
    });
  });

  describe('Policy Inheritance', () => {
    it('should demonstrate 3-level inheritance for all policies', async () => {
      const instanceID = TEST_INSTANCE_ID;
      const orgID = generateId();
      
      // Level 1: Built-in defaults
      let lockout = await lockoutQueries.getLockoutPolicy(instanceID);
      expect(lockout.maxPasswordAttempts).toBe(10);
      
      let privacy = await privacyQueries.getPrivacyPolicy(instanceID);
      expect(privacy.docsLink).toBe('https://zitadel.com/docs');

      // Level 2: Instance policies
      const lockoutPolicyID = generateId();
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.lockout.policy.added',
        payload: { id: lockoutPolicyID, maxPasswordAttempts: 8, maxOTPAttempts: 5, showFailures: true },
        creator: 'admin',
        owner: instanceID,
      });

      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.privacy.policy.added',
        payload: { tosLink: 'https://instance.com/tos', supportEmail: 'support@instance.com' },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      lockout = await lockoutQueries.getLockoutPolicy(instanceID);
      expect(lockout.maxPasswordAttempts).toBe(8);

      privacy = await privacyQueries.getPrivacyPolicy(instanceID);
      expect(privacy.tosLink).toBe('https://instance.com/tos');

      // Level 3: Org policies
      const orgLockoutPolicyID = generateId();
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.lockout.policy.added',
        payload: { id: orgLockoutPolicyID, maxPasswordAttempts: 3, maxOTPAttempts: 2, showFailures: false },
        creator: 'admin',
        owner: orgID,
      });

      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.privacy.policy.added',
        payload: { tosLink: 'https://org.com/tos', supportEmail: 'support@org.com' },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      lockout = await lockoutQueries.getLockoutPolicy(instanceID, orgID);
      expect(lockout.maxPasswordAttempts).toBe(3); // Org policy overrides instance policy
      expect(lockout.organizationID).toBe(orgID);

      privacy = await privacyQueries.getPrivacyPolicy(instanceID, orgID);
      expect(privacy.tosLink).toBe('https://org.com/tos');
      expect(privacy.organizationID).toBe(orgID);
    }, 20000);
  });

  describe('Cleanup Events', () => {
    it('should delete org policies when org is removed', async () => {
      const instanceID = TEST_INSTANCE_ID;
      const orgID = generateId();
      
      // Create org policies
      const lockoutID = generateId();
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.lockout.policy.added',
        payload: { id: lockoutID, maxPasswordAttempts: 3, maxOTPAttempts: 2, showFailures: true },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      let policy = await lockoutQueries.getLockoutPolicy(instanceID, orgID);
      expect(policy.organizationID).toBe(orgID);

      // Remove org
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.removed',
        payload: {},
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      // Should fall back to built-in default
      policy = await lockoutQueries.getLockoutPolicy(instanceID, orgID);
      expect(policy.id).toBe('built-in-default');
    });
  });
});
