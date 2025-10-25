/**
 * Personal Access Token Commands Integration Tests
 * Tests command→event→projection→query flow for PAT management
 * 
 * Commands: addPersonalAccessToken, removePersonalAccessToken, updatePersonalAccessTokenUsage
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder } from '../../helpers/test-data-builders';
import { UserProjection } from '../../../src/lib/query/projections/user-projection';
import { PersonalAccessTokenProjection } from '../../../src/lib/query/projections/personal-access-token-projection';
import { AdminQueries } from '../../../src/lib/query/admin/admin-queries';

describe('Personal Access Token Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let userProjection: UserProjection;
  let patProjection: PersonalAccessTokenProjection;
  let adminQueries: AdminQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize user projection first (required for FK constraint)
    userProjection = new UserProjection(ctx.eventstore, pool);
    await userProjection.init();
    
    // Initialize PAT projection
    patProjection = new PersonalAccessTokenProjection(ctx.eventstore, pool);
    await patProjection.init();
    
    // Initialize query layer
    adminQueries = new AdminQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clear all events
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE personal_access_tokens_projection CASCADE');
    await pool.query('TRUNCATE users_projection CASCADE');
  });

  /**
   * Helper: Create test user and org via commands
   */
  async function createTestUser(): Promise<{ userID: string; orgID: string }> {
    const userData = new UserBuilder()
      .withUsername(`patuser${Date.now()}`)
      .withEmail(`patuser${Date.now()}@example.com`)
      .build();

    const createResult = await ctx.commands.addHumanUser(
      ctx.createContext(),
      userData
    );

    return { 
      userID: createResult.userID,
      orgID: userData.orgID 
    };
  }

  /**
   * Helper: Process ALL projections (user events first, then PAT events)
   * This ensures FK constraints are satisfied
   */
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projections...`);
    
    // Process each event through appropriate projections
    for (const event of events) {
      try {
        // Process user events first (for FK constraint)
        if (event.aggregateType === 'user') {
          await userProjection.reduce(event);
          console.log(`  ✓ Processed ${event.eventType} via UserProjection`);
        }
        
        // Process PAT-specific events
        if (event.eventType.includes('personal.access.token')) {
          await patProjection.reduce(event);
          console.log(`  ✓ Processed ${event.eventType} via PATProjection`);
        }
      } catch (err) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err);
        throw err;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Verify PAT exists via Query Layer
   */
  async function assertPATInQuery(tokenID: string) {
    const pat = await adminQueries.getPersonalAccessTokenByID(
      ctx.createContext().instanceID,
      tokenID
    );

    expect(pat).not.toBeNull();
    console.log(`✓ PAT verified via query layer`);
    return pat;
  }

  describe('addPersonalAccessToken', () => {
    describe('Success Cases', () => {
      it('should add PAT with scopes', async () => {
        const { userID, orgID } = await createTestUser();

        console.log('\n--- Adding Personal Access Token ---');
        const result = await ctx.commands.addPersonalAccessToken(
          ctx.createContext(),
          userID,
          orgID,
          {
            scopes: ['openid', 'profile', 'email'],
          }
        );

        expect(result).toBeDefined();
        expect(result.token).toBeDefined();
        expect(result.details).toBeDefined();

        // Token should be a base64url string
        expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/);

        // Verify event
        const event = await ctx.assertEventPublished('user.personal.access.token.added');
        const tokenID = event.payload?.id;
        expect(event.payload).toHaveProperty('id');
        expect(event.payload).toHaveProperty('tokenHash');
        expect(event.payload).toHaveProperty('scopes');
        expect(event.payload?.scopes).toEqual(['openid', 'profile', 'email']);

        // Process projections and verify via query layer
        await processProjections();
        await assertPATInQuery(tokenID);

        console.log('✓ PAT added successfully');
      });

      it('should add PAT with expiration date', async () => {
        const { userID, orgID } = await createTestUser();

        const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const result = await ctx.commands.addPersonalAccessToken(
          ctx.createContext(),
          userID,
          orgID,
          {
            scopes: ['openid'],
            expirationDate,
          }
        );

        expect(result.token).toBeDefined();

        const event = await ctx.assertEventPublished('user.personal.access.token.added');
        expect(event.payload).toHaveProperty('expirationDate');

        console.log('✓ PAT with expiration date added');
      });

      it('should add PAT without scopes', async () => {
        const { userID, orgID } = await createTestUser();

        const result = await ctx.commands.addPersonalAccessToken(
          ctx.createContext(),
          userID,
          orgID,
          {}
        );

        expect(result.token).toBeDefined();

        const event = await ctx.assertEventPublished('user.personal.access.token.added');
        expect(event.payload?.scopes).toEqual([]);

        console.log('✓ PAT without scopes added');
      });

      it('should add multiple PATs for same user', async () => {
        const { userID, orgID } = await createTestUser();

        const pat1 = await ctx.commands.addPersonalAccessToken(
          ctx.createContext(),
          userID,
          orgID,
          { scopes: ['openid'] }
        );

        const pat2 = await ctx.commands.addPersonalAccessToken(
          ctx.createContext(),
          userID,
          orgID,
          { scopes: ['profile'] }
        );

        expect(pat1.token).not.toBe(pat2.token);

        const events = await ctx.getEvents('user', userID);
        const patEvents = events.filter(e => e.eventType === 'user.personal.access.token.added');
        expect(patEvents).toHaveLength(2);

        console.log('✓ Multiple PATs added for same user');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty userID', async () => {
        const orgID = await ctx.commands.nextID();

        await expect(
          ctx.commands.addPersonalAccessToken(
            ctx.createContext(),
            '',
            orgID,
            { scopes: ['openid'] }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty userID');
      });

      it('should fail with empty orgID', async () => {
        const userID = await ctx.commands.nextID();

        await expect(
          ctx.commands.addPersonalAccessToken(
            ctx.createContext(),
            userID,
            '',
            { scopes: ['openid'] }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty orgID');
      });

      it('should fail with expiration date in the past', async () => {
        const { userID, orgID } = await createTestUser();

        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

        await expect(
          ctx.commands.addPersonalAccessToken(
            ctx.createContext(),
            userID,
            orgID,
            {
              scopes: ['openid'],
              expirationDate: pastDate,
            }
          )
        ).rejects.toThrow(/future/i);

        console.log('✓ Rejected past expiration date');
      });
    });
  });

  describe('removePersonalAccessToken', () => {
    describe('Success Cases', () => {
      it('should remove PAT', async () => {
        const { userID, orgID } = await createTestUser();

        // Add PAT first
        await ctx.commands.addPersonalAccessToken(
          ctx.createContext(),
          userID,
          orgID,
          { scopes: ['openid'] }
        );

        const addEvent = await ctx.assertEventPublished('user.personal.access.token.added');
        const tokenID = addEvent.payload?.id;

        await processProjections();
        await assertPATInQuery(tokenID);

        console.log('\n--- Removing Personal Access Token ---');
        await ctx.commands.removePersonalAccessToken(
          ctx.createContext(),
          userID,
          orgID,
          tokenID
        );

        // Verify event
        const removeEvent = await ctx.assertEventPublished('user.personal.access.token.removed');
        expect(removeEvent.payload).toHaveProperty('id', tokenID);

        console.log('✓ PAT removed successfully');
      });
    });

    describe('Error Cases', () => {
      it('should fail removing non-existent PAT', async () => {
        const { userID, orgID } = await createTestUser();
        const fakeTokenID = await ctx.commands.nextID();

        await expect(
          ctx.commands.removePersonalAccessToken(
            ctx.createContext(),
            userID,
            orgID,
            fakeTokenID
          )
        ).rejects.toThrow(/not found/i);

        console.log('✓ Rejected removing non-existent PAT');
      });

      it('should fail with empty tokenID', async () => {
        const { userID, orgID } = await createTestUser();

        await expect(
          ctx.commands.removePersonalAccessToken(
            ctx.createContext(),
            userID,
            orgID,
            ''
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty tokenID');
      });
    });
  });

  describe('updatePersonalAccessTokenUsage', () => {
    it('should update PAT usage timestamp', async () => {
      const { userID, orgID } = await createTestUser();

      // Add PAT first
      await ctx.commands.addPersonalAccessToken(
        ctx.createContext(),
        userID,
        orgID,
        { scopes: ['openid'] }
      );

      const addEvent = await ctx.assertEventPublished('user.personal.access.token.added');
      const tokenID = addEvent.payload?.id;

      console.log('\n--- Updating PAT Usage ---');
      await ctx.commands.updatePersonalAccessTokenUsage(
        ctx.createContext(),
        userID,
        orgID,
        tokenID
      );

      // Verify event
      const events = await ctx.getEvents('user', userID);
      const usageEvents = events.filter(e => e.eventType === 'user.personal.access.token.used');
      expect(usageEvents.length).toBeGreaterThan(0);

      console.log('✓ PAT usage updated successfully');
    });
  });

  describe('Complete Lifecycle', () => {
    it('should complete add → use → remove lifecycle', async () => {
      const { userID, orgID } = await createTestUser();

      console.log('\n--- Testing Complete Lifecycle ---');

      // 1. Add PAT
      console.log('Step 1: Add PAT');
      await ctx.commands.addPersonalAccessToken(
        ctx.createContext(),
        userID,
        orgID,
        {
          scopes: ['openid', 'profile', 'email'],
          expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }
      );

      const addEvent = await ctx.assertEventPublished('user.personal.access.token.added');
      const tokenID = addEvent.payload?.id;

      await processProjections();
      await assertPATInQuery(tokenID);

      // 2. Use PAT (multiple times)
      console.log('Step 2: Use PAT');
      await ctx.commands.updatePersonalAccessTokenUsage(ctx.createContext(), userID, orgID, tokenID);
      await ctx.commands.updatePersonalAccessTokenUsage(ctx.createContext(), userID, orgID, tokenID);

      const events = await ctx.getEvents('user', userID);
      const usageEvents = events.filter(e => e.eventType === 'user.personal.access.token.used');
      expect(usageEvents.length).toBeGreaterThanOrEqual(2);

      // 3. Remove PAT
      console.log('Step 3: Remove PAT');
      await ctx.commands.removePersonalAccessToken(ctx.createContext(), userID, orgID, tokenID);

      console.log('✓ Complete lifecycle tested successfully');
    });
  });
});
