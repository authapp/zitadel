/**
 * Admin Service - Identity Provider (IDP) Integration Tests
 * 
 * Sprint 15 - Phase 3: IDP Endpoints
 * Tests complete E2E flow: API → Commands → Events → Projections → DB
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { AdminService } from '../../../../src/api/grpc/admin/v1/admin_service';
import { IDPProjection } from '../../../../src/lib/query/projections/idp-projection';
import { IDPQueries } from '../../../../src/lib/query/idp/idp-queries';
import { IDPType, IDPState } from '../../../../src/api/grpc/proto/admin/v1/admin_service';

describe('Admin Service - Identity Providers (E2E)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let adminService: AdminService;
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

    // Initialize Admin Service
    adminService = new AdminService(ctx.commands, pool);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  /**
   * Helper: Process all projections
   */
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    for (const event of events) {
      await idpProjection.reduce(event);
    }
  }

  /**
   * Helper: Verify IDP in query layer
   */
  async function assertIDPInQuery(idpID: string, expectedName?: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');
    expect(idp).not.toBeNull();
    if (expectedName) {
      expect(idp!.name).toBe(expectedName);
    }
    console.log(`✓ IDP verified in query layer: ${idp!.name}`);
    return idp;
  }

  /**
   * Helper: Verify IDP does NOT exist
   */
  async function assertIDPNotInQuery(idpID: string) {
    const idp = await idpQueries.getIDPByID(idpID, 'test-instance');
    expect(idp).toBeNull();
    console.log(`✓ IDP removed from query layer`);
  }

  // ============================================================================
  // OIDC IDP Tests
  // ============================================================================

  describe('OIDC Identity Providers', () => {
    it('should add OIDC IDP', async () => {
      const context = ctx.createContext();

      console.log('\n--- Adding OIDC IDP ---');
      const response = await adminService.addOIDCIDP(context, {
        name: 'Google OIDC',
        clientId: 'google-client-id-123',
        clientSecret: 'google-client-secret-xyz',
        issuer: 'https://accounts.google.com',
        scopes: ['openid', 'profile', 'email'],
        isCreationAllowed: true,
        isLinkingAllowed: true,
        isAutoCreation: false,
        isAutoUpdate: true,
      });

      expect(response).toBeDefined();
      expect(response.details).toBeDefined();
      expect(response.details.sequence).toBeGreaterThan(0);
      expect(response.id).toBeDefined();
      expect(typeof response.id).toBe('string');
      expect(response.id.length).toBeGreaterThan(0);

      console.log(`✓ OIDC IDP added: ${response.id}`);
      console.log(`  → Sequence: ${response.details.sequence}`);

      // Process projection
      await processProjections();

      // Verify via query layer
      await assertIDPInQuery(response.id, 'Google OIDC');
    });

    it('should add OIDC IDP with minimal config', async () => {
      const context = ctx.createContext();

      const response = await adminService.addOIDCIDP(context, {
        name: 'Azure AD',
        clientId: 'azure-client-id',
        clientSecret: 'azure-secret',
        issuer: 'https://login.microsoftonline.com/tenant-id/v2.0',
      });

      expect(response).toBeDefined();
      expect(response.id).toBeDefined();

      await processProjections();
      await assertIDPInQuery(response.id, 'Azure AD');

      console.log('✓ OIDC IDP with minimal config added');
    });

    it('should validate OIDC name required', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.addOIDCIDP(context, {
          name: '',
          clientId: 'client-id',
          clientSecret: 'secret',
          issuer: 'https://issuer.com',
        })
      ).rejects.toThrow('name is required');

      console.log('✓ OIDC name validation works');
    });

    it('should validate OIDC client ID required', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.addOIDCIDP(context, {
          name: 'Test IDP',
          clientId: '',
          clientSecret: 'secret',
          issuer: 'https://issuer.com',
        })
      ).rejects.toThrow('client ID is required');

      console.log('✓ OIDC client ID validation works');
    });

    it('should validate OIDC issuer required', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.addOIDCIDP(context, {
          name: 'Test IDP',
          clientId: 'client-id',
          clientSecret: 'secret',
          issuer: '',
        })
      ).rejects.toThrow('issuer is required');

      console.log('✓ OIDC issuer validation works');
    });
  });

  // ============================================================================
  // OAuth IDP Tests
  // ============================================================================

  describe('OAuth Identity Providers', () => {
    it('should add OAuth IDP', async () => {
      const context = ctx.createContext();

      console.log('\n--- Adding OAuth IDP ---');
      const response = await adminService.addOAuthIDP(context, {
        name: 'GitHub OAuth',
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        userEndpoint: 'https://api.github.com/user',
        scopes: ['user', 'email'],
        isCreationAllowed: true,
        isLinkingAllowed: true,
      });

      expect(response).toBeDefined();
      expect(response.details).toBeDefined();
      expect(response.id).toBeDefined();

      console.log(`✓ OAuth IDP added: ${response.id}`);

      await processProjections();
      await assertIDPInQuery(response.id, 'GitHub OAuth');
    });

    it('should add OAuth IDP with all options', async () => {
      const context = ctx.createContext();

      const response = await adminService.addOAuthIDP(context, {
        name: 'GitLab OAuth',
        clientId: 'gitlab-client-id',
        clientSecret: 'gitlab-secret',
        authorizationEndpoint: 'https://gitlab.com/oauth/authorize',
        tokenEndpoint: 'https://gitlab.com/oauth/token',
        userEndpoint: 'https://gitlab.com/api/v4/user',
        scopes: ['read_user', 'email'],
        idAttribute: 'id',
        isCreationAllowed: true,
        isLinkingAllowed: true,
        isAutoCreation: true,
        isAutoUpdate: true,
      });

      expect(response).toBeDefined();
      await processProjections();
      await assertIDPInQuery(response.id, 'GitLab OAuth');

      console.log('✓ OAuth IDP with all options added');
    });

    it('should validate OAuth authorization endpoint required', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.addOAuthIDP(context, {
          name: 'Test OAuth',
          clientId: 'client-id',
          clientSecret: 'secret',
          authorizationEndpoint: '',
          tokenEndpoint: 'https://token.com',
          userEndpoint: 'https://user.com',
        })
      ).rejects.toThrow('authorization endpoint is required');

      console.log('✓ OAuth authorization endpoint validation works');
    });

    it('should validate OAuth token endpoint required', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.addOAuthIDP(context, {
          name: 'Test OAuth',
          clientId: 'client-id',
          clientSecret: 'secret',
          authorizationEndpoint: 'https://auth.com',
          tokenEndpoint: '',
          userEndpoint: 'https://user.com',
        })
      ).rejects.toThrow('token endpoint is required');

      console.log('✓ OAuth token endpoint validation works');
    });

    it('should validate OAuth user endpoint required', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.addOAuthIDP(context, {
          name: 'Test OAuth',
          clientId: 'client-id',
          clientSecret: 'secret',
          authorizationEndpoint: 'https://auth.com',
          tokenEndpoint: 'https://token.com',
          userEndpoint: '',
        })
      ).rejects.toThrow('user endpoint is required');

      console.log('✓ OAuth user endpoint validation works');
    });
  });

  // ============================================================================
  // IDP Management Tests
  // ============================================================================

  describe('IDP Management', () => {
    let testIDPID: string;

    beforeAll(async () => {
      // Create a test IDP for management operations
      const context = ctx.createContext();
      const response = await adminService.addOIDCIDP(context, {
        name: 'Management Test IDP',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        issuer: 'https://test-issuer.com',
      });
      testIDPID = response.id;
      await processProjections();
    });

    it('should get IDP by ID', async () => {
      const context = ctx.createContext();

      const response = await adminService.getIDP(context, {
        id: testIDPID,
      });

      expect(response).toBeDefined();
      expect(response.idp).toBeDefined();
      expect(response.idp.id).toBe(testIDPID);
      expect(response.idp.name).toBe('Management Test IDP');
      expect(response.idp.type).toBe(IDPType.OIDC);
      expect(response.idp.state).toBe(IDPState.ACTIVE);

      console.log('✓ IDP retrieved by ID successfully');
    });

    it('should list all IDPs', async () => {
      const context = ctx.createContext();

      const response = await adminService.listIDPs(context, {
        query: {
          limit: 50,
          offset: 0,
        },
      });

      expect(response).toBeDefined();
      expect(response.idps).toBeDefined();
      expect(Array.isArray(response.idps)).toBe(true);
      expect(response.idps.length).toBeGreaterThan(0);
      expect(response.totalResults).toBeGreaterThan(0);

      console.log(`✓ Listed ${response.idps.length} IDPs (total: ${response.totalResults})`);
    });

    it('should list IDPs with name filter', async () => {
      const context = ctx.createContext();

      const response = await adminService.listIDPs(context, {
        query: {
          limit: 50,
          offset: 0,
          name: 'GitHub',
        },
      });

      expect(response).toBeDefined();
      expect(response.idps).toBeDefined();
      
      // All results should match the filter
      response.idps.forEach((idp) => {
        expect(idp.name.toLowerCase()).toContain('github'.toLowerCase());
      });

      console.log(`✓ Listed ${response.idps.length} IDPs matching 'GitHub'`);
    });

    it('should list IDPs with type filter', async () => {
      const context = ctx.createContext();

      const response = await adminService.listIDPs(context, {
        query: {
          limit: 50,
          offset: 0,
          type: IDPType.OIDC,
        },
      });

      expect(response).toBeDefined();
      expect(response.idps).toBeDefined();
      
      // All results should be OIDC type
      response.idps.forEach((idp) => {
        expect(idp.type).toBe(IDPType.OIDC);
      });

      console.log(`✓ Listed ${response.idps.length} OIDC IDPs`);
    });

    it('should update IDP name', async () => {
      const context = ctx.createContext();

      const response = await adminService.updateIDP(context, {
        id: testIDPID,
        name: 'Updated Management Test IDP',
      });

      expect(response).toBeDefined();
      expect(response.details).toBeDefined();
      expect(response.details.sequence).toBeGreaterThan(0);

      await processProjections();
      await assertIDPInQuery(testIDPID, 'Updated Management Test IDP');

      console.log('✓ IDP name updated successfully');
    });

    it('should remove IDP', async () => {
      const context = ctx.createContext();

      const response = await adminService.removeIDP(context, {
        id: testIDPID,
      });

      expect(response).toBeDefined();
      expect(response.details).toBeDefined();

      await processProjections();
      
      // IDP should be marked as removed (not actually deleted)
      const idp = await idpQueries.getIDPByID(testIDPID, 'test-instance');
      if (idp) {
        expect(idp.state).toBe(IDPState.REMOVED);
      }

      console.log('✓ IDP removed successfully');
    });

    it('should fail to get non-existent IDP', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.getIDP(context, {
          id: 'non-existent-idp-id',
        })
      ).rejects.toThrow('IDP not found');

      console.log('✓ Non-existent IDP handling works');
    });

    it('should validate IDP ID required for get', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.getIDP(context, {
          id: '',
        })
      ).rejects.toThrow('IDP ID is required');

      console.log('✓ Get IDP ID validation works');
    });

    it('should validate IDP ID required for update', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.updateIDP(context, {
          id: '',
          name: 'Test',
        })
      ).rejects.toThrow('IDP ID is required');

      console.log('✓ Update IDP ID validation works');
    });

    it('should validate IDP ID required for remove', async () => {
      const context = ctx.createContext();

      await expect(
        adminService.removeIDP(context, {
          id: '',
        })
      ).rejects.toThrow('IDP ID is required');

      console.log('✓ Remove IDP ID validation works');
    });
  });

  // ============================================================================
  // Complete Lifecycle Test
  // ============================================================================

  describe('Complete IDP Stack', () => {
    it('should verify complete stack is functional', async () => {
      const context = ctx.createContext();

      console.log('\n=== COMPLETE STACK TEST ===');

      // 1. Add OIDC IDP
      console.log('\n1. Testing OIDC IDP...');
      const oidcResponse = await adminService.addOIDCIDP(context, {
        name: 'Lifecycle Test OIDC',
        clientId: 'lifecycle-oidc-client',
        clientSecret: 'lifecycle-oidc-secret',
        issuer: 'https://lifecycle-oidc.com',
      });
      console.log(`✓ OIDC IDP created: ${oidcResponse.id}`);

      // 2. Add OAuth IDP
      console.log('\n2. Testing OAuth IDP...');
      const oauthResponse = await adminService.addOAuthIDP(context, {
        name: 'Lifecycle Test OAuth',
        clientId: 'lifecycle-oauth-client',
        clientSecret: 'lifecycle-oauth-secret',
        authorizationEndpoint: 'https://lifecycle.com/authorize',
        tokenEndpoint: 'https://lifecycle.com/token',
        userEndpoint: 'https://lifecycle.com/user',
      });
      console.log(`✓ OAuth IDP created: ${oauthResponse.id}`);

      // 3. Process projections
      await processProjections();

      // 4. Verify via query layer
      await assertIDPInQuery(oidcResponse.id, 'Lifecycle Test OIDC');
      await assertIDPInQuery(oauthResponse.id, 'Lifecycle Test OAuth');

      // 5. List all IDPs
      const listResponse = await adminService.listIDPs(context, {});
      expect(listResponse.idps.length).toBeGreaterThan(0);
      console.log(`✓ Listed ${listResponse.idps.length} total IDPs`);

      // 6. Update IDP
      await adminService.updateIDP(context, {
        id: oidcResponse.id,
        name: 'Updated Lifecycle OIDC',
      });
      await processProjections();
      await assertIDPInQuery(oidcResponse.id, 'Updated Lifecycle OIDC');

      // 7. Remove IDP
      await adminService.removeIDP(context, {
        id: oauthResponse.id,
      });
      await processProjections();

      console.log('\n=== COMPLETE STACK TESTED ===');
      console.log('✓ API Layer (AdminService)');
      console.log('✓ Command Layer (IDP Commands)');
      console.log('✓ Event Layer (Event publishing)');
      console.log('✓ Projection Layer (IDP Projection)');
      console.log('✓ Query Layer (IDP Queries)');
      console.log('✓ All IDP operations functional');
      console.log('================================');
    });
  });
});
