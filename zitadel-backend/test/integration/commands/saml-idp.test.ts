/**
 * SAML IDP Commands Integration Tests
 * 
 * Tests command→event→projection→query flow for SAML IDP management
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

describe('SAML IDP Commands - Complete Flow', () => {
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
      .withName(`SAML IDP Test Org ${Date.now()}`)
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
   * Helper: Verify SAML IDP exists via Query Layer
   */
  async function assertSAMLIDPInQuery(orgID: string, idpID: string, expectedName?: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');

    expect(idp).not.toBeNull();
    expect(idp!.resourceOwner).toBe(orgID);
    
    if (expectedName) {
      expect(idp!.name).toBe(expectedName);
    }
    
    console.log(`✓ SAML IDP verified via query layer: ${idp!.name}`);
    return idp;
  }

  /**
   * Helper: Verify SAML IDP is removed (state = REMOVED)
   */
  async function assertSAMLIDPNotInQuery(idpID: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');
    // IDP should either be null or have state = 3 (REMOVED)
    if (idp) {
      expect(idp.state).toBe(IDPState.REMOVED); // state = 3
    }
    console.log(`✓ Verified SAML IDP removed: ${idpID}`);
  }

  /**
   * Helper: Create sample SAML metadata XML
   */
  function createSAMLMetadata(entityID: string = 'https://idp.example.com'): Buffer {
    const metadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityID}">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                        Location="https://idp.example.com/sso"/>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                        Location="https://idp.example.com/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;
    return Buffer.from(metadata, 'utf-8');
  }

  describe('addSAMLIDPToOrg', () => {
    describe('Success Cases', () => {
      it('should add SAML IDP with metadata XML', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();
        const metadata = createSAMLMetadata('https://saml-idp.example.com');

        console.log('\n--- Adding SAML IDP with Metadata ---');
        const result = await ctx.commands.addSAMLIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Enterprise SAML',
            metadata,
            binding: 'HTTP-POST',
            withSignedRequest: false,
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.idp.saml.added');
        expect(event.payload).toHaveProperty('name', 'Enterprise SAML');
        expect(event.payload).toHaveProperty('type', IDPType.SAML);
        expect(event.payload?.config).toHaveProperty('binding', 'HTTP-POST');
        expect(event.payload?.config).toHaveProperty('withSignedRequest', false);
        expect(event.payload?.config?.metadata).toBeDefined();

        // Process and verify via query layer
        await processProjection();
        const idp = await assertSAMLIDPInQuery(org.orgID, idpID, 'Enterprise SAML');
        expect(idp?.type).toBe(IDPType.SAML);
        expect(idp?.state).toBe(IDPState.ACTIVE);
      });

      it('should add SAML IDP with metadataURL', async () => {
        const org = await createTestOrg();

        console.log('\n--- Adding SAML IDP with Metadata URL ---');
        await ctx.commands.addSAMLIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'SAML with URL',
            metadataURL: 'https://idp.example.com/metadata',
            binding: 'HTTP-Redirect',
          }
        );

        const event = await ctx.assertEventPublished('org.idp.saml.added');
        expect(event.payload?.config).toHaveProperty('metadataURL', 'https://idp.example.com/metadata');
        expect(event.payload?.config).toHaveProperty('binding', 'HTTP-Redirect');

        console.log('✓ SAML IDP with metadata URL added');
      });

      it('should add SAML IDP with signed requests enabled', async () => {
        const org = await createTestOrg();
        const metadata = createSAMLMetadata();

        await ctx.commands.addSAMLIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'SAML with Signing',
            metadata,
            binding: 'HTTP-POST',
            withSignedRequest: true,
          }
        );

        const event = await ctx.assertEventPublished('org.idp.saml.added');
        expect(event.payload?.config).toHaveProperty('withSignedRequest', true);

        console.log('✓ SAML IDP with signed requests added');
      });

      it('should add SAML IDP with default binding', async () => {
        const org = await createTestOrg();
        const metadata = createSAMLMetadata();

        await ctx.commands.addSAMLIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'SAML Default Binding',
            metadata,
          }
        );

        const event = await ctx.assertEventPublished('org.idp.saml.added');
        // Default binding should be HTTP-POST
        expect(event.payload?.config).toHaveProperty('binding', 'HTTP-POST');
        expect(event.payload?.config).toHaveProperty('withSignedRequest', false);

        console.log('✓ SAML IDP with defaults added');
      });

      it('should support multiple SAML IDPs per organization', async () => {
        const org = await createTestOrg();
        const metadata1 = createSAMLMetadata('https://saml1.example.com');
        const metadata2 = createSAMLMetadata('https://saml2.example.com');

        // Add first SAML IDP
        await ctx.commands.addSAMLIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'SAML IDP 1',
            metadata: metadata1,
          }
        );

        // Add second SAML IDP
        await ctx.commands.addSAMLIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'SAML IDP 2',
            metadata: metadata2,
          }
        );

        await processProjection();

        // Verify both exist
        const idps = await idpQueries.searchIDPs({
          instanceID: 'test-instance',
          resourceOwner: org.orgID,
          type: IDPType.SAML,
        });

        expect(idps.idps.length).toBe(2);
        console.log('✓ Multiple SAML IDPs supported');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty name', async () => {
        const org = await createTestOrg();
        const metadata = createSAMLMetadata();

        await expect(
          ctx.commands.addSAMLIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: '',
              metadata,
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty name');
      });

      it('should fail without metadata or metadataURL', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addSAMLIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Invalid SAML',
            }
          )
        ).rejects.toThrow(/either metadata or metadataURL is required/);

        console.log('✓ Rejected missing metadata');
      });

      it('should fail with invalid metadataURL', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addSAMLIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Invalid URL SAML',
              metadataURL: 'not-a-url',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected invalid metadataURL');
      });

      it('should fail with invalid binding', async () => {
        const org = await createTestOrg();
        const metadata = createSAMLMetadata();

        await expect(
          ctx.commands.addSAMLIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Invalid Binding SAML',
              metadata,
              binding: 'INVALID-BINDING',
            }
          )
        ).rejects.toThrow(/binding must be HTTP-POST or HTTP-Redirect/);

        console.log('✓ Rejected invalid binding');
      });

      it('should fail with invalid metadata XML', async () => {
        const org = await createTestOrg();
        const invalidMetadata = Buffer.from('not valid xml', 'utf-8');

        await expect(
          ctx.commands.addSAMLIDPToOrg(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Invalid Metadata SAML',
              metadata: invalidMetadata,
            }
          )
        ).rejects.toThrow(/invalid SAML metadata XML/);

        console.log('✓ Rejected invalid metadata XML');
      });
    });
  });

  describe('changeSAMLIDP', () => {
    describe('Success Cases', () => {
      it('should update SAML IDP configuration', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();
        const originalMetadata = createSAMLMetadata('https://original.example.com');

        // Add SAML IDP
        await ctx.commands.addSAMLIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Original SAML IDP',
            metadata: originalMetadata,
            binding: 'HTTP-POST',
          }
        );

        // Get event count before update
        const eventsBefore = await ctx.getEvents('org', org.orgID);
        const eventCountBefore = eventsBefore.length;

        console.log('\n--- Updating SAML IDP ---');
        const newMetadata = createSAMLMetadata('https://updated.example.com');
        
        await ctx.commands.changeSAMLIDP(
          ctx.createContext(),
          org.orgID,
          idpID,
          {
            name: 'Updated SAML IDP',
            metadata: newMetadata,
            binding: 'HTTP-Redirect',
            withSignedRequest: true,
          }
        );

        // Verify change event was published
        const eventsAfter = await ctx.getEvents('org', org.orgID);
        expect(eventsAfter.length).toBe(eventCountBefore + 1);

        const changeEvent = eventsAfter.find(e => e.eventType === 'org.idp.saml.changed');
        expect(changeEvent).toBeDefined();
        expect(changeEvent!.payload).toHaveProperty('name', 'Updated SAML IDP');
        expect(changeEvent!.payload?.config).toHaveProperty('binding', 'HTTP-Redirect');
        expect(changeEvent!.payload?.config).toHaveProperty('withSignedRequest', true);

        console.log('✓ SAML IDP updated successfully');
      });

      it('should be idempotent - no event for same values', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();
        const metadata = createSAMLMetadata();

        await ctx.commands.addSAMLIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Idempotent SAML IDP',
            metadata,
            binding: 'HTTP-POST',
            withSignedRequest: false,
          }
        );

        // Get event count before idempotent change
        const eventsBefore = await ctx.getEvents('org', org.orgID);
        const eventCountBefore = eventsBefore.length;

        // Update with same values
        await ctx.commands.changeSAMLIDP(
          ctx.createContext(),
          org.orgID,
          idpID,
          {
            name: 'Idempotent SAML IDP',
            binding: 'HTTP-POST',
            withSignedRequest: false,
          }
        );

        // Verify no new event
        const eventsAfter = await ctx.getEvents('org', org.orgID);
        expect(eventsAfter.length).toBe(eventCountBefore);

        const changeEvent = eventsAfter.find(e => e.eventType === 'org.idp.saml.changed');
        expect(changeEvent).toBeUndefined();

        console.log('✓ Idempotent - no event for same values');
      });
    });

    describe('Error Cases', () => {
      it('should fail on non-existent SAML IDP', async () => {
        const org = await createTestOrg();
        const fakeIDPID = await ctx.commands.nextID();

        await expect(
          ctx.commands.changeSAMLIDP(
            ctx.createContext(),
            org.orgID,
            fakeIDPID,
            {
              name: 'Updated Name',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected change to non-existent SAML IDP');
      });

      it('should fail with invalid metadataURL', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();
        const metadata = createSAMLMetadata();

        await ctx.commands.addSAMLIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Test SAML IDP',
            metadata,
          }
        );

        await expect(
          ctx.commands.changeSAMLIDP(
            ctx.createContext(),
            org.orgID,
            idpID,
            {
              metadataURL: 'invalid-url',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected invalid metadataURL');
      });
    });
  });

  describe('Complete Lifecycle', () => {
    it('should complete add → change → remove lifecycle', async () => {
      const org = await createTestOrg();
      const idpID = await ctx.commands.nextID();
      const metadata = createSAMLMetadata();

      console.log('\n--- Testing Complete Lifecycle ---');

      // 1. Add SAML IDP
      console.log('Step 1: Add SAML IDP');
      await ctx.commands.addSAMLIDPToOrg(
        ctx.createContext(),
        org.orgID,
        {
          idpID,
          name: 'Lifecycle SAML IDP',
          metadata,
          binding: 'HTTP-POST',
        }
      );

      await processProjection();
      await assertSAMLIDPInQuery(org.orgID, idpID, 'Lifecycle SAML IDP');

      // 2. Change SAML IDP
      console.log('Step 2: Change SAML IDP');
      const newMetadata = createSAMLMetadata('https://updated.example.com');
      
      await ctx.commands.changeSAMLIDP(
        ctx.createContext(),
        org.orgID,
        idpID,
        {
          name: 'Updated Lifecycle SAML IDP',
          metadata: newMetadata,
          binding: 'HTTP-Redirect',
        }
      );

      await processProjection();
      await assertSAMLIDPInQuery(org.orgID, idpID, 'Updated Lifecycle SAML IDP');

      // 3. Remove SAML IDP (reuse existing removeIDPFromOrg)
      console.log('Step 3: Remove SAML IDP');
      await ctx.commands.removeIDPFromOrg(
        ctx.createContext(),
        org.orgID,
        idpID
      );

      await processProjection();
      await assertSAMLIDPNotInQuery(idpID);

      console.log('✓ Complete lifecycle tested successfully');
    });
  });
});
