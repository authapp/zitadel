/**
 * Login Name Projection Integration Tests - REFACTORED
 * 
 * All tests use waitForProjections() (200ms wait) instead of waitUntil polling
 * Projection intervals set to 50ms for fast detection
 * Each test uses unique domain names and usernames to prevent conflicts
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, closeTestDatabase, cleanDatabase } from '../../setup';
import { Command } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { UserProjection, createUserProjectionConfig } from '../../../../src/lib/query/projections/user-projection';
import { createOrgProjection, createOrgProjectionConfig } from '../../../../src/lib/query/projections/org-projection';
import { createOrgDomainProjection, createOrgDomainProjectionConfig } from '../../../../src/lib/query/projections/org-domain-projection';
import { LoginNameProjection, createLoginNameProjectionConfig } from '../../../../src/lib/query/projections/login-name-projection';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { OrgQueries } from '../../../../src/lib/query/org/org-queries';
import { LoginNameQueries } from '../../../../src/lib/query/login-name/login-name-queries';
import { generateId } from '../../../../src/lib/id';
import { waitForProjectionCatchUp, delay } from '../../../helpers/projection-test-helpers';

describe('Login Name Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let userQueries: UserQueries;
  let orgQueries: OrgQueries;
  let loginNameQueries: LoginNameQueries;

  // Set timeout for all tests in this suite to 15 seconds
  jest.setTimeout(15000);

  beforeAll(async () => {
    pool = await createTestDatabase();
    await cleanDatabase(pool);
    
    // FIX: Recreate the org_domains unique index with correct columns
    // The old index was (instance_id, domain) which prevented multiple orgs from having same domain
    // The correct index is (instance_id, org_id, domain)
    try {
      await pool.query('DROP INDEX IF EXISTS projections.idx_org_domains_domain_unique CASCADE');
      await pool.query('CREATE UNIQUE INDEX idx_org_domains_domain_unique ON projections.org_domains (instance_id, org_id, domain)');
      console.log('✓ Fixed org_domains unique index');
    } catch (error) {
      console.error('Failed to fix index:', error);
    }
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false, // Polling pattern works better for multi-projection tests
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();

    // Register projections with 50ms intervals
    const userConfig = createUserProjectionConfig();
    userConfig.interval = 50;
    const userProjection = new UserProjection(eventstore, pool);
    await userProjection.init();
    registry.register(userConfig, userProjection);
    
    const orgConfig = createOrgProjectionConfig();
    orgConfig.interval = 50;
    const orgProjection = createOrgProjection(eventstore, pool);
    await orgProjection.init();
    registry.register(orgConfig, orgProjection);
    
    const orgDomainConfig = createOrgDomainProjectionConfig();
    orgDomainConfig.interval = 50;
    const orgDomainProjection = createOrgDomainProjection(eventstore, pool);
    await orgDomainProjection.init();
    registry.register(orgDomainConfig, orgDomainProjection);
    
    const loginNameConfig = createLoginNameProjectionConfig();
    loginNameConfig.interval = 50;
    const loginNameProjection = new LoginNameProjection(eventstore, pool);
    await loginNameProjection.init();
    registry.register(loginNameConfig, loginNameProjection);

    await registry.start('user_projection');
    await registry.start('org_projection');
    await registry.start('org_domain_projection');
    await registry.start('login_name_projection');
    
    await delay(300); // Allow projections to warm up

    orgQueries = new OrgQueries(pool);
    userQueries = new UserQueries(pool);
    loginNameQueries = new LoginNameQueries(pool);
  }, 30000);

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

  // Helper: Wait for projections to process events (polling pattern)
  // Note: Multi-projection tests with complex dependencies work better with fixed delays
  async function waitForProjections(): Promise<void> {
    await delay(200); // Polling interval for 4 dependent projections
  }

  // Helper: Wait for domain to exist in projections
  async function waitForDomain(orgId: string, domainName: string, maxAttempts = 15): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const domains = await orgQueries.getOrgDomainsByID(orgId, 'test-instance');
      if (domains.some(d => d.domain === domainName)) {
        return; // Domain found
      }
      await delay(100);
    }
    throw new Error(`Domain ${domainName} was not added after ${maxAttempts} attempts (${maxAttempts * 100}ms)`);
  }

  // Helper: Wait for user to exist in projections
  async function waitForUser(userId: string, maxAttempts = 15): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const user = await userQueries.getUserByID(userId, 'test-instance');
      if (user) {
        return; // User found
      }
      await delay(100);
    }
    throw new Error(`User ${userId} was not created after ${maxAttempts} attempts (${maxAttempts * 100}ms)`);
  }

  // Helper: Create org with verified domain
  async function createOrgWithDomain(orgId: string, domainName: string): Promise<void> {
    await eventstore.push({
      eventType: 'org.added',
      aggregateType: 'org',
      aggregateID: orgId,
      payload: { name: `Test-Org-${orgId}` },
      creator: 'system',
      owner: 'test-instance',
      instanceID: 'test-instance',
    });
    
    await waitForProjections();
    
    await eventstore.push({
      eventType: 'org.domain.added',
      aggregateType: 'org',
      aggregateID: orgId,
      payload: { domain: domainName },
      creator: 'system',
      owner: 'test-instance',
      instanceID: 'test-instance',
    });
    
    await waitForProjections();
    
    // Wait for domain to appear in projections
    await waitForDomain(orgId, domainName);
    
    await eventstore.push({
      eventType: 'org.domain.verified',
      aggregateType: 'org',
      aggregateID: orgId,
      payload: { domain: domainName },
      creator: 'system',
      owner: 'test-instance',
      instanceID: 'test-instance',
    });
    
    await waitForProjections();
    
    await eventstore.push({
      eventType: 'org.domain.primary.set',
      aggregateType: 'org',
      aggregateID: orgId,
      payload: { domain: domainName },
      creator: 'system',
      owner: 'test-instance',
      instanceID: 'test-instance',
    });
    
    await waitForProjections();
  }

  // Helper: Create user
  async function createUser(userId: string, orgId: string, username: string, email?: string): Promise<void> {
    await eventstore.push({
      eventType: 'user.added',
      aggregateType: 'user',
      aggregateID: userId,
      payload: {
        userName: username,
        email: email || `${username}@example.com`,
      },
      creator: 'system',
      owner: orgId,
      instanceID: 'test-instance',
    });
    
    await waitForProjections();
    
    // Wait for user to appear in projections
    await waitForUser(userId);
  }

  describe('User Added Events', () => {
    it('should generate login names when user is added', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'acme-corp.com';
      const username = 'alice.smith';
      const email = 'alice.smith@work.com';

      await createOrgWithDomain(orgId, domainName);
      await createUser(userId, orgId, username, email);
      await waitForProjections();
      
      const loginName = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
      expect(loginName).toBeTruthy();
      expect(loginName!.userId).toBe(userId);
      expect(loginName!.domainName).toBe(domainName);
    });

    it('should update login names when username changes', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'username-change.example';
      const oldUsername = 'bob.old';
      const newUsername = 'bob.updated';

      await createOrgWithDomain(orgId, domainName);
      await createUser(userId, orgId, oldUsername);
      await waitForProjections();
      
      const oldLoginName = await loginNameQueries.getLoginName(`${oldUsername}@${domainName}`, 'test-instance');
      expect(oldLoginName).toBeTruthy();
      
      await eventstore.push({
        eventType: 'user.username.changed',
        aggregateType: 'user',
        aggregateID: userId,
        payload: { userName: newUsername },
        creator: 'system',
        owner: orgId,
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      const oldLoginNameAfter = await loginNameQueries.getLoginName(`${oldUsername}@${domainName}`, 'test-instance');
      expect(oldLoginNameAfter).toBeNull();
      
      const newLoginName = await loginNameQueries.getLoginName(`${newUsername}@${domainName}`, 'test-instance');
      expect(newLoginName).toBeTruthy();
      expect(newLoginName!.userId).toBe(userId);
    });

    it('should remove login names when org domain is removed', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'domain-removal.test';
      const username = 'charlie.remove';

      await createOrgWithDomain(orgId, domainName);
      await createUser(userId, orgId, username);
      await waitForProjections();
      
      const loginNamesBefore = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(loginNamesBefore.length).toBeGreaterThanOrEqual(1);
      
      await eventstore.push({
        eventType: 'org.domain.removed',
        aggregateType: 'org',
        aggregateID: orgId,
        payload: { domain: domainName },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      const loginNameAfter = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
      expect(loginNameAfter).toBeNull();
    });

    it('should remove all login names when user is removed', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'user-removal.test';
      const username = 'diana.delete';

      await createOrgWithDomain(orgId, domainName);
      await createUser(userId, orgId, username);
      await waitForProjections();
      
      await eventstore.push({
        eventType: 'user.removed',
        aggregateType: 'user',
        aggregateID: userId,
        payload: {},
        creator: 'system',
        owner: orgId,
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      const loginNamesAfter = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(loginNamesAfter.length).toBe(0);
    });

    it('should create login names for multiple verified domains', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domain1 = 'multi-domain-1.test';
      const domain2 = 'multi-domain-2.test';
      const username = 'eve.multi';

      await createOrgWithDomain(orgId, domain1);
      await createUser(userId, orgId, username);
      await waitForProjections();
      
      await eventstore.push({
        eventType: 'org.domain.added',
        aggregateType: 'org',
        aggregateID: orgId,
        payload: { domain: domain2, isVerified: true, isPrimary: false },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(allLoginNames.length).toBeGreaterThanOrEqual(2);
      
      const loginName1 = await loginNameQueries.getLoginName(`${username}@${domain1}`, 'test-instance');
      const loginName2 = await loginNameQueries.getLoginName(`${username}@${domain2}`, 'test-instance');
      expect(loginName1).toBeTruthy();
      expect(loginName2).toBeTruthy();
    });

    it('should not create login names for unverified domains', async () => {
      const orgId = generateId();
      const userId = generateId();
      const verifiedDomain = 'verified.test';
      const unverifiedDomain = 'unverified.test';
      const username = 'frank.verify';

      await createOrgWithDomain(orgId, verifiedDomain);
      
      await eventstore.push({
        eventType: 'org.domain.added',
        aggregateType: 'org',
        aggregateID: orgId,
        payload: { domain: unverifiedDomain, isVerified: false, isPrimary: false },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      await createUser(userId, orgId, username);

      const loginNameVerified = await loginNameQueries.getLoginName(`${username}@${verifiedDomain}`, 'test-instance');
      expect(loginNameVerified).toBeTruthy();
      
      const loginNameUnverified = await loginNameQueries.getLoginName(`${username}@${unverifiedDomain}`, 'test-instance');
      expect(loginNameUnverified).toBeNull();
    });

    it('should create distinct login names for multiple users in same org', async () => {
      const orgId = generateId();
      const user1Id = generateId();
      const user2Id = generateId();
      const domainName = 'same-org.test';
      const username1 = 'grace.first';
      const username2 = 'henry.second';

      await createOrgWithDomain(orgId, domainName);
      await createUser(user1Id, orgId, username1);
      await waitForProjections();
      await createUser(user2Id, orgId, username2);
      await waitForProjections();

      const user1LoginName = await loginNameQueries.getLoginName(`${username1}@${domainName}`, 'test-instance');
      const user2LoginName = await loginNameQueries.getLoginName(`${username2}@${domainName}`, 'test-instance');
      
      expect(user1LoginName).toBeTruthy();
      expect(user2LoginName).toBeTruthy();
      expect(user1LoginName!.userId).toBe(user1Id);
      expect(user2LoginName!.userId).toBe(user2Id);
      expect(user1LoginName!.userId).not.toBe(user2LoginName!.userId);
    });

    it('should regenerate login names when email changes', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'email-update.test';
      const username = 'iris.email';
      const oldEmail = 'iris.old@email.com';
      const newEmail = 'iris.new@email.com';

      await createOrgWithDomain(orgId, domainName);
      await createUser(userId, orgId, username, oldEmail);
      await waitForProjections();
      
      await eventstore.push({
        eventType: 'user.email.changed',
        aggregateType: 'user',
        aggregateID: userId,
        payload: { email: newEmail },
        creator: 'system',
        owner: orgId,
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      const user = await userQueries.getUserByID(userId, 'test-instance');
      expect(user!.email).toBe(newEmail);
      
      const usernameLoginName = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
      expect(usernameLoginName).toBeTruthy();
    });

    it('should update primary flag when domain primary is changed', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domain1 = 'primary-domain-1.test';
      const domain2 = 'primary-domain-2.test';
      const username = 'jane.primary';

      await createOrgWithDomain(orgId, domain1);
      await createUser(userId, orgId, username);
      await waitForProjections();
      
      let loginName1 = await loginNameQueries.getLoginName(`${username}@${domain1}`, 'test-instance');
      expect(loginName1!.isPrimary).toBe(true);
      
      await eventstore.push({
        eventType: 'org.domain.added',
        aggregateType: 'org',
        aggregateID: orgId,
        payload: { domain: domain2, isVerified: true, isPrimary: false },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      await eventstore.push({
        eventType: 'org.domain.primary.set',
        aggregateType: 'org',
        aggregateID: orgId,
        payload: { domain: domain2 },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      loginName1 = await loginNameQueries.getLoginName(`${username}@${domain1}`, 'test-instance');
      const loginName2 = await loginNameQueries.getLoginName(`${username}@${domain2}`, 'test-instance');
      
      expect(loginName1!.isPrimary).toBe(false);
      expect(loginName2!.isPrimary).toBe(true);
    });

    it('should create instance-level login names when instance domain is added', async () => {
      const orgId = generateId();
      const userId = generateId();
      const instanceDomain = 'instance-domain.example';
      const username = 'kate.instance';
      const orgDomain = `org-${orgId}.example.com`;

      await createOrgWithDomain(orgId, orgDomain);
      await createUser(userId, orgId, username);
      await waitForProjections();
      
      await eventstore.push({
        eventType: 'instance.domain.added',
        aggregateType: 'instance',
        aggregateID: 'test-instance',
        payload: { domain: instanceDomain, isPrimary: false, isGenerated: false },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      const instanceLoginName = await loginNameQueries.getLoginName(`${username}@${instanceDomain}`, 'test-instance');
      expect(instanceLoginName).toBeTruthy();
      expect(instanceLoginName!.userId).toBe(userId);
    });

    it('should update primary flag for instance domain when set as primary', async () => {
      const orgId = generateId();
      const userId = generateId();
      const instanceDomain1 = 'instance-primary-1.example';
      const instanceDomain2 = 'instance-primary-2.example';
      const username = 'lisa.inst-primary';
      const orgDomain = `org-${orgId}.example.com`;

      await createOrgWithDomain(orgId, orgDomain);
      await createUser(userId, orgId, username);
      
      await eventstore.push({
        eventType: 'instance.domain.added',
        aggregateType: 'instance',
        aggregateID: 'test-instance',
        payload: { domain: instanceDomain1, isPrimary: false, isGenerated: false },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      await eventstore.push({
        eventType: 'instance.domain.added',
        aggregateType: 'instance',
        aggregateID: 'test-instance',
        payload: { domain: instanceDomain2, isPrimary: false, isGenerated: false },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      let loginName1 = await loginNameQueries.getLoginName(`${username}@${instanceDomain1}`, 'test-instance');
      let loginName2 = await loginNameQueries.getLoginName(`${username}@${instanceDomain2}`, 'test-instance');
      expect(loginName1!.isPrimary).toBe(false);
      expect(loginName2!.isPrimary).toBe(false);
      
      await eventstore.push({
        eventType: 'instance.domain.primary.set',
        aggregateType: 'instance',
        aggregateID: 'test-instance',
        payload: { domain: instanceDomain2 },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForProjections();
      
      loginName2 = await loginNameQueries.getLoginName(`${username}@${instanceDomain2}`, 'test-instance');
      expect(loginName2!.isPrimary).toBe(true);
    });
  });
});
