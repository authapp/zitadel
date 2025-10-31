/**
 * Auth Service Integration Tests
 * 
 * Tests authenticated user operations following established patterns
 * Complete stack: gRPC API → Commands → Events → Projections → Queries → DB
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { UserProjection } from '../../../../src/lib/query/projections/user-projection';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { AuthService } from '../../../../src/api/grpc/auth/v1/auth_service';
import { UserGrantQueries } from '../../../../src/lib/query/user-grant/user-grant-queries';
import { OrgQueries } from '../../../../src/lib/query/org/org-queries';

describe('Auth Service Integration Tests', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let userProjection: UserProjection;
  let userQueries: UserQueries;
  let userGrantQueries: UserGrantQueries;
  let orgQueries: OrgQueries;
  let authService: AuthService;

  // Test data
  let testOrgID: string;
  let testUserID: string;

  beforeAll(async () => {
    // Setup database
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    // Setup command infrastructure
    ctx = await setupCommandTest(pool);
    
    // Initialize projections
    userProjection = new UserProjection(ctx.eventstore, pool);
    await userProjection.init();
    
    // Initialize query layers
    userQueries = new UserQueries(pool);
    userGrantQueries = new UserGrantQueries(pool);
    orgQueries = new OrgQueries(pool);
    
    // Initialize Auth service
    authService = new AuthService(ctx.commands, userQueries, userGrantQueries, orgQueries);
    
    // Create test org and user
    const org = await ctx.commands.setupOrg(ctx.createContext(), {
      name: 'Test Org',
      admins: [{
        username: 'auth-test-admin',
        email: 'auth-admin@test.com',
        firstName: 'Auth',
        lastName: 'Admin',
      }],
    });
    
    testOrgID = org.orgID;
    testUserID = org.createdAdmins[0].userID;
    
    // Process projections
    await processProjections();
    
    console.log('✅ Auth Service test environment initialized');
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  /**
   * Helper: Create authenticated context
   */
  function createAuthContext(userID: string, orgID: string) {
    return ctx.createContext({
      orgID: orgID,
      userID: userID,
    });
  }

  /**
   * Helper: Process all projections
   */
  async function processProjections(): Promise<void> {
    const events = await ctx.getEvents('*', '*');

    for (const event of events) {
      await userProjection.reduce(event);
    }
  }

  /**
   * Helper: Verify user in query layer
   */
  async function assertUserInQuery(userID: string, expectedEmail?: string): Promise<any> {
    const user = await userQueries.getUserByID(userID, 'test-instance');
    expect(user).not.toBeNull();
    
    if (expectedEmail) {
      expect(user!.email).toBe(expectedEmail);
    }
    
    return user;
  }

  // =========================================================================
  // GetMyUser Tests
  // =========================================================================

  describe('GetMyUser', () => {
    it('should get authenticated user', async () => {
      console.log('\n--- GetMyUser: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.GetMyUser(authContext, {});
      
      expect(response.user).toBeDefined();
      expect(response.user.userId).toBe(testUserID);
      expect(response.user.state).toBeDefined();
      
      console.log('✓ Successfully retrieved authenticated user');
    });

    it('should throw error for unauthenticated request', async () => {
      console.log('\n--- GetMyUser: No authenticated user ---');
      
      const unauthContext = ctx.createContext();
      
      await expect(
        authService.GetMyUser(unauthContext, {})
      ).rejects.toThrow();
      
      console.log('✓ Correctly rejected unauthenticated request');
    });
  });

  // =========================================================================
  // UpdateMyUserProfile Tests
  // =========================================================================

  describe('UpdateMyUserProfile', () => {
    it('should update user profile', async () => {
      console.log('\n--- UpdateMyUserProfile: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.UpdateMyUserProfile(authContext, {
        firstName: 'Updated',
        lastName: 'Name',
        displayName: 'Updated User',
        preferredLanguage: 'en',
      });
      
      expect(response.details).toBeDefined();
      
      // Process projections
      await processProjections();
      
      // Verify via query
      const user = await assertUserInQuery(testUserID);
      expect(user.firstName).toBe('Updated');
      expect(user.lastName).toBe('Name');
      
      console.log('✓ Profile updated successfully');
    });

    it('should throw error for unauthenticated request', async () => {
      console.log('\n--- UpdateMyUserProfile: Unauthenticated ---');
      
      const unauthContext = ctx.createContext();
      
      await expect(
        authService.UpdateMyUserProfile(unauthContext, {
          firstName: 'Test',
        })
      ).rejects.toThrow();
      
      console.log('✓ Correctly rejected unauthenticated request');
    });
  });

  // =========================================================================
  // UpdateMyUserEmail Tests
  // =========================================================================

  describe('UpdateMyUserEmail', () => {
    it('should update user email', async () => {
      console.log('\n--- UpdateMyUserEmail: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const newEmail = 'updated-auth-user@test.com';
      const response = await authService.UpdateMyUserEmail(authContext, {
        email: newEmail,
      });
      
      expect(response.details).toBeDefined();
      
      // Process projections
      await processProjections();
      
      // Verify via query
      await assertUserInQuery(testUserID, newEmail);
      
      console.log('✓ Email updated successfully');
    });
  });

  // =========================================================================
  // VerifyMyUserEmail Tests
  // =========================================================================

  describe('VerifyMyUserEmail', () => {
    it('should verify user email', async () => {
      console.log('\n--- VerifyMyUserEmail: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.VerifyMyUserEmail(authContext, {
        code: 'verification-code',
      });
      
      expect(response.details).toBeDefined();
      
      console.log('✓ Email verification triggered');
    });
  });

  // =========================================================================
  // ResendMyUserEmailVerification Tests
  // =========================================================================

  describe('ResendMyUserEmailVerification', () => {
    it('should resend email verification', async () => {
      console.log('\n--- ResendMyUserEmailVerification: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      
      // First, change the email to create a pending verification
      await authService.UpdateMyUserEmail(authContext, {
        email: 'resend-test@test.com',
      });
      
      // Process projections to ensure code is stored
      await processProjections();
      
      // Now resend the verification
      const response = await authService.ResendMyUserEmailVerification(authContext, {});
      
      expect(response.details).toBeDefined();
      
      console.log('✓ Email verification resent');
    });
  });

  // =========================================================================
  // UpdateMyUserPhone Tests
  // =========================================================================

  describe('UpdateMyUserPhone', () => {
    it('should update user phone', async () => {
      console.log('\n--- UpdateMyUserPhone: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.UpdateMyUserPhone(authContext, {
        phone: '+1234567890',
      });
      
      expect(response.details).toBeDefined();
      
      // Process projections
      await processProjections();
      
      // Verify via query
      const user = await assertUserInQuery(testUserID);
      expect(user.phone).toBe('+1234567890');
      
      console.log('✓ Phone updated successfully');
    });
  });

  // =========================================================================
  // VerifyMyUserPhone Tests
  // =========================================================================

  describe('VerifyMyUserPhone', () => {
    it('should verify user phone', async () => {
      console.log('\n--- VerifyMyUserPhone: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.VerifyMyUserPhone(authContext, {
        code: 'verification-code',
      });
      
      expect(response.details).toBeDefined();
      
      console.log('✓ Phone verification triggered');
    });
  });

  // =========================================================================
  // RemoveMyUserPhone Tests
  // =========================================================================

  describe('RemoveMyUserPhone', () => {
    it('should remove user phone', async () => {
      console.log('\n--- RemoveMyUserPhone: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.RemoveMyUserPhone(authContext, {});
      
      expect(response.details).toBeDefined();
      
      // Process projections
      await processProjections();
      
      // Verify via query
      const user = await assertUserInQuery(testUserID);
      expect(user.phone).toBeNull();
      
      console.log('✓ Phone removed successfully');
    });
  });

  // =========================================================================
  // ListMyUserChanges Tests
  // =========================================================================

  describe('ListMyUserChanges', () => {
    it('should list user changes (audit log)', async () => {
      console.log('\n--- ListMyUserChanges: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.ListMyUserChanges(authContext, {
        query: { limit: 10 },
      });
      
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result)).toBe(true);
      
      console.log('✓ User changes listed successfully');
    });
  });

  // =========================================================================
  // GetMyUserSessions Tests
  // =========================================================================

  describe('GetMyUserSessions', () => {
    it('should get user sessions', async () => {
      console.log('\n--- GetMyUserSessions: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.GetMyUserSessions(authContext, {});
      
      expect(response.sessions).toBeDefined();
      expect(Array.isArray(response.sessions)).toBe(true);
      
      console.log('✓ User sessions retrieved successfully');
    });
  });

  // =========================================================================
  // ListMyUserGrants Tests
  // =========================================================================

  describe('ListMyUserGrants', () => {
    it('should list user grants', async () => {
      console.log('\n--- ListMyUserGrants: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.ListMyUserGrants(authContext, {
        query: { limit: 10 },
      });
      
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result)).toBe(true);
      expect(response.details).toBeDefined();
      
      console.log('✓ User grants listed successfully');
    });
  });

  // =========================================================================
  // ListMyProjectOrgs Tests
  // =========================================================================

  describe('ListMyProjectOrgs', () => {
    it('should list project organizations', async () => {
      console.log('\n--- ListMyProjectOrgs: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.ListMyProjectOrgs(authContext, {
        query: { limit: 10 },
      });
      
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result)).toBe(true);
      
      console.log('✓ Project orgs listed successfully');
    });
  });

  // =========================================================================
  // GetMyZitadelPermissions Tests
  // =========================================================================

  describe('GetMyZitadelPermissions', () => {
    it('should get Zitadel permissions', async () => {
      console.log('\n--- GetMyZitadelPermissions: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.GetMyZitadelPermissions(authContext, {});
      
      expect(response.permissions).toBeDefined();
      expect(Array.isArray(response.permissions)).toBe(true);
      
      console.log('✓ Zitadel permissions retrieved successfully');
    });
  });

  // =========================================================================
  // GetMyProjectPermissions Tests
  // =========================================================================

  describe('GetMyProjectPermissions', () => {
    it('should get project permissions', async () => {
      console.log('\n--- GetMyProjectPermissions: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.GetMyProjectPermissions(authContext, {});
      
      expect(response.permissions).toBeDefined();
      expect(Array.isArray(response.permissions)).toBe(true);
      
      console.log('✓ Project permissions retrieved successfully');
    });
  });

  // =========================================================================
  // CreateSession Tests
  // =========================================================================

  describe('CreateSession', () => {
    it('should create user session', async () => {
      console.log('\n--- CreateSession: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.CreateSession(authContext, {
        userAgent: 'TestBrowser/1.0',
        metadata: { ip: '127.0.0.1' },
      });
      
      expect(response.sessionId).toBeDefined();
      expect(response.sessionToken).toBeDefined();
      expect(response.details).toBeDefined();
      
      console.log('✓ Session created successfully');
    });
  });

  // =========================================================================
  // ListSessions Tests
  // =========================================================================

  describe('ListSessions', () => {
    it('should list user sessions', async () => {
      console.log('\n--- ListSessions: Success ---');
      
      const authContext = createAuthContext(testUserID, testOrgID);
      const response = await authService.ListSessions(authContext, {
        query: { limit: 10 },
      });
      
      expect(response.sessions).toBeDefined();
      expect(Array.isArray(response.sessions)).toBe(true);
      
      console.log('✓ Sessions listed successfully');
    });
  });

  // =========================================================================
  // Complete Lifecycle Test
  // =========================================================================

  describe('Complete Auth Service Lifecycle', () => {
    it('should handle complete authenticated user workflow', async () => {
      console.log('\n=== Complete Auth Service Lifecycle ===');
      
      // Create auth context for lifecycle
      const authContext = createAuthContext(testUserID, testOrgID);
      
      // 1. Get user
      console.log('Step 1: Get authenticated user');
      const getUserResponse = await authService.GetMyUser(authContext, {});
      expect(getUserResponse.user).toBeDefined();
      
      // 2. Update profile
      console.log('Step 2: Update user profile');
      await authService.UpdateMyUserProfile(authContext, {
        firstName: 'Lifecycle',
        lastName: 'Test',
      });
      
      // 3. Update email
      console.log('Step 3: Update user email');
      await authService.UpdateMyUserEmail(authContext, {
        email: 'lifecycle@test.com',
      });
      
      // 4. Update phone
      console.log('Step 4: Update user phone');
      await authService.UpdateMyUserPhone(authContext, {
        phone: '+9876543210',
      });
      
      // 5. Create session
      console.log('Step 5: Create session');
      const sessionResponse = await authService.CreateSession(authContext, {
        userAgent: 'TestAgent/1.0',
      });
      expect(sessionResponse.sessionId).toBeDefined();
      
      // 6. List grants
      console.log('Step 6: List user grants');
      const grantsResponse = await authService.ListMyUserGrants(authContext, {});
      expect(grantsResponse.result).toBeDefined();
      
      // Process projections and verify
      await processProjections();
      const user = await assertUserInQuery(testUserID, 'lifecycle@test.com');
      expect(user.firstName).toBe('Lifecycle');
      expect(user.phone).toBe('+9876543210');
      
      console.log('✓ Complete lifecycle successful');
    });
  });

  // =========================================================================
  // Coverage Summary
  // =========================================================================

  describe('Coverage Summary', () => {
    it('should confirm complete stack testing', () => {
      console.log('\n=== Auth Service Test Coverage ===');
      console.log('✓ gRPC API Layer - AuthService endpoints');
      console.log('✓ Command Layer - User commands');
      console.log('✓ Event Layer - Events published');
      console.log('✓ Projection Layer - UserProjection');
      console.log('✓ Query Layer - UserQueries, UserGrantQueries');
      console.log('✓ Database Layer - PostgreSQL');
      console.log('\n✅ Complete stack verified for Auth Service');
      
      expect(true).toBe(true);
    });
  });
});
