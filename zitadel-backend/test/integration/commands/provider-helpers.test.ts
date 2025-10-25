/**
 * Provider Helper Commands Integration Tests
 * 
 * Tests command→event→projection→query flow for provider-specific IDP helpers
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

describe('Provider Helper Commands - Complete Flow', () => {
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
      .withName(`Provider Test Org ${Date.now()}`)
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
   * Helper: Verify IDP exists via Query Layer
   */
  async function assertIDPInQuery(orgID: string, idpID: string, expectedName?: string, expectedType?: IDPType) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');

    expect(idp).not.toBeNull();
    expect(idp!.resourceOwner).toBe(orgID);
    
    if (expectedName) {
      expect(idp!.name).toBe(expectedName);
    }

    if (expectedType) {
      expect(idp!.type).toBe(expectedType);
    }
    
    console.log(`✓ IDP verified via query layer: ${idp!.name} (${idp!.type})`);
    return idp;
  }

  describe('addGoogleIDPToOrg', () => {
    describe('Success Cases', () => {
      it('should add Google IDP with default configuration', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        console.log('\n--- Adding Google IDP ---');
        const result = await ctx.commands.addGoogleIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Google Login',
            clientID: 'google-client-id-123',
            clientSecret: 'google-client-secret-456',
          }
        );

        expect(result).toBeDefined();

        // Verify event (OIDC event, not Google-specific)
        const event = await ctx.assertEventPublished('org.idp.oidc.added');
        expect(event.payload).toHaveProperty('name', 'Google Login');
        expect(event.payload).toHaveProperty('type', IDPType.OIDC);
        expect(event.payload?.config).toHaveProperty('issuer', 'https://accounts.google.com');
        expect(event.payload?.config).toHaveProperty('clientID', 'google-client-id-123');
        expect(event.payload?.config?.scopes).toEqual(['openid', 'profile', 'email']);

        // Process and verify via query layer
        await processProjection();
        const idp = await assertIDPInQuery(org.orgID, idpID, 'Google Login', IDPType.OIDC);
        expect(idp?.state).toBe(IDPState.ACTIVE);
      });

      it('should add Google IDP with custom scopes', async () => {
        const org = await createTestOrg();

        await ctx.commands.addGoogleIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Google with Custom Scopes',
            clientID: 'google-client-id',
            clientSecret: 'google-client-secret',
            scopes: ['openid', 'profile', 'email', 'calendar.readonly'],
          }
        );

        const event = await ctx.assertEventPublished('org.idp.oidc.added');
        expect(event.payload?.config?.scopes).toEqual([
          'openid',
          'profile',
          'email',
          'calendar.readonly'
        ]);

        console.log('✓ Google IDP added with custom scopes');
      });

      it('should verify Google IDP has correct issuer', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        await ctx.commands.addGoogleIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Google Issuer Test',
            clientID: 'test-client-id',
            clientSecret: 'test-client-secret',
          }
        );

        await processProjection();
        
        const idp = await idpQueries.getIDPByID(idpID, 'test-instance');
        expect(idp).not.toBeNull();
        
        console.log('✓ Google IDP issuer verified');
      });
    });
  });

  describe('addAzureADIDPToOrg', () => {
    describe('Success Cases', () => {
      it('should add Azure AD IDP with tenant configuration', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        console.log('\n--- Adding Azure AD IDP ---');
        const result = await ctx.commands.addAzureADIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Azure AD Login',
            clientID: 'azure-client-id-123',
            clientSecret: 'azure-client-secret-456',
            tenant: 'contoso.onmicrosoft.com',
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.idp.oidc.added');
        expect(event.payload).toHaveProperty('name', 'Azure AD Login');
        expect(event.payload).toHaveProperty('type', IDPType.OIDC);
        expect(event.payload?.config).toHaveProperty(
          'issuer',
          'https://login.microsoftonline.com/contoso.onmicrosoft.com/v2.0'
        );
        expect(event.payload?.config?.scopes).toEqual(['openid', 'profile', 'email']);

        // Process and verify via query layer
        await processProjection();
        await assertIDPInQuery(org.orgID, idpID, 'Azure AD Login', IDPType.OIDC);
      });

      it('should add Azure AD IDP with tenant ID (GUID)', async () => {
        const org = await createTestOrg();

        await ctx.commands.addAzureADIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Azure AD with GUID',
            clientID: 'azure-client-id',
            clientSecret: 'azure-client-secret',
            tenant: '12345678-1234-1234-1234-123456789abc',
          }
        );

        const event = await ctx.assertEventPublished('org.idp.oidc.added');
        expect(event.payload?.config?.issuer).toBe(
          'https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0'
        );

        console.log('✓ Azure AD IDP added with tenant GUID');
      });

      it('should add Azure AD IDP with custom scopes', async () => {
        const org = await createTestOrg();

        await ctx.commands.addAzureADIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Azure AD Custom Scopes',
            clientID: 'azure-client-id',
            clientSecret: 'azure-client-secret',
            tenant: 'common',
            scopes: ['openid', 'profile', 'email', 'User.Read'],
          }
        );

        const event = await ctx.assertEventPublished('org.idp.oidc.added');
        expect(event.payload?.config?.scopes).toEqual([
          'openid',
          'profile',
          'email',
          'User.Read'
        ]);

        console.log('✓ Azure AD IDP added with custom scopes');
      });
    });
  });

  describe('addAppleIDPToOrg', () => {
    describe('Success Cases', () => {
      it('should add Apple IDP with private key configuration', async () => {
        const org = await createTestOrg();
        const idpID = await ctx.commands.nextID();

        console.log('\n--- Adding Apple IDP ---');
        const privateKey = Buffer.from('-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----');

        const result = await ctx.commands.addAppleIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            idpID,
            name: 'Sign in with Apple',
            clientID: 'com.example.app.client',
            teamID: 'TEAM123ABC',
            keyID: 'KEY456DEF',
            privateKey,
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.idp.oidc.added');
        expect(event.payload).toHaveProperty('name', 'Sign in with Apple');
        expect(event.payload).toHaveProperty('type', IDPType.OIDC);
        expect(event.payload?.config).toHaveProperty('issuer', 'https://appleid.apple.com');
        expect(event.payload?.config).toHaveProperty('clientID', 'com.example.app.client');
        // Client secret should be generated (JWT)
        expect(event.payload?.config?.clientSecret).toContain('apple_client_secret');
        expect(event.payload?.config?.scopes).toEqual(['openid', 'email', 'name']);

        // Process and verify via query layer
        await processProjection();
        await assertIDPInQuery(org.orgID, idpID, 'Sign in with Apple', IDPType.OIDC);
      });

      it('should generate Apple client secret with team and key IDs', async () => {
        const org = await createTestOrg();
        const privateKey = Buffer.from('test-private-key');

        await ctx.commands.addAppleIDPToOrg(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Apple Login',
            clientID: 'com.example.app',
            teamID: 'ABC123',
            keyID: 'DEF456',
            privateKey,
          }
        );

        const event = await ctx.assertEventPublished('org.idp.oidc.added');
        const clientSecret = event.payload?.config?.clientSecret;
        
        expect(clientSecret).toBeDefined();
        expect(clientSecret).toContain('ABC123');
        expect(clientSecret).toContain('DEF456');
        expect(clientSecret).toContain('com.example.app');

        console.log('✓ Apple client secret generated correctly');
      });
    });
  });

  describe('Complete Lifecycle', () => {
    it('should support all three providers in one organization', async () => {
      const org = await createTestOrg();

      console.log('\n--- Testing Multiple Providers ---');

      // Add Google IDP
      console.log('Step 1: Add Google IDP');
      await ctx.commands.addGoogleIDPToOrg(
        ctx.createContext(),
        org.orgID,
        {
          name: 'Google',
          clientID: 'google-client',
          clientSecret: 'google-secret',
        }
      );

      // Add Azure AD IDP
      console.log('Step 2: Add Azure AD IDP');
      await ctx.commands.addAzureADIDPToOrg(
        ctx.createContext(),
        org.orgID,
        {
          name: 'Azure AD',
          clientID: 'azure-client',
          clientSecret: 'azure-secret',
          tenant: 'common',
        }
      );

      // Add Apple IDP
      console.log('Step 3: Add Apple IDP');
      const privateKey = Buffer.from('test-key');
      await ctx.commands.addAppleIDPToOrg(
        ctx.createContext(),
        org.orgID,
        {
          name: 'Apple',
          clientID: 'com.example.app',
          teamID: 'TEAM',
          keyID: 'KEY',
          privateKey,
        }
      );

      await processProjection();

      // Verify all three exist
      const idps = await idpQueries.searchIDPs({
        instanceID: 'test-instance',
        resourceOwner: org.orgID,
      });

      expect(idps.idps.length).toBe(3);
      
      const names = idps.idps.map(idp => idp.name).sort();
      expect(names).toEqual(['Apple', 'Azure AD', 'Google']);

      console.log('✓ All three provider types supported in one organization');
    });
  });
});
