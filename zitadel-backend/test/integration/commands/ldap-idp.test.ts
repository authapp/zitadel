/**
 * LDAP IDP Commands Integration Tests
 * 
 * Tests command→event→projection→query flow for LDAP IDP management
 * Based on established pattern from jwt-idp.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { IDPProjection } from '../../../src/lib/query/projections/idp-projection';
import { IDPQueries } from '../../../src/lib/query/idp/idp-queries';
import { IDPType, IDPState } from '../../../src/lib/query/idp/idp-types';

describe('LDAP IDP Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let idpProjection: IDPProjection;
  let idpQueries: IDPQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    idpProjection = new IDPProjection(ctx.eventstore, pool);
    await idpProjection.init();
    
    // Initialize query layer
    idpQueries = new IDPQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clear all events
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE projections.idps CASCADE');
  });

  /**
   * Helper: Create test organization via commands
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`LDAP IDP Test Org ${Date.now()}`)
      .build();

    const org = await ctx.commands.addOrg(ctx.createContext(), orgData);
    console.log(`✓ Created org: ${org.orgID}`);
    
    return org;
  }

  /**
   * Helper: Process projection
   */
  async function processProjection() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projection...`);
    
    for (const event of events) {
      try {
        await idpProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType}`);
      } catch (err) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Verify LDAP IDP exists via Query Layer
   */
  async function assertLDAPIDPInQuery(orgID: string, idpID: string, expectedName?: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');

    expect(idp).not.toBeNull();
    expect(idp!.resourceOwner).toBe(orgID);
    
    if (expectedName) {
      expect(idp!.name).toBe(expectedName);
    }
    
    console.log(`✓ LDAP IDP verified via query layer: ${idp!.name}`);
    return idp;
  }

  /**
   * Helper: Verify LDAP IDP is removed (state = REMOVED)
   */
  async function assertLDAPIDPNotInQuery(idpID: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');
    // IDP should either be null or have state = 3 (REMOVED)
    if (idp) {
      expect(idp.state).toBe(IDPState.REMOVED); // state = 3
    }
    console.log(`✓ Verified LDAP IDP removed: ${idpID}`);
  }

  describe('addLDAPIDPToOrg', () => {
    describe('Success Cases', () => {
      it('should add LDAP IDP with basic configuration', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        console.log('\n--- Adding LDAP IDP ---');
        const result = await ctx.commands.addLDAPIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Corporate Active Directory',
            host: 'ldap.company.com',
            port: 389,
            tls: false,
            baseDN: 'dc=company,dc=com',
            userObjectClass: 'person',
            userUniqueAttribute: 'uid',
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.idp.ldap.added');
        expect(event.payload).toHaveProperty('name', 'Corporate Active Directory');
        expect(event.payload).toHaveProperty('type', IDPType.LDAP);
        expect(event.payload?.config).toHaveProperty('host', 'ldap.company.com');
        expect(event.payload?.config).toHaveProperty('port', 389);
        expect(event.payload?.config).toHaveProperty('baseDN', 'dc=company,dc=com');

        // Process and verify via query layer
        await processProjection();
        const idp = await assertLDAPIDPInQuery(org.orgID, idpID, 'Corporate Active Directory');
        expect(idp?.type).toBe(IDPType.LDAP);
        expect(idp?.state).toBe(IDPState.ACTIVE);
      });

      it('should add LDAP IDP with TLS enabled', async () => {
        const org = await createTestOrg();

        await ctx.commands.addLDAPIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Secure LDAP',
            host: 'ldaps.company.com',
            port: 636,
            tls: true,
            baseDN: 'ou=users,dc=company,dc=com',
            userObjectClass: 'inetOrgPerson',
            userUniqueAttribute: 'mail',
          }
        );

        const event = await ctx.assertEventPublished('org.idp.ldap.added');
        expect(event.payload?.config).toHaveProperty('tls', true);
        expect(event.payload?.config).toHaveProperty('port', 636);

        console.log('✓ LDAP IDP with TLS added');
      });

      it('should add LDAP IDP with admin credentials', async () => {
        const org = await createTestOrg();

        await ctx.commands.addLDAPIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'LDAP with Auth',
            host: 'ldap.company.com',
            baseDN: 'dc=company,dc=com',
            userObjectClass: 'user',
            userUniqueAttribute: 'sAMAccountName',
            admin: 'cn=admin,dc=company,dc=com',
            password: 'admin-password',
          }
        );

        const event = await ctx.assertEventPublished('org.idp.ldap.added');
        expect(event.payload?.config).toHaveProperty('admin', 'cn=admin,dc=company,dc=com');

        console.log('✓ LDAP IDP with admin credentials added');
      });

      it('should add LDAP IDP with attribute mapping', async () => {
        const org = await createTestOrg();

        await ctx.commands.addLDAPIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'LDAP with Attributes',
            host: 'ldap.company.com',
            baseDN: 'dc=company,dc=com',
            userObjectClass: 'person',
            userUniqueAttribute: 'uid',
            attributes: {
              idAttribute: 'uid',
              firstNameAttribute: 'givenName',
              lastNameAttribute: 'sn',
              displayNameAttribute: 'displayName',
              emailAttribute: 'mail',
              phoneAttribute: 'telephoneNumber',
            },
          }
        );

        const event = await ctx.assertEventPublished('org.idp.ldap.added');
        expect(event.payload?.config?.attributes).toHaveProperty('emailAttribute', 'mail');
        expect(event.payload?.config?.attributes).toHaveProperty('firstNameAttribute', 'givenName');

        console.log('✓ LDAP IDP with attribute mapping added');
      });

      it('should support multiple LDAP IDPs per organization', async () => {
        const org = await createTestOrg();

        // Add first LDAP IDP
        await ctx.commands.addLDAPIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Primary LDAP',
            host: 'ldap1.company.com',
            baseDN: 'dc=primary,dc=com',
            userObjectClass: 'person',
            userUniqueAttribute: 'uid',
          }
        );

        // Add second LDAP IDP
        await ctx.commands.addLDAPIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Secondary LDAP',
            host: 'ldap2.company.com',
            baseDN: 'dc=secondary,dc=com',
            userObjectClass: 'person',
            userUniqueAttribute: 'uid',
          }
        );

        await processProjection();

        // Verify both exist
        const idps = await idpQueries.searchIDPs({
          instanceID: 'test-instance',
          resourceOwner: org.orgID,
          type: IDPType.LDAP,
        });

        expect(idps.idps.length).toBe(2);
        console.log('✓ Multiple LDAP IDPs supported');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty name', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addLDAPIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: '',
              host: 'ldap.company.com',
              baseDN: 'dc=company,dc=com',
              userObjectClass: 'person',
              userUniqueAttribute: 'uid',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty name');
      });

      it('should fail with empty host', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addLDAPIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'LDAP IDP',
              host: '',
              baseDN: 'dc=company,dc=com',
              userObjectClass: 'person',
              userUniqueAttribute: 'uid',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty host');
      });

      it('should fail with invalid port', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addLDAPIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'LDAP IDP',
              host: 'ldap.company.com',
              port: 70000,
              baseDN: 'dc=company,dc=com',
              userObjectClass: 'person',
              userUniqueAttribute: 'uid',
            }
          )
        ).rejects.toThrow(/port must be between 1 and 65535/);

        console.log('✓ Rejected invalid port');
      });

      it('should fail with invalid baseDN', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addLDAPIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'LDAP IDP',
              host: 'ldap.company.com',
              baseDN: 'invalid-dn',
              userObjectClass: 'person',
              userUniqueAttribute: 'uid',
            }
          )
        ).rejects.toThrow(/baseDN must be a valid distinguished name/);

        console.log('✓ Rejected invalid baseDN');
      });
    });
  });

  describe('changeLDAPIDP', () => {
    describe('Success Cases', () => {
      it('should update LDAP IDP configuration', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        // Add LDAP IDP
        await ctx.commands.addLDAPIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Original LDAP',
            host: 'ldap1.company.com',
            port: 389,
            baseDN: 'dc=original,dc=com',
            userObjectClass: 'person',
            userUniqueAttribute: 'uid',
          }
        );

        // Get event count before update
        const eventsBefore = await ctx.getEvents('org', org.orgID);
        const eventCountBefore = eventsBefore.length;

        console.log('\n--- Updating LDAP IDP ---');
        await ctx.commands.changeLDAPIDP(
          ctx.createContext(),
          org.orgID,
          idpID,
          {
            name: 'Updated LDAP',
            host: 'ldap2.company.com',
            port: 636,
            tls: true,
          }
        );

        // Verify change event was published
        const eventsAfter = await ctx.getEvents('org', org.orgID);
        expect(eventsAfter.length).toBe(eventCountBefore + 1);

        const changeEvent = eventsAfter.find(e => e.eventType === 'org.idp.ldap.changed');
        expect(changeEvent).toBeDefined();
        expect(changeEvent!.payload).toHaveProperty('name', 'Updated LDAP');
        expect(changeEvent!.payload?.config).toHaveProperty('host', 'ldap2.company.com');
        expect(changeEvent!.payload?.config).toHaveProperty('port', 636);
        expect(changeEvent!.payload?.config).toHaveProperty('tls', true);

        console.log('✓ LDAP IDP updated successfully');
      });

      it('should be idempotent - no event for same values', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        await ctx.commands.addLDAPIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Idempotent LDAP',
            host: 'ldap.company.com',
            baseDN: 'dc=company,dc=com',
            userObjectClass: 'person',
            userUniqueAttribute: 'uid',
          }
        );

        // Get event count before idempotent change
        const eventsBefore = await ctx.getEvents('org', org.orgID);
        const eventCountBefore = eventsBefore.length;

        // Update with same values
        await ctx.commands.changeLDAPIDP(
          ctx.createContext(),
          org.orgID,
          idpID,
          {
            name: 'Idempotent LDAP',
            host: 'ldap.company.com',
          }
        );

        // Verify no new event
        const eventsAfter = await ctx.getEvents('org', org.orgID);
        expect(eventsAfter.length).toBe(eventCountBefore);

        console.log('✓ Idempotent - no event for same values');
      });
    });

    describe('Error Cases', () => {
      it('should fail on non-existent LDAP IDP', async () => {
        const org = await createTestOrg();
        const fakeIDPID = await ctx.commands.nextID();

        await expect(
          ctx.commands.changeLDAPIDP(
            ctx.createContext(),
            org.orgID,
            fakeIDPID,
            {
              name: 'Updated Name',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected change to non-existent LDAP IDP');
      });

      it('should fail with invalid port', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        await ctx.commands.addLDAPIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Test LDAP',
            host: 'ldap.company.com',
            baseDN: 'dc=company,dc=com',
            userObjectClass: 'person',
            userUniqueAttribute: 'uid',
          }
        );

        await expect(
          ctx.commands.changeLDAPIDP(
            ctx.createContext(),
            org.orgID,
            idpID,
            {
              port: -1,
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected invalid port');
      });
    });
  });

  describe('Complete Lifecycle', () => {
    it('should complete add → change → remove lifecycle', async () => {
      const org = await createTestOrg();
      const idpID = await ctx.commands.nextID();

      console.log('\n--- Testing Complete Lifecycle ---');

      // 1. Add LDAP IDP
      console.log('Step 1: Add LDAP IDP');
      await ctx.commands.addLDAPIDPToOrg(
        ctx.createContext(),
        org.orgID,
        {
          idpID,
          name: 'Lifecycle LDAP',
          host: 'ldap.company.com',
          port: 389,
          baseDN: 'dc=company,dc=com',
          userObjectClass: 'person',
          userUniqueAttribute: 'uid',
        }
      );

      await processProjection();
      await assertLDAPIDPInQuery(org.orgID, idpID, 'Lifecycle LDAP');

      // 2. Change LDAP IDP
      console.log('Step 2: Change LDAP IDP');
      await ctx.commands.changeLDAPIDP(
        ctx.createContext(),
        org.orgID,
        idpID,
        {
          name: 'Updated Lifecycle LDAP',
          port: 636,
          tls: true,
        }
      );

      await processProjection();
      await assertLDAPIDPInQuery(org.orgID, idpID, 'Updated Lifecycle LDAP');

      // 3. Remove LDAP IDP (reuse existing removeIDPFromOrg)
      console.log('Step 3: Remove LDAP IDP');
      await ctx.commands.removeIDPFromOrg(
        ctx.createContext(),
        org.orgID,
        idpID
      );

      await processProjection();
      await assertLDAPIDPNotInQuery(idpID);

      console.log('✓ Complete lifecycle tested successfully');
    });
  });
});
