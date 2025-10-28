/**
 * Instance Commands - Complete Integration Tests
 * 
 * Tests the full command→event→projection→query flow for instance management
 * Uses proper event sourcing instead of direct table writes
 * Verifies projection updates at each step
 * 
 * Following the established pattern from org-member.test.ts and project.test.ts
 * 
 * Commands tested:
 * - Instance Domain Management (add, setDefault, remove)
 * - Instance Features (set, reset)
 * - Instance Member Management (add, change, remove)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder } from '../../helpers/test-data-builders';
import { InstanceProjection } from '../../../src/lib/query/projections/instance-projection';
import { InstanceDomainProjection } from '../../../src/lib/query/projections/instance-domain-projection';
import { InstanceMemberProjection } from '../../../src/lib/query/projections/instance-member-projection';
import { InstanceQueries } from '../../../src/lib/query/instance/instance-queries';
import { InstanceMemberQueries } from '../../../src/lib/query/member/instance-member-queries';

describe('Instance Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let instanceProjection: InstanceProjection;
  let instanceDomainProjection: InstanceDomainProjection;
  let instanceMemberProjection: InstanceMemberProjection;
  let instanceQueries: InstanceQueries;
  let instanceMemberQueries: InstanceMemberQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projections
    instanceProjection = new InstanceProjection(ctx.eventstore, pool);
    await instanceProjection.init();
    
    instanceDomainProjection = new InstanceDomainProjection(ctx.eventstore, pool);
    await instanceDomainProjection.init();
    
    instanceMemberProjection = new InstanceMemberProjection(ctx.eventstore, pool);
    await instanceMemberProjection.init();
    
    // Initialize query layers
    instanceQueries = new InstanceQueries(pool);
    instanceMemberQueries = new InstanceMemberQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clear all events before each test
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE projections.instances CASCADE');
    await pool.query('TRUNCATE projections.instance_domains CASCADE');
    await pool.query('TRUNCATE projections.instance_members CASCADE');
  });

  /**
   * Helper: Create or get test instance
   * Since instance commands expect the instance to exist,
   * we'll create it using setupInstance first
   */
  async function getTestInstance() {
    const instanceID = 'test-instance';
    
    // Check if instance already exists by trying to get events
    const existingEvents = await ctx.getEvents('instance', instanceID);
    
    if (existingEvents.length === 0) {
      // Instance doesn't exist, create it
      console.log('Creating test instance...');
      await ctx.commands.setupInstance(ctx.createContext(), {
        instanceID,
        instanceName: 'Test Instance',
        defaultOrgName: 'Test Org',
        adminUser: {
          username: 'admin',
          email: 'admin@test.com',
          firstName: 'Admin',
          lastName: 'User'
        }
      });
      
      // Process the instance creation through projections
      const events = await ctx.getEvents('*', '*');
      for (const event of events) {
        try {
          await instanceProjection.reduce(event);
        } catch (err: any) {
          // Ignore errors for non-instance events
        }
      }
      
      console.log('✓ Test instance created');
    }
    
    return { instanceID };
  }

  /**
   * Helper: Create a user for member tests
   */
  async function createTestUser() {
    const userData = new UserBuilder()
      .withOrgID('test-org')
      .withUsername(`instance.user.${Date.now()}`)
      .withEmail(`instance.${Date.now()}@example.com`)
      .build();

    const user = await ctx.commands.addHumanUser(ctx.createContext(), userData);
    
    console.log(`✓ Created test user: ${user.userID}`);
    return user;
  }

  /**
   * Helper: Process all projections
   */
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projections...`);
    
    for (const event of events) {
      try {
        await instanceProjection.reduce(event);
        await instanceDomainProjection.reduce(event);
        await instanceMemberProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType} for ${event.aggregateID}`);
      } catch (err: any) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err.message);
      }
    }
    
    // Small delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Verify domain via Query Layer
   */
  async function assertDomainInQuery(instanceID: string, domain: string) {
    const result = await instanceQueries.searchInstanceDomains({
      instanceID,
      domain,
      limit: 1,
      offset: 0
    });
    
    expect(result.domains.length).toBeGreaterThan(0);
    const foundDomain = result.domains.find(d => d.domain === domain);
    expect(foundDomain).toBeDefined();
    console.log(`✓ Domain verified via query layer: ${domain}`);
    return foundDomain!;
  }

  /**
   * Helper: Verify domain does NOT exist via Query Layer
   */
  async function assertDomainNotInQuery(instanceID: string, domain: string) {
    const result = await instanceQueries.searchInstanceDomains({
      instanceID,
      domain,
      limit: 10,
      offset: 0
    });
    
    const foundDomain = result.domains.find(d => d.domain === domain);
    expect(foundDomain).toBeUndefined();
    console.log(`✓ Verified domain removed via query layer: ${domain}`);
  }

  /**
   * Helper: Verify member via Query Layer
   */
  async function assertMemberInQuery(
    instanceID: string,
    userID: string,
    expectedRoles?: string[]
  ) {
    const member = await instanceMemberQueries.getIAMMemberByIAMIDAndUserID(
      instanceID,
      userID
    );

    expect(member).not.toBeNull();
    if (expectedRoles) {
      expect(member!.roles).toEqual(expectedRoles);
    }
    
    console.log(`✓ Member verified via query layer: ${userID} with roles ${member!.roles.join(', ')}`);
    return member;
  }

  /**
   * Helper: Verify member does NOT exist via Query Layer
   */
  async function assertMemberNotInQuery(instanceID: string, userID: string) {
    const member = await instanceMemberQueries.getIAMMemberByIAMIDAndUserID(
      instanceID,
      userID
    );

    expect(member).toBeNull();
    console.log(`✓ Verified member removed via query layer: ${userID}`);
  }

  // ============================================================================
  // Instance Domain Commands
  // ============================================================================

  describe('addInstanceDomain', () => {
    describe('Success Cases', () => {
      it('should add domain to instance and update projection', async () => {
        const { instanceID } = await getTestInstance();
        const domain = `test-${Date.now()}.example.com`;

        console.log('\n--- Adding domain to instance ---');
        const result = await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain }
        );

        expect(result).toBeDefined();
        expect(result.sequence).toBeGreaterThan(0);

        // Verify event was published
        const event = await ctx.assertEventPublished('instance.domain.added');
        expect(event.payload).toHaveProperty('domain', domain);
        expect(event.payload).toHaveProperty('isGenerated', false);

        // Process projections
        await processProjections();

        // Verify via query layer (complete stack test)
        await assertDomainInQuery(instanceID, domain);
      });

      it('should add multiple domains to same instance', async () => {
        const { instanceID } = await getTestInstance();
        const domain1 = `test1-${Date.now()}.example.com`;
        const domain2 = `test2-${Date.now()}.example.com`;

        // Add first domain
        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain: domain1 }
        );

        // Add second domain
        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain: domain2 }
        );

        // Process projections
        await processProjections();

        // Verify both domains exist
        await assertDomainInQuery(instanceID, domain1);
        await assertDomainInQuery(instanceID, domain2);
      });

      it('should add generated domain', async () => {
        const { instanceID } = await getTestInstance();
        const domain = `generated-${Date.now()}.zitadel.cloud`;

        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain, isGenerated: true }
        );

        // Verify event
        const event = await ctx.assertEventPublished('instance.domain.added');
        expect(event.payload).toHaveProperty('isGenerated', true);

        // Process and verify
        await processProjections();
        const foundDomain = await assertDomainInQuery(instanceID, domain);
        expect(foundDomain.isGenerated).toBe(true);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty domain', async () => {
        const { instanceID } = await getTestInstance();

        await expect(
          ctx.commands.addInstanceDomain(
            ctx.createContext(),
            instanceID,
            { domain: '' }
          )
        ).rejects.toThrow('domain is required');
      });

      it('should fail with invalid instance', async () => {
        await expect(
          ctx.commands.addInstanceDomain(
            ctx.createContext(),
            'non-existent-instance',
            { domain: 'test.example.com' }
          )
        ).rejects.toThrow('instance not found');
      });

      it('should fail adding duplicate domain', async () => {
        const { instanceID } = await getTestInstance();
        const domain = `duplicate-${Date.now()}.example.com`;

        // Add domain first time
        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain }
        );

        // Try to add same domain again
        await expect(
          ctx.commands.addInstanceDomain(
            ctx.createContext(),
            instanceID,
            { domain }
          )
        ).rejects.toThrow('domain already exists');
      });
    });
  });

  describe('setDefaultInstanceDomain', () => {
    describe('Success Cases', () => {
      it('should set domain as default', async () => {
        const { instanceID } = await getTestInstance();
        const domain1 = `domain1-${Date.now()}.example.com`;
        const domain2 = `domain2-${Date.now()}.example.com`;

        // Add two domains (first one becomes default automatically)
        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain: domain1 }
        );
        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain: domain2 }
        );

        // Set domain2 as default (domain1 is currently default)
        console.log('\n--- Setting default domain ---');
        const result = await ctx.commands.setDefaultInstanceDomain(
          ctx.createContext(),
          instanceID,
          domain2
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('instance.domain.default.set');
        expect(event.payload).toHaveProperty('domain', domain2);

        // Process projections
        await processProjections();

        // Verify via query layer
        const foundDomain = await assertDomainInQuery(instanceID, domain2);
        expect(foundDomain.isPrimary).toBe(true);
      });
    });

    describe('Error Cases', () => {
      it('should fail with non-existent domain', async () => {
        const { instanceID } = await getTestInstance();

        await expect(
          ctx.commands.setDefaultInstanceDomain(
            ctx.createContext(),
            instanceID,
            'non-existent.example.com'
          )
        ).rejects.toThrow('domain not found');
      });

      it('should fail setting already default domain', async () => {
        const { instanceID } = await getTestInstance();
        const domain = `default-${Date.now()}.example.com`;

        // Add domain (automatically becomes default since it's the first)
        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain }
        );

        // Try to set as default again (it's already default)
        await expect(
          ctx.commands.setDefaultInstanceDomain(
            ctx.createContext(),
            instanceID,
            domain
          )
        ).rejects.toThrow('domain already default');
      });
    });
  });

  describe('removeInstanceDomain', () => {
    describe('Success Cases', () => {
      it('should remove non-default domain', async () => {
        const { instanceID } = await getTestInstance();
        const domain1 = `first-${Date.now()}.example.com`;
        const domain2 = `removable-${Date.now()}.example.com`;

        // Add two domains (first one becomes default)
        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain: domain1 }
        );
        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain: domain2 }
        );

        // Process to verify they exist
        await processProjections();
        await assertDomainInQuery(instanceID, domain1);
        await assertDomainInQuery(instanceID, domain2);

        // Remove non-default domain (domain2)
        console.log('\n--- Removing domain ---');
        const result = await ctx.commands.removeInstanceDomain(
          ctx.createContext(),
          instanceID,
          domain2
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('instance.domain.removed');
        expect(event.payload).toHaveProperty('domain', domain2);

        // Process projections
        await processProjections();

        // Verify domain removed via query layer
        await assertDomainNotInQuery(instanceID, domain2);
        // domain1 should still exist
        await assertDomainInQuery(instanceID, domain1);
      });
    });

    describe('Error Cases', () => {
      it('should fail removing non-existent domain', async () => {
        const { instanceID } = await getTestInstance();

        await expect(
          ctx.commands.removeInstanceDomain(
            ctx.createContext(),
            instanceID,
            'non-existent.example.com'
          )
        ).rejects.toThrow('domain not found');
      });

      it('should fail removing default domain', async () => {
        const { instanceID } = await getTestInstance();
        const domain = `default-${Date.now()}.example.com`;

        // Add domain (automatically becomes default since it's the first)
        await ctx.commands.addInstanceDomain(
          ctx.createContext(),
          instanceID,
          { domain }
        );

        // Try to remove default domain
        await expect(
          ctx.commands.removeInstanceDomain(
            ctx.createContext(),
            instanceID,
            domain
          )
        ).rejects.toThrow('cannot remove default domain');
      });
    });
  });

  // ============================================================================
  // Instance Features Commands
  // ============================================================================

  describe('setInstanceFeatures', () => {
    describe('Success Cases', () => {
      it('should set instance features', async () => {
        const { instanceID } = await getTestInstance();
        const features = {
          loginDefaultOrg: true,
          userSchema: true,
          tokenExchange: false,
          actions: true
        };

        console.log('\n--- Setting instance features ---');
        const result = await ctx.commands.setInstanceFeatures(
          ctx.createContext(),
          instanceID,
          features
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('instance.features.set');
        expect(event.payload).toMatchObject(features);

        // Process projections
        await processProjections();

        // Verify features via query layer
        const retrievedFeatures = await instanceQueries.getInstanceFeatures(instanceID);
        expect(retrievedFeatures).toMatchObject(features);
        console.log('✓ Features verified via query layer');
      });

      it('should update existing features', async () => {
        const { instanceID } = await getTestInstance();

        // Set initial features
        await ctx.commands.setInstanceFeatures(
          ctx.createContext(),
          instanceID,
          { loginDefaultOrg: true, actions: false }
        );

        // Update features
        await ctx.commands.setInstanceFeatures(
          ctx.createContext(),
          instanceID,
          { loginDefaultOrg: false, userSchema: true }
        );

        await processProjections();

        // Verify updated features
        const features = await instanceQueries.getInstanceFeatures(instanceID);
        expect(features).toMatchObject({
          loginDefaultOrg: false,
          userSchema: true
        });
      });
    });

    describe('Error Cases', () => {
      it('should fail with invalid instance', async () => {
        await expect(
          ctx.commands.setInstanceFeatures(
            ctx.createContext(),
            'non-existent-instance',
            { actions: true }
          )
        ).rejects.toThrow('instance not found');
      });
    });
  });

  describe('resetInstanceFeatures', () => {
    describe('Success Cases', () => {
      it('should reset instance features to defaults', async () => {
        const { instanceID } = await getTestInstance();

        // Set some features first
        await ctx.commands.setInstanceFeatures(
          ctx.createContext(),
          instanceID,
          { loginDefaultOrg: true, actions: true }
        );

        // Reset features
        console.log('\n--- Resetting instance features ---');
        const result = await ctx.commands.resetInstanceFeatures(
          ctx.createContext(),
          instanceID
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('instance.features.reset');
        expect(event.payload).toEqual({});

        console.log('✓ Features reset');
      });
    });

    describe('Error Cases', () => {
      it('should fail with invalid instance', async () => {
        await expect(
          ctx.commands.resetInstanceFeatures(
            ctx.createContext(),
            'non-existent-instance'
          )
        ).rejects.toThrow('instance not found');
      });
    });
  });

  // ============================================================================
  // Instance Member Commands
  // ============================================================================

  describe('addInstanceMember', () => {
    describe('Success Cases', () => {
      it('should add user as instance member (IAM admin)', async () => {
        const { instanceID } = await getTestInstance();
        const user = await createTestUser();

        console.log('\n--- Adding instance member ---');
        const result = await ctx.commands.addInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID,
          ['IAM_OWNER']
        );

        expect(result).toBeDefined();
        expect(result.sequence).toBeGreaterThan(0);

        // Verify event
        const event = await ctx.assertEventPublished('instance.member.added');
        expect(event.payload).toHaveProperty('userID', user.userID);
        expect(event.payload).toHaveProperty('roles');
        expect(event.payload!.roles).toContain('IAM_OWNER');

        // Process projections
        await processProjections();

        // Verify via query layer
        await assertMemberInQuery(instanceID, user.userID, ['IAM_OWNER']);
      });

      it('should add member with multiple roles', async () => {
        const { instanceID } = await getTestInstance();
        const user = await createTestUser();

        await ctx.commands.addInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID,
          ['IAM_OWNER', 'IAM_ADMIN']
        );

        await processProjections();

        const member = await assertMemberInQuery(
          instanceID,
          user.userID,
          ['IAM_OWNER', 'IAM_ADMIN']
        );
        expect(member!.roles).toHaveLength(2);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty userID', async () => {
        const { instanceID } = await getTestInstance();

        await expect(
          ctx.commands.addInstanceMember(
            ctx.createContext(),
            instanceID,
            '',
            ['IAM_OWNER']
          )
        ).rejects.toThrow('userID is required');
      });

      it('should fail with empty roles array', async () => {
        const { instanceID } = await getTestInstance();
        const user = await createTestUser();

        await expect(
          ctx.commands.addInstanceMember(
            ctx.createContext(),
            instanceID,
            user.userID,
            []
          )
        ).rejects.toThrow('at least one role is required');
      });

      it('should fail with invalid instance', async () => {
        const user = await createTestUser();

        await expect(
          ctx.commands.addInstanceMember(
            ctx.createContext(),
            'non-existent-instance',
            user.userID,
            ['IAM_OWNER']
          )
        ).rejects.toThrow('instance not found');
      });

      it('should fail adding duplicate member', async () => {
        const { instanceID } = await getTestInstance();
        const user = await createTestUser();

        // Add member first time
        await ctx.commands.addInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID,
          ['IAM_OWNER']
        );

        // Try to add same member again
        await expect(
          ctx.commands.addInstanceMember(
            ctx.createContext(),
            instanceID,
            user.userID,
            ['IAM_ADMIN']
          )
        ).rejects.toThrow('member already exists');
      });
    });
  });

  describe('changeInstanceMember', () => {
    describe('Success Cases', () => {
      it('should change member roles', async () => {
        const { instanceID } = await getTestInstance();
        const user = await createTestUser();

        // Add member with initial role
        await ctx.commands.addInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID,
          ['IAM_ADMIN']
        );

        await processProjections();
        await assertMemberInQuery(instanceID, user.userID, ['IAM_ADMIN']);

        // Change roles
        console.log('\n--- Changing member roles ---');
        const result = await ctx.commands.changeInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID,
          ['IAM_OWNER', 'IAM_ADMIN']
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('instance.member.changed');
        expect(event.payload).toHaveProperty('userID', user.userID);
        expect(event.payload!.roles).toContain('IAM_OWNER');
        expect(event.payload!.roles).toContain('IAM_ADMIN');

        // Process and verify
        await processProjections();
        await assertMemberInQuery(instanceID, user.userID, ['IAM_OWNER', 'IAM_ADMIN']);
      });

      it('should handle idempotent role updates', async () => {
        const { instanceID } = await getTestInstance();
        const user = await createTestUser();

        // Add member
        await ctx.commands.addInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID,
          ['IAM_OWNER']
        );

        // Change to same roles (idempotent)
        await ctx.commands.changeInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID,
          ['IAM_OWNER']
        );

        await processProjections();

        // Should still have the same role
        await assertMemberInQuery(instanceID, user.userID, ['IAM_OWNER']);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty roles', async () => {
        const { instanceID } = await getTestInstance();
        const user = await createTestUser();

        // Add member first
        await ctx.commands.addInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID,
          ['IAM_ADMIN']
        );

        // Try to change to empty roles
        await expect(
          ctx.commands.changeInstanceMember(
            ctx.createContext(),
            instanceID,
            user.userID,
            []
          )
        ).rejects.toThrow('at least one role is required');
      });

      it('should fail with non-existent member', async () => {
        const { instanceID } = await getTestInstance();

        await expect(
          ctx.commands.changeInstanceMember(
            ctx.createContext(),
            instanceID,
            'non-existent-user',
            ['IAM_OWNER']
          )
        ).rejects.toThrow('member not found');
      });
    });
  });

  describe('removeInstanceMember', () => {
    describe('Success Cases', () => {
      it('should remove instance member', async () => {
        const { instanceID } = await getTestInstance();
        const user = await createTestUser();

        // Add member
        await ctx.commands.addInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID,
          ['IAM_ADMIN']
        );

        await processProjections();
        await assertMemberInQuery(instanceID, user.userID);

        // Remove member
        console.log('\n--- Removing instance member ---');
        const result = await ctx.commands.removeInstanceMember(
          ctx.createContext(),
          instanceID,
          user.userID
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('instance.member.removed');
        expect(event.payload).toHaveProperty('userID', user.userID);

        // Process and verify removal
        await processProjections();
        await assertMemberNotInQuery(instanceID, user.userID);
      });
    });

    describe('Error Cases', () => {
      it('should fail removing non-existent member', async () => {
        const { instanceID } = await getTestInstance();

        await expect(
          ctx.commands.removeInstanceMember(
            ctx.createContext(),
            instanceID,
            'non-existent-user'
          )
        ).rejects.toThrow('member not found');
      });

      it('should fail with invalid instance', async () => {
        const user = await createTestUser();

        await expect(
          ctx.commands.removeInstanceMember(
            ctx.createContext(),
            'non-existent-instance',
            user.userID
          )
        ).rejects.toThrow('instance not found');
      });
    });
  });

  describe('Complete Lifecycles', () => {
    it('should complete domain lifecycle: add → setDefault → remove', async () => {
      const { instanceID } = await getTestInstance();
      const domain1 = `lifecycle1-${Date.now()}.example.com`;
      const domain2 = `lifecycle2-${Date.now()}.example.com`;

      console.log('\n--- Testing complete domain lifecycle ---');

      // Add two domains (domain1 becomes default automatically)
      await ctx.commands.addInstanceDomain(ctx.createContext(), instanceID, { domain: domain1 });
      await ctx.commands.addInstanceDomain(ctx.createContext(), instanceID, { domain: domain2 });

      // Change default to domain2
      await ctx.commands.setDefaultInstanceDomain(ctx.createContext(), instanceID, domain2);

      await processProjections();
      const d2 = await assertDomainInQuery(instanceID, domain2);
      expect(d2.isPrimary).toBe(true);

      // Remove non-default domain1
      await ctx.commands.removeInstanceDomain(ctx.createContext(), instanceID, domain1);

      await processProjections();
      await assertDomainNotInQuery(instanceID, domain1);
      // domain2 should still exist and be default
      await assertDomainInQuery(instanceID, domain2);

      console.log('✓ Domain lifecycle complete');
    });

    it('should complete member lifecycle: add → change → remove', async () => {
      const { instanceID } = await getTestInstance();
      const user = await createTestUser();

      console.log('\n--- Testing complete member lifecycle ---');

      // Add member
      await ctx.commands.addInstanceMember(
        ctx.createContext(),
        instanceID,
        user.userID,
        ['IAM_ADMIN']
      );

      await processProjections();
      await assertMemberInQuery(instanceID, user.userID, ['IAM_ADMIN']);

      // Change roles
      await ctx.commands.changeInstanceMember(
        ctx.createContext(),
        instanceID,
        user.userID,
        ['IAM_OWNER', 'IAM_ADMIN']
      );

      await processProjections();
      await assertMemberInQuery(instanceID, user.userID, ['IAM_OWNER', 'IAM_ADMIN']);

      // Remove member
      await ctx.commands.removeInstanceMember(
        ctx.createContext(),
        instanceID,
        user.userID
      );

      await processProjections();
      await assertMemberNotInQuery(instanceID, user.userID);

      console.log('✓ Member lifecycle complete');
    });

    it('should complete features lifecycle: set → update → reset', async () => {
      const { instanceID } = await getTestInstance();

      console.log('\n--- Testing features lifecycle ---');

      // Set initial features
      await ctx.commands.setInstanceFeatures(
        ctx.createContext(),
        instanceID,
        { loginDefaultOrg: true, actions: true }
      );

      await processProjections();
      let features = await instanceQueries.getInstanceFeatures(instanceID);
      expect(features).toMatchObject({ loginDefaultOrg: true, actions: true });

      // Update features
      await ctx.commands.setInstanceFeatures(
        ctx.createContext(),
        instanceID,
        { userSchema: true, tokenExchange: true }
      );

      await processProjections();
      features = await instanceQueries.getInstanceFeatures(instanceID);
      expect(features).toMatchObject({ userSchema: true, tokenExchange: true });

      // Reset features
      await ctx.commands.resetInstanceFeatures(ctx.createContext(), instanceID);

      console.log('✓ Features lifecycle complete');
    });
  });
});
