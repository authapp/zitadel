/**
 * OAuth Token Commands Integration Tests - Fully Isolated
 * Tests OAuth 2.0 token management (revocation & introspection)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { Command } from '../../../src/lib/eventstore/types';

describe('OAuth Token Commands Integration Tests (Isolated)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  /**
   * Helper: Create isolated test organization
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`OAuth Test Org ${Date.now()}-${Math.random()}`)
      .build();
    
    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return result.orgID;
  }

  /**
   * Helper: Create test OAuth token directly via event
   */
  async function createTestToken(orgID: string, tokenID: string, tokenType: 'access_token' | 'refresh_token' = 'access_token') {
    const command: Command = {
      instanceID: ctx.createContext().instanceID,
      eventType: 'oauth.token.added',
      aggregateType: 'oauth_token',
      aggregateID: tokenID,
      owner: orgID,
      creator: 'system',
      payload: {
        tokenType,
        clientID: 'test-client-123',
        userID: 'test-user-456',
        scope: ['openid', 'profile', 'email'],
        audience: ['https://api.example.com'],
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      },
    };

    await ctx.eventstore.push(command);
    return tokenID;
  }

  describe('revokeOAuthToken', () => {
    describe('Success Cases', () => {
      it('should revoke access token successfully', async () => {
        const orgID = await createTestOrg();
        const tokenID = `token-${Date.now()}-${Math.random()}`;
        await createTestToken(orgID, tokenID, 'access_token');

        const result = await ctx.commands.revokeOAuthToken(
          ctx.createContext(),
          tokenID,
          orgID
        );

        expect(result).toBeDefined();
        expect(result.resourceOwner).toBe(orgID);

        // Verify revocation event
        const events = await ctx.getEvents('oauth_token', tokenID);
        const revokeEvent = events.find(e => e.eventType === 'oauth.token.revoked');
        expect(revokeEvent).toBeDefined();
        expect(revokeEvent!.payload).toBeDefined();
        expect(revokeEvent!.payload!.revokedAt).toBeDefined();
      });

      it('should revoke refresh token successfully', async () => {
        const orgID = await createTestOrg();
        const tokenID = `token-${Date.now()}-${Math.random()}`;
        await createTestToken(orgID, tokenID, 'refresh_token');

        const result = await ctx.commands.revokeOAuthToken(
          ctx.createContext(),
          tokenID,
          orgID,
          'admin-user-123'
        );

        expect(result).toBeDefined();

        // Verify revokedBy field
        const events = await ctx.getEvents('oauth_token', tokenID);
        const revokeEvent = events.find(e => e.eventType === 'oauth.token.revoked');
        expect(revokeEvent!.payload!.revokedBy).toBe('admin-user-123');
      });

      it('should revoke token with default revokedBy', async () => {
        const orgID = await createTestOrg();
        const tokenID = `token-${Date.now()}-${Math.random()}`;
        await createTestToken(orgID, tokenID);

        await ctx.commands.revokeOAuthToken(
          ctx.createContext(),
          tokenID,
          orgID
        );

        const events = await ctx.getEvents('oauth_token', tokenID);
        const revokeEvent = events.find(e => e.eventType === 'oauth.token.revoked');
        expect(revokeEvent!.payload!.revokedBy).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty tokenID', async () => {
        const orgID = await createTestOrg();

        await expect(
          ctx.commands.revokeOAuthToken(
            ctx.createContext(),
            '',
            orgID
          )
        ).rejects.toThrow(/tokenID is required/);
      });

      it('should fail with empty orgID', async () => {
        await expect(
          ctx.commands.revokeOAuthToken(
            ctx.createContext(),
            'some-token',
            ''
          )
        ).rejects.toThrow(/orgID is required/);
      });

      it('should fail revoking non-existent token', async () => {
        const orgID = await createTestOrg();

        await expect(
          ctx.commands.revokeOAuthToken(
            ctx.createContext(),
            'non-existent-token',
            orgID
          )
        ).rejects.toThrow(/token not found/);
      });

      it('should fail revoking already revoked token', async () => {
        const orgID = await createTestOrg();
        const tokenID = `token-${Date.now()}-${Math.random()}`;
        await createTestToken(orgID, tokenID);

        // Revoke once
        await ctx.commands.revokeOAuthToken(
          ctx.createContext(),
          tokenID,
          orgID
        );

        // Try to revoke again
        await expect(
          ctx.commands.revokeOAuthToken(
            ctx.createContext(),
            tokenID,
            orgID
          )
        ).rejects.toThrow(/token already revoked/);
      });
    });
  });

  describe('introspectOAuthToken', () => {
    describe('Success Cases', () => {
      it('should introspect active access token', async () => {
        const orgID = await createTestOrg();
        const tokenID = `token-${Date.now()}-${Math.random()}`;
        await createTestToken(orgID, tokenID, 'access_token');

        const introspection = await ctx.commands.introspectOAuthToken(
          ctx.createContext(),
          tokenID,
          orgID
        );

        expect(introspection.active).toBe(true);
        expect(introspection.scope).toEqual(['openid', 'profile', 'email']);
        expect(introspection.clientID).toBe('test-client-123');
        expect(introspection.username).toBe('test-user-456');
        expect(introspection.tokenType).toBe('access_token');
        expect(introspection.sub).toBe('test-user-456');
        expect(introspection.aud).toEqual(['https://api.example.com']);
        expect(introspection.exp).toBeDefined();
        expect(introspection.iat).toBeDefined();
        expect(introspection.iss).toBe(ctx.createContext().instanceID);
        expect(introspection.jti).toBe(tokenID);
      });

      it('should introspect active refresh token', async () => {
        const orgID = await createTestOrg();
        const tokenID = `token-${Date.now()}-${Math.random()}`;
        await createTestToken(orgID, tokenID, 'refresh_token');

        const introspection = await ctx.commands.introspectOAuthToken(
          ctx.createContext(),
          tokenID,
          orgID
        );

        expect(introspection.active).toBe(true);
        expect(introspection.tokenType).toBe('refresh_token');
      });

      it('should return inactive for non-existent token', async () => {
        const orgID = await createTestOrg();

        const introspection = await ctx.commands.introspectOAuthToken(
          ctx.createContext(),
          'non-existent-token',
          orgID
        );

        expect(introspection.active).toBe(false);
        expect(introspection.scope).toBeUndefined();
        expect(introspection.clientID).toBeUndefined();
      });

      it('should return inactive for revoked token', async () => {
        const orgID = await createTestOrg();
        const tokenID = `token-${Date.now()}-${Math.random()}`;
        await createTestToken(orgID, tokenID);

        // Revoke the token
        await ctx.commands.revokeOAuthToken(
          ctx.createContext(),
          tokenID,
          orgID
        );

        // Introspect
        const introspection = await ctx.commands.introspectOAuthToken(
          ctx.createContext(),
          tokenID,
          orgID
        );

        expect(introspection.active).toBe(false);
      });

      it('should return inactive for expired token', async () => {
        const orgID = await createTestOrg();
        const tokenID = `token-${Date.now()}-${Math.random()}`;

        // Create token with past expiry
        const command: Command = {
          instanceID: ctx.createContext().instanceID,
          eventType: 'oauth.token.added',
          aggregateType: 'oauth_token',
          aggregateID: tokenID,
          owner: orgID,
          creator: 'system',
          payload: {
            tokenType: 'access_token',
            clientID: 'test-client',
            userID: 'test-user',
            scope: ['openid'],
            audience: [],
            issuedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (expired)
          },
        };
        await ctx.eventstore.push(command);

        // Introspect
        const introspection = await ctx.commands.introspectOAuthToken(
          ctx.createContext(),
          tokenID,
          orgID
        );

        expect(introspection.active).toBe(false);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty tokenID', async () => {
        const orgID = await createTestOrg();

        await expect(
          ctx.commands.introspectOAuthToken(
            ctx.createContext(),
            '',
            orgID
          )
        ).rejects.toThrow(/tokenID is required/);
      });

      it('should fail with empty orgID', async () => {
        await expect(
          ctx.commands.introspectOAuthToken(
            ctx.createContext(),
            'some-token',
            ''
          )
        ).rejects.toThrow(/orgID is required/);
      });
    });
  });

  describe('Lifecycle Tests', () => {
    it('complete token lifecycle: create → introspect (active) → revoke → introspect (inactive)', async () => {
      const orgID = await createTestOrg();
      const tokenID = `token-${Date.now()}-${Math.random()}`;
      await createTestToken(orgID, tokenID);

      // 1. Introspect active token
      let introspection = await ctx.commands.introspectOAuthToken(
        ctx.createContext(),
        tokenID,
        orgID
      );
      expect(introspection.active).toBe(true);

      // 2. Revoke token
      await ctx.commands.revokeOAuthToken(
        ctx.createContext(),
        tokenID,
        orgID
      );

      // 3. Introspect revoked token
      introspection = await ctx.commands.introspectOAuthToken(
        ctx.createContext(),
        tokenID,
        orgID
      );
      expect(introspection.active).toBe(false);
    });

    it('multiple tokens lifecycle in same org', async () => {
      const orgID = await createTestOrg();
      const token1 = `token-${Date.now()}-${Math.random()}`;
      const token2 = `token-${Date.now()}-${Math.random()}`;
      const token3 = `token-${Date.now()}-${Math.random()}`;

      // Create multiple tokens
      await createTestToken(orgID, token1, 'access_token');
      await createTestToken(orgID, token2, 'refresh_token');
      await createTestToken(orgID, token3, 'access_token');

      // Verify all active
      expect((await ctx.commands.introspectOAuthToken(ctx.createContext(), token1, orgID)).active).toBe(true);
      expect((await ctx.commands.introspectOAuthToken(ctx.createContext(), token2, orgID)).active).toBe(true);
      expect((await ctx.commands.introspectOAuthToken(ctx.createContext(), token3, orgID)).active).toBe(true);

      // Revoke token2
      await ctx.commands.revokeOAuthToken(ctx.createContext(), token2, orgID);

      // Verify token2 inactive, others still active
      expect((await ctx.commands.introspectOAuthToken(ctx.createContext(), token1, orgID)).active).toBe(true);
      expect((await ctx.commands.introspectOAuthToken(ctx.createContext(), token2, orgID)).active).toBe(false);
      expect((await ctx.commands.introspectOAuthToken(ctx.createContext(), token3, orgID)).active).toBe(true);
    });

    it('RFC 7662 compliance: introspection returns proper fields', async () => {
      const orgID = await createTestOrg();
      const tokenID = `token-${Date.now()}-${Math.random()}`;
      await createTestToken(orgID, tokenID);

      const introspection = await ctx.commands.introspectOAuthToken(
        ctx.createContext(),
        tokenID,
        orgID
      );

      // RFC 7662 required fields for active tokens
      expect(introspection).toHaveProperty('active');
      expect(introspection.active).toBe(true);

      // RFC 7662 optional fields
      expect(introspection).toHaveProperty('scope');
      expect(introspection).toHaveProperty('clientID');
      expect(introspection).toHaveProperty('username');
      expect(introspection).toHaveProperty('tokenType');
      expect(introspection).toHaveProperty('exp');
      expect(introspection).toHaveProperty('iat');
      expect(introspection).toHaveProperty('sub');
      expect(introspection).toHaveProperty('aud');
      expect(introspection).toHaveProperty('iss');
      expect(introspection).toHaveProperty('jti');
    });
  });
});
