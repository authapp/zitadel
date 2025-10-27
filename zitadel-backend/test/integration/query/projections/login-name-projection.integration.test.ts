import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase, cleanDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { LoginNameProjection, createLoginNameProjectionConfig } from '../../../../src/lib/query/projections/login-name-projection';
import { UserProjection, createUserProjectionConfig } from '../../../../src/lib/query/projections/user-projection';
import { createOrgProjection, createOrgProjectionConfig } from '../../../../src/lib/query/projections/org-projection';
import { createOrgDomainProjection, createOrgDomainProjectionConfig } from '../../../../src/lib/query/projections/org-domain-projection';
import { Command } from '../../../../src/lib/eventstore';
import { generateId } from '../../../../src/lib/id';
import { OrgQueries } from '../../../../src/lib/query/org/org-queries';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { LoginNameQueries } from '../../../../src/lib/query/login-name/login-name-queries';

describe('Login Name Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let orgQueries: OrgQueries;
  let userQueries: UserQueries;
  let loginNameQueries: LoginNameQueries;

  beforeAll(async () => {
    // Create database connection once
    pool = await createTestDatabase();
    
    // Clean database once at start
    await cleanDatabase(pool);
    
    // Create eventstore once
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    // Create and initialize registry once
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register all projections once
    const userConfig = createUserProjectionConfig();
    userConfig.interval = 50; // Optimized: 50ms for faster projection detection
    const userProjection = new UserProjection(eventstore, pool);
    registry.register(userConfig, userProjection);
    
    const orgConfig = createOrgProjectionConfig();
    orgConfig.interval = 50; // Optimized: 50ms for faster projection detection
    const orgProjection = createOrgProjection(eventstore, pool);
    registry.register(orgConfig, orgProjection);
    
    const orgDomainConfig = createOrgDomainProjectionConfig();
    orgDomainConfig.interval = 50; // Optimized: 50ms for faster projection detection
    const orgDomainProjection = createOrgDomainProjection(eventstore, pool);
    registry.register(orgDomainConfig, orgDomainProjection);
    
    const loginNameConfig = createLoginNameProjectionConfig();
    loginNameConfig.interval = 50; // Optimized: 50ms for faster projection detection
    const loginNameProjection = new LoginNameProjection(eventstore, pool);
    registry.register(loginNameConfig, loginNameProjection);
    
    // Start all projections once and keep them running
    await registry.start('user_projection');
    await registry.start('org_projection');
    await registry.start('org_domain_projection');
    await registry.start('login_name_projection');
    
    // Give projections time to fully initialize and enter live mode
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Initialize query interfaces
    orgQueries = new OrgQueries(pool);
    userQueries = new UserQueries(pool);
    loginNameQueries = new LoginNameQueries(pool);
  }, 30000); // 30 second timeout for beforeAll

  afterAll(async () => {
    // Stop all projections at the end
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore if already stopped
      }
    }
    
    // Close database connection
    await closeTestDatabase();
  });

  /**
   * Helper: Poll until a condition is met or timeout
   * Optimized: Reduced defaults for faster test execution
   */
  async function waitUntil(
    condition: () => Promise<boolean>,
    timeout: number = 3000, // Optimized: 3s default (was 5s)
    pollInterval: number = 50 // Optimized: 50ms (was 100ms)
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    return false;
  }

  /**
   * Helper: Create org with verified domain
   * Polls to ensure projections have materialized the data
   */
  async function createOrgWithDomain(orgId: string, domainName: string): Promise<void> {
    // Push org.added event with unique name
    await eventstore.push({
      instanceID: 'test-instance',
      aggregateType: 'org',
      aggregateID: orgId,
      eventType: 'org.added',
      payload: {
        name: `Test-Org-${orgId}`, // Unique org name
      },
      creator: 'system',
      owner: orgId,
    });
    
    // Wait until org is materialized
    const orgMaterialized = await waitUntil(async () => {
      const org = await orgQueries.getOrgByID(orgId);
      return org !== null;
    }, 5000);
    
    if (!orgMaterialized) {
      throw new Error(`Org ${orgId} was not materialized in time`);
    }
    
    // Small delay to ensure org projection is fully committed before adding domain
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Push org.domain.added event (unverified, not primary)
    await eventstore.push({
      instanceID: 'test-instance',
      aggregateType: 'org',
      aggregateID: orgId,
      eventType: 'org.domain.added',
      payload: {
        domain: domainName,
      },
      creator: 'system',
      owner: orgId,
    });
    
    // Wait for domain to be added
    const domainAdded = await waitUntil(async () => {
      const domains = await orgQueries.getOrgDomainsByID(orgId);
      return domains.some(d => d.domain === domainName);
    }, 5000);
    
    if (!domainAdded) {
      throw new Error(`Domain ${domainName} was not added in time`);
    }
    
    // Push org.domain.verified event
    await eventstore.push({
      instanceID: 'test-instance',
      aggregateType: 'org',
      aggregateID: orgId,
      eventType: 'org.domain.verified',
      payload: {
        domain: domainName,
      },
      creator: 'system',
      owner: orgId,
    });
    
    // Wait for domain to be verified
    const domainVerified = await waitUntil(async () => {
      const domains = await orgQueries.getOrgDomainsByID(orgId);
      return domains.some(d => d.domain === domainName && d.isVerified);
    }, 5000);
    
    if (!domainVerified) {
      throw new Error(`Domain ${domainName} was not verified in time`);
    }
    
    // Push org.domain.primary.set event
    await eventstore.push({
      instanceID: 'test-instance',
      aggregateType: 'org',
      aggregateID: orgId,
      eventType: 'org.domain.primary.set',
      payload: {
        domain: domainName,
      },
      creator: 'system',
      owner: orgId,
    });
    
    // Wait until domain is primary
    const domainMaterialized = await waitUntil(async () => {
      const domains = await orgQueries.getOrgDomainsByID(orgId);
      return domains.some(d => d.domain === domainName && d.isVerified && d.isPrimary);
    }, 5000);
    
    if (!domainMaterialized) {
      throw new Error(`Domain ${domainName} was not materialized as primary in time`);
    }
  }

  /**
   * Helper: Create user
   * Polls to ensure user projection has materialized before returning
   */
  async function createUser(userId: string, orgId: string, username: string, email?: string): Promise<void> {
    const command: Command = {
      instanceID: 'test-instance',
      aggregateType: 'user',
      aggregateID: userId,
      eventType: 'user.added',
      payload: {
        userName: username,
        email: email || `${username}@example.com`,
      },
      creator: 'system',
      owner: orgId,
    };

    await eventstore.push(command);
    
    // Wait until user is materialized
    const userMaterialized = await waitUntil(async () => {
      const user = await userQueries.getUserByID(userId, 'test-instance');
      return user !== null;
    }, 5000); // Optimized: 5s timeout (was 20s)
    
    if (!userMaterialized) {
      throw new Error(`User ${userId} was not materialized in time`);
    }
  }

  describe('User Added Events', () => {
    it('should generate login names when user is added', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'company.com';
      const username = 'testuser';
      const email = 'testuser@email.com';

      // Create org with verified domain
      await createOrgWithDomain(orgId, domainName);
      
      // Create user
      await createUser(userId, orgId, username, email);
      
      // Wait until login names are materialized in the login_names_projection table
      // Login name projection depends on user projection and org domain projection
      const loginNamesMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s) // 15 second timeout
      
      if (!loginNamesMaterialized) {
        // Debug: Check what login names exist for this user
        const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
        console.log('Login names in projection:', allLoginNames);
        throw new Error(`Login name ${username}@${domainName} was not materialized in time`);
      }
      
      expect(loginNamesMaterialized).toBe(true);
      
      // Verify all expected login names are in the projection using query interface
      const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      
      expect(allLoginNames.length).toBeGreaterThanOrEqual(1);
      
      // Should have username@domain login name
      const usernameLoginName = allLoginNames.find(ln => ln.loginName === `${username}@${domainName}`);
      expect(usernameLoginName).toBeTruthy();
      expect(usernameLoginName!.domainName).toBe(domainName);
      expect(usernameLoginName!.userId).toBe(userId);
      
      // Verify user can be retrieved by ID
      const user = await userQueries.getUserByID(userId, 'test-instance');
      expect(user).toBeTruthy();
      expect(user!.id).toBe(userId);
      expect(user!.username).toBe(username);
      expect(user!.email).toBe(email);
    }, 30000);

    it('should update login names when username changes', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'change.com';
      const oldUsername = 'oldusername';
      const newUsername = 'newusername';
      const email = 'user@email.com';

      // Create org with verified domain
      await createOrgWithDomain(orgId, domainName);
      
      // Create user with old username
      await createUser(userId, orgId, oldUsername, email);
      
      // Wait until initial login names are materialized
      const initialLoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${oldUsername}@${domainName}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(initialLoginNameMaterialized).toBe(true);
      
      // Verify old login name exists
      const oldLoginName = await loginNameQueries.getLoginName(`${oldUsername}@${domainName}`, 'test-instance');
      expect(oldLoginName).toBeTruthy();
      expect(oldLoginName!.userId).toBe(userId);
      
      // Change username
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.username.changed',
        payload: {
          userName: newUsername,
        },
        creator: 'system',
        owner: orgId,
      });
      
      // Wait until login name projection has updated (removed old, created new)
      const loginNameProjectionUpdated = await waitUntil(async () => {
        const newLoginName = await loginNameQueries.getLoginName(`${newUsername}@${domainName}`, 'test-instance');
        const oldLoginNameCheck = await loginNameQueries.getLoginName(`${oldUsername}@${domainName}`, 'test-instance');
        return newLoginName !== null && 
               newLoginName.userId === userId && 
               oldLoginNameCheck === null;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(loginNameProjectionUpdated).toBe(true);
      
      // Verify old login name no longer exists
      const oldLoginNameAfterUpdate = await loginNameQueries.getLoginName(`${oldUsername}@${domainName}`, 'test-instance');
      expect(oldLoginNameAfterUpdate).toBeNull();
      
      // Verify new login name exists
      const newLoginNameAfterUpdate = await loginNameQueries.getLoginName(`${newUsername}@${domainName}`, 'test-instance');
      expect(newLoginNameAfterUpdate).toBeTruthy();
      expect(newLoginNameAfterUpdate!.userId).toBe(userId);
      expect(newLoginNameAfterUpdate!.loginName).toBe(`${newUsername}@${domainName}`);
      expect(newLoginNameAfterUpdate!.domainName).toBe(domainName);
      
      // Verify all login names for the user
      const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(allLoginNames.length).toBeGreaterThanOrEqual(1);
      
      // None should have the old username
      const hasOldUsername = allLoginNames.some(ln => ln.loginName.includes(oldUsername));
      expect(hasOldUsername).toBe(false);
      
      // At least one should have the new username
      const hasNewUsername = allLoginNames.some(ln => ln.loginName === `${newUsername}@${domainName}`);
      expect(hasNewUsername).toBe(true);
    }, 30000);

    it('should remove login names when org domain is removed', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'removedomain.com';
      const username = 'testuser';

      // Create org with verified domain
      await createOrgWithDomain(orgId, domainName);
      
      // Create user
      await createUser(userId, orgId, username);
      
      // Wait until login names are materialized
      const initialLoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(initialLoginNameMaterialized).toBe(true);
      
      // Verify login names exist for the domain
      const loginNamesBeforeRemoval = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(loginNamesBeforeRemoval.length).toBeGreaterThanOrEqual(1);
      const hasLoginNameForDomain = loginNamesBeforeRemoval.some(ln => ln.domainName === domainName);
      expect(hasLoginNameForDomain).toBe(true);
      
      // Remove the domain
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.domain.removed',
        payload: {
          domain: domainName,
        },
        creator: 'system',
        owner: orgId,
      });
      
      // Wait until login names for this domain are removed
      const loginNamesRemoved = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
        return loginName === null;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(loginNamesRemoved).toBe(true);
      
      // Verify login name no longer exists
      const loginNameAfterRemoval = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
      expect(loginNameAfterRemoval).toBeNull();
      
      // Verify all login names for this domain are removed
      const allLoginNamesAfterRemoval = await loginNameQueries.getLoginNamesByDomain(domainName, 'test-instance');
      expect(allLoginNamesAfterRemoval.length).toBe(0);
      
      // Verify user still exists (only login names removed, not the user)
      const user = await userQueries.getUserByID(userId, 'test-instance');
      expect(user).toBeTruthy();
      expect(user!.id).toBe(userId);
    }, 30000);

    it('should remove all login names when user is removed', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'deleteuser.com';
      const username = 'usertoberemoved';

      // Create org with verified domain
      await createOrgWithDomain(orgId, domainName);
      
      // Create user
      await createUser(userId, orgId, username);
      
      // Wait until login names are materialized
      const initialLoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(initialLoginNameMaterialized).toBe(true);
      
      // Verify login names exist for the user
      const loginNamesBeforeRemoval = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(loginNamesBeforeRemoval.length).toBeGreaterThanOrEqual(1);
      
      // Get count of login names before removal for verification
      const loginNameCountBefore = loginNamesBeforeRemoval.length;
      expect(loginNameCountBefore).toBeGreaterThan(0);
      
      // Remove the user
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.removed',
        payload: {},
        creator: 'system',
        owner: orgId,
      });
      
      // Wait until all login names for this user are removed
      const allLoginNamesRemoved = await waitUntil(async () => {
        const loginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
        return loginNames.length === 0;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(allLoginNamesRemoved).toBe(true);
      
      // Verify specific login name no longer exists
      const specificLoginName = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
      expect(specificLoginName).toBeNull();
      
      // Verify all login names for the user are removed
      const allLoginNamesAfterRemoval = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(allLoginNamesAfterRemoval.length).toBe(0);
      
      // Verify we can't find the user by login name anymore
      const userIdByLoginName = await loginNameQueries.getUserIdByLoginName(`${username}@${domainName}`, 'test-instance');
      expect(userIdByLoginName).toBeNull();
      
      // Note: User projection might soft-delete, so we verify via login names removal
      // The important part is login names are cleaned up when user is removed
    }, 30000);

    it('should create login names for multiple verified domains', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domain1 = 'primary-multi.com';
      const domain2 = 'secondary-multi.com';
      const username = 'multidomainuser';

      // Create org with first verified domain
      await createOrgWithDomain(orgId, domain1);
      
      // Create user
      await createUser(userId, orgId, username);
      
      // Wait until initial login names are materialized for first domain
      const firstDomainLoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${domain1}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(firstDomainLoginNameMaterialized).toBe(true);
      
      // Verify login name exists for first domain
      const loginNamesAfterFirstDomain = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(loginNamesAfterFirstDomain.length).toBeGreaterThanOrEqual(1);
      const hasFirstDomain = loginNamesAfterFirstDomain.some(ln => ln.domainName === domain1);
      expect(hasFirstDomain).toBe(true);
      
      // Add second verified domain to the same org
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.domain.added',
        payload: {
          domain: domain2,
          isVerified: true,
          isPrimary: false,
        },
        creator: 'system',
        owner: orgId,
      });
      
      // Wait until domain is materialized
      const secondDomainMaterialized = await waitUntil(async () => {
        const domains = await orgQueries.getOrgDomainsByID(orgId);
        return domains.some(d => d.domain === domain2 && d.isVerified);
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(secondDomainMaterialized).toBe(true);
      
      // Wait until login names are created for second domain
      const secondDomainLoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${domain2}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(secondDomainLoginNameMaterialized).toBe(true);
      
      // Verify user has login names for both domains
      const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(allLoginNames.length).toBeGreaterThanOrEqual(2);
      
      // Verify login name for first domain
      const loginNameDomain1 = await loginNameQueries.getLoginName(`${username}@${domain1}`, 'test-instance');
      expect(loginNameDomain1).toBeTruthy();
      expect(loginNameDomain1!.userId).toBe(userId);
      expect(loginNameDomain1!.domainName).toBe(domain1);
      
      // Verify login name for second domain
      const loginNameDomain2 = await loginNameQueries.getLoginName(`${username}@${domain2}`, 'test-instance');
      expect(loginNameDomain2).toBeTruthy();
      expect(loginNameDomain2!.userId).toBe(userId);
      expect(loginNameDomain2!.domainName).toBe(domain2);
      
      // Verify both domains are present in the user's login names
      const hasBothDomains = allLoginNames.some(ln => ln.domainName === domain1) &&
                             allLoginNames.some(ln => ln.domainName === domain2);
      expect(hasBothDomains).toBe(true);
    }, 40000);

    it('should not create login names for unverified domains', async () => {
      const orgId = generateId();
      const userId = generateId();
      const verifiedDomain = 'verified-test.com';
      const unverifiedDomain = 'unverified-test.com';
      const username = 'verificationtest';

      // Create org with one verified domain
      await createOrgWithDomain(orgId, verifiedDomain);

      // Add UNVERIFIED domain to the same org
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.domain.added',
        payload: {
          domain: unverifiedDomain,
          isVerified: false,
          isPrimary: false,
        },
        creator: 'system',
        owner: orgId,
      });

      // Wait for unverified domain to be materialized
      const domainMaterialized = await waitUntil(async () => {
        const domains = await orgQueries.getOrgDomainsByID(orgId);
        return domains.some(d => d.domain === unverifiedDomain && !d.isVerified);
      }, 5000); // Optimized: 5s timeout (was 15s)
      expect(domainMaterialized).toBe(true);

      // Create user - login names should only be created for verified domain
      await createUser(userId, orgId, username);

      // Verify login name EXISTS for verified domain
      const loginNameForVerified = await loginNameQueries.getLoginName(`${username}@${verifiedDomain}`, 'test-instance');
      expect(loginNameForVerified).toBeTruthy();
      expect(loginNameForVerified!.userId).toBe(userId);
      expect(loginNameForVerified!.domainName).toBe(verifiedDomain);

      // Verify NO login names are created for unverified domain
      const loginNameForUnverified = await loginNameQueries.getLoginName(`${username}@${unverifiedDomain}`, 'test-instance');
      expect(loginNameForUnverified).toBeNull();

      // Double-check by getting all login names for the user
      const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      
      // Should have login name for verified domain
      const hasVerifiedDomainLoginName = allLoginNames.some(ln => ln.domainName === verifiedDomain);
      expect(hasVerifiedDomainLoginName).toBe(true);
      
      // Should NOT have login name for unverified domain
      const hasUnverifiedDomainLoginName = allLoginNames.some(ln => ln.domainName === unverifiedDomain);
      expect(hasUnverifiedDomainLoginName).toBe(false);

      // Verify domain states
      const domains = await orgQueries.getOrgDomainsByID(orgId);
      const verifiedDomainObj = domains.find(d => d.domain === verifiedDomain);
      const unverifiedDomainObj = domains.find(d => d.domain === unverifiedDomain);
      
      expect(verifiedDomainObj?.isVerified).toBe(true);
      expect(unverifiedDomainObj?.isVerified).toBe(false);
    }, 30000);

    it('should create distinct login names for multiple users in same org', async () => {
      const orgId = generateId();
      const user1Id = generateId();
      const user2Id = generateId();
      const domainName = 'multiuser-org.com';
      const username1 = 'firstuser';
      const username2 = 'seconduser';

      // Create org with verified domain
      await createOrgWithDomain(orgId, domainName);

      // Create first user
      await createUser(user1Id, orgId, username1);

      // Wait until first user's login names are materialized
      const user1LoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username1}@${domainName}`, 'test-instance');
        return loginName !== null && loginName.userId === user1Id;
      }, 5000); // Optimized: 5s timeout (was 15s)

      expect(user1LoginNameMaterialized).toBe(true);

      // Create second user
      await createUser(user2Id, orgId, username2);

      // Wait until second user's login names are materialized
      const user2LoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username2}@${domainName}`, 'test-instance');
        return loginName !== null && loginName.userId === user2Id;
      }, 5000); // Optimized: 5s timeout (was 15s)

      expect(user2LoginNameMaterialized).toBe(true);

      // Verify first user's login name
      const user1LoginName = await loginNameQueries.getLoginName(`${username1}@${domainName}`, 'test-instance');
      expect(user1LoginName).toBeTruthy();
      expect(user1LoginName!.userId).toBe(user1Id);
      expect(user1LoginName!.loginName).toBe(`${username1}@${domainName}`);

      // Verify second user's login name
      const user2LoginName = await loginNameQueries.getLoginName(`${username2}@${domainName}`, 'test-instance');
      expect(user2LoginName).toBeTruthy();
      expect(user2LoginName!.userId).toBe(user2Id);
      expect(user2LoginName!.loginName).toBe(`${username2}@${domainName}`);

      // Verify they are different users
      expect(user1LoginName!.userId).not.toBe(user2LoginName!.userId);

      // Verify using getUserIdByLoginName returns correct user IDs
      const retrievedUser1Id = await loginNameQueries.getUserIdByLoginName(`${username1}@${domainName}`, 'test-instance');
      const retrievedUser2Id = await loginNameQueries.getUserIdByLoginName(`${username2}@${domainName}`, 'test-instance');
      
      expect(retrievedUser1Id).toBe(user1Id);
      expect(retrievedUser2Id).toBe(user2Id);
      expect(retrievedUser1Id).not.toBe(retrievedUser2Id);

      // Verify each user has their own login names
      const user1AllLoginNames = await loginNameQueries.getLoginNamesByUserID(user1Id, 'test-instance');
      const user2AllLoginNames = await loginNameQueries.getLoginNamesByUserID(user2Id, 'test-instance');

      expect(user1AllLoginNames.length).toBeGreaterThanOrEqual(1);
      expect(user2AllLoginNames.length).toBeGreaterThanOrEqual(1);

      // Verify no overlap in login names between users
      const user1LoginNameStrings = user1AllLoginNames.map(ln => ln.loginName);
      const user2LoginNameStrings = user2AllLoginNames.map(ln => ln.loginName);
      const hasOverlap = user1LoginNameStrings.some(ln => user2LoginNameStrings.includes(ln));
      expect(hasOverlap).toBe(false);
    }, 40000);

    it('should regenerate login names when email changes', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domainName = 'emailchange.com';
      const username = 'emailuser';
      const oldEmail = 'old@email.com';
      const newEmail = 'new@email.com';

      // Create org with verified domain
      await createOrgWithDomain(orgId, domainName);
      
      // Create user with initial email
      await createUser(userId, orgId, username, oldEmail);
      
      // Verify user was created with old email
      const userBeforeEmailChange = await userQueries.getUserByID(userId, 'test-instance');
      expect(userBeforeEmailChange).toBeTruthy();
      expect(userBeforeEmailChange!.email).toBe(oldEmail);
      
      // Wait until initial login names are materialized
      const initialLoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(initialLoginNameMaterialized).toBe(true);
      
      // Change email
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: userId,
        eventType: 'user.email.changed',
        payload: {
          email: newEmail,
        },
        creator: 'system',
        owner: orgId,
      });
      
      // Wait for user projection to process email change
      const userEmailUpdated = await waitUntil(async () => {
        const user = await userQueries.getUserByID(userId, 'test-instance');
        return user !== null && user.email === newEmail;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(userEmailUpdated).toBe(true);
      
      // Verify user email was updated in user projection
      const userAfterEmailChange = await userQueries.getUserByID(userId, 'test-instance');
      expect(userAfterEmailChange).toBeTruthy();
      expect(userAfterEmailChange!.email).toBe(newEmail);
      
      // Verify username-based login name still exists
      const usernameLoginName = await loginNameQueries.getLoginName(`${username}@${domainName}`, 'test-instance');
      expect(usernameLoginName).toBeTruthy();
      expect(usernameLoginName!.userId).toBe(userId);
      
      // Get all login names for the user
      const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      
      expect(allLoginNames.length).toBeGreaterThanOrEqual(1);
      
      // Should still be able to find user by their username@domain
      const userIdLookup = await loginNameQueries.getUserIdByLoginName(`${username}@${domainName}`, 'test-instance');
      expect(userIdLookup).toBe(userId);
    }, 30000);

    it('should update primary flag when domain primary is changed', async () => {
      const orgId = generateId();
      const userId = generateId();
      const domain1 = 'first-primary.com';
      const domain2 = 'second-primary.com';
      const username = 'primaryswitch';

      // Create org with first domain as primary
      await createOrgWithDomain(orgId, domain1);
      
      // Create user
      await createUser(userId, orgId, username);
      
      // Wait until login names are materialized for first domain
      const firstDomainLoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${domain1}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(firstDomainLoginNameMaterialized).toBe(true);
      
      // Verify first domain login name is primary (it's the only domain)
      let loginName1 = await loginNameQueries.getLoginName(`${username}@${domain1}`, 'test-instance');
      expect(loginName1).toBeTruthy();
      expect(loginName1!.isPrimary).toBe(true);
      
      // Add second domain (not primary)
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.domain.added',
        payload: {
          domain: domain2,
          isVerified: true,
          isPrimary: false,
        },
        creator: 'system',
        owner: orgId,
      });
      
      // Wait until second domain's login names are created
      const secondDomainLoginNameMaterialized = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${domain2}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(secondDomainLoginNameMaterialized).toBe(true);
      
      // Set second domain as primary
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'org',
        aggregateID: orgId,
        eventType: 'org.domain.primary.set',
        payload: {
          domain: domain2,
        },
        creator: 'system',
        owner: orgId,
      });
      
      // Wait until primary flags are updated
      const primaryFlagsUpdated = await waitUntil(async () => {
        const ln1 = await loginNameQueries.getLoginName(`${username}@${domain1}`, 'test-instance');
        const ln2 = await loginNameQueries.getLoginName(`${username}@${domain2}`, 'test-instance');
        return ln1 !== null && !ln1.isPrimary && ln2 !== null && ln2.isPrimary;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(primaryFlagsUpdated).toBe(true);
      
      // Verify first domain login name is NO LONGER primary
      loginName1 = await loginNameQueries.getLoginName(`${username}@${domain1}`, 'test-instance');
      expect(loginName1).toBeTruthy();
      expect(loginName1!.isPrimary).toBe(false);
      
      // Verify second domain login name IS now primary
      const loginName2 = await loginNameQueries.getLoginName(`${username}@${domain2}`, 'test-instance');
      expect(loginName2).toBeTruthy();
      expect(loginName2!.isPrimary).toBe(true);
      
      // Verify using getLoginNamesByUserID
      const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      const domain1LoginNames = allLoginNames.filter(ln => ln.domainName === domain1);
      const domain2LoginNames = allLoginNames.filter(ln => ln.domainName === domain2);
      
      // All domain1 login names should be non-primary
      domain1LoginNames.forEach(ln => {
        expect(ln.isPrimary).toBe(false);
      });
      
      // All domain2 login names should be primary
      domain2LoginNames.forEach(ln => {
        expect(ln.isPrimary).toBe(true);
      });
    }, 30000);

    it('should create instance-level login names when instance domain is added', async () => {
      const orgId = generateId();
      const userId = generateId();
      const instanceDomain = 'instance.example.com';
      const username = 'instanceuser';
      const orgDomain = `org-${orgId}.example.com`;  // Unique domain per test

      // Create org with verified domain first
      await createOrgWithDomain(orgId, orgDomain);
      
      // Create user in the org
      await createUser(userId, orgId, username);
      
      // Verify user exists and has org domain login names
      const initialLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      expect(initialLoginNames.length).toBeGreaterThanOrEqual(1);
      
      // Add instance domain
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'instance',
        aggregateID: 'test-instance',
        eventType: 'instance.domain.added',
        payload: {
          domain: instanceDomain,
          isPrimary: false,
          isGenerated: false,
        },
        creator: 'system',
        owner: 'test-instance',
      });
      
      // Wait until login name for instance domain is created
      const instanceDomainLoginNameCreated = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${instanceDomain}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(instanceDomainLoginNameCreated).toBe(true);
      
      // Verify instance domain login name exists
      const instanceLoginName = await loginNameQueries.getLoginName(`${username}@${instanceDomain}`, 'test-instance');
      expect(instanceLoginName).toBeTruthy();
      expect(instanceLoginName!.userId).toBe(userId);
      expect(instanceLoginName!.domainName).toBe(instanceDomain);
      expect(instanceLoginName!.isPrimary).toBe(false);
      
      // Verify user now has login names for both org domain and instance domain
      const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      
      const hasOrgDomainLoginName = allLoginNames.some(ln => ln.domainName === orgDomain);
      const hasInstanceDomainLoginName = allLoginNames.some(ln => ln.domainName === instanceDomain);
      
      expect(hasOrgDomainLoginName).toBe(true);
      expect(hasInstanceDomainLoginName).toBe(true);
      
      // Should be able to find user by instance domain login name
      const userIdLookup = await loginNameQueries.getUserIdByLoginName(`${username}@${instanceDomain}`, 'test-instance');
      expect(userIdLookup).toBe(userId);
    }, 30000);

    it('should update primary flag for instance domain when set as primary', async () => {
      const orgId = generateId();
      const userId = generateId();
      const instanceDomain1 = 'instance1.example.com';
      const instanceDomain2 = 'instance2.example.com';
      const username = 'instanceprimaryuser';
      const orgDomain = `org-${orgId}.example.com`;  // Unique domain per test

      // Create org with verified domain
      await createOrgWithDomain(orgId, orgDomain);
      
      // Create user
      await createUser(userId, orgId, username);
      
      // Add first instance domain
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'instance',
        aggregateID: 'test-instance',
        eventType: 'instance.domain.added',
        payload: {
          domain: instanceDomain1,
          isPrimary: false,
          isGenerated: false,
        },
        creator: 'system',
        owner: 'test-instance',
      });
      
      // Wait for first instance domain login names
      const firstInstanceDomainCreated = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${instanceDomain1}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(firstInstanceDomainCreated).toBe(true);
      
      // Add second instance domain
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'instance',
        aggregateID: 'test-instance',
        eventType: 'instance.domain.added',
        payload: {
          domain: instanceDomain2,
          isPrimary: false,
          isGenerated: false,
        },
        creator: 'system',
        owner: 'test-instance',
      });
      
      // Wait for second instance domain login names
      const secondInstanceDomainCreated = await waitUntil(async () => {
        const loginName = await loginNameQueries.getLoginName(`${username}@${instanceDomain2}`, 'test-instance');
        return loginName !== null && loginName.userId === userId;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(secondInstanceDomainCreated).toBe(true);
      
      // Both should initially be non-primary
      let loginName1 = await loginNameQueries.getLoginName(`${username}@${instanceDomain1}`, 'test-instance');
      let loginName2 = await loginNameQueries.getLoginName(`${username}@${instanceDomain2}`, 'test-instance');
      expect(loginName1!.isPrimary).toBe(false);
      expect(loginName2!.isPrimary).toBe(false);
      
      // Set second instance domain as primary
      await eventstore.push({
        instanceID: 'test-instance',
        aggregateType: 'instance',
        aggregateID: 'test-instance',
        eventType: 'instance.domain.primary.set',
        payload: {
          domain: instanceDomain2,
        },
        creator: 'system',
        owner: 'test-instance',
      });
      
      // Wait until primary flag is updated for second domain
      const primaryFlagUpdated = await waitUntil(async () => {
        const ln2 = await loginNameQueries.getLoginName(`${username}@${instanceDomain2}`, 'test-instance');
        return ln2 !== null && ln2.isPrimary === true;
      }, 5000); // Optimized: 5s timeout (was 15s)
      
      expect(primaryFlagUpdated).toBe(true);
      
      // Verify second domain is now primary
      loginName2 = await loginNameQueries.getLoginName(`${username}@${instanceDomain2}`, 'test-instance');
      expect(loginName2).toBeTruthy();
      expect(loginName2!.isPrimary).toBe(true);
      
      // Note: instance.domain.primary.set only sets the specified domain as primary
      // It does NOT unset other domains (different from org.domain.primary.set)
      loginName1 = await loginNameQueries.getLoginName(`${username}@${instanceDomain1}`, 'test-instance');
      expect(loginName1!.isPrimary).toBe(false);
      
      // Verify all instance domain login names for domain2 are primary
      const allLoginNames = await loginNameQueries.getLoginNamesByUserID(userId, 'test-instance');
      const instanceDomain2LoginNames = allLoginNames.filter(ln => ln.domainName === instanceDomain2);
      
      instanceDomain2LoginNames.forEach(ln => {
        expect(ln.isPrimary).toBe(true);
      });
      
      // Should be able to find user by instance domain
      const userIdLookup = await loginNameQueries.getUserIdByLoginName(`${username}@${instanceDomain2}`, 'test-instance');
      expect(userIdLookup).toBe(userId);
    }, 30000);
  });
});
