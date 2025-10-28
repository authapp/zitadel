/**
 * Personal Access Token Projection Integration Tests
 * 
 * Tests the full flow: events -> projection -> database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { PersonalAccessTokenProjection } from '../../../../src/lib/query/projections/personal-access-token-projection';
import { generateId as generateSnowflakeId } from '../../../../src/lib/id/snowflake';

describe('Personal Access Token Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;

  // Helper to create a test user
  async function createTestUser(userID: string, instanceID: string = 'test-instance'): Promise<void> {
    await pool.query(
      `INSERT INTO projections.users (id, instance_id, username, resource_owner, state, created_at, updated_at, change_date, sequence)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW(), 1)
       ON CONFLICT (instance_id, id) DO NOTHING`,
      [userID, instanceID, `user_${userID}`, instanceID, 'active']
    );
  }

  beforeAll(async () => {
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register PAT projection
    const projection = new PersonalAccessTokenProjection(eventstore, pool);
    await projection.init();
    
    registry.register({
      name: 'personal_access_token_projection',
      tables: ['projections.personal_access_tokens'],
      eventTypes: [
        'user.personal.access.token.added',
        'user.token.added',
        'user.personal.access.token.removed',
        'user.token.removed',
        'user.personal.access.token.used',
      ],
      aggregateTypes: ['user'],
      batchSize: 100,
      interval: 50,
      enableLocking: false,
    }, projection);
    
    await registry.start('personal_access_token_projection');
  });

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

  describe('PAT Events', () => {
    it('should process user.personal.access.token.added event', async () => {
      const userID = generateSnowflakeId();
      const tokenID = `pat_${generateSnowflakeId()}`;
      const tokenHash = 'hash_' + Math.random().toString(36);
      const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      await createTestUser(userID);
      
      await eventstore.push({
        eventType: 'user.personal.access.token.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
          tokenHash: tokenHash,
          scopes: ['openid', 'profile', 'email'],
          expirationDate: expirationDate,
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await pool.queryOne<{
        id: string;
        user_id: string;
        token_hash: string;
        scopes: string[];
        expiration_date: Date;
      }>(
        `SELECT id, user_id, token_hash, scopes, expiration_date 
         FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND user_id = $2`,
        ['test-instance', userID]
      );
      
      expect(result).toBeDefined();
      expect(result!.id).toBe(tokenID);
      expect(result!.user_id).toBe(userID);
      expect(result!.token_hash).toBe(tokenHash);
      expect(result!.scopes).toEqual(['openid', 'profile', 'email']);
      expect(result!.expiration_date).toBeDefined();
    }, 5000);

    it('should process user.token.added event (backward compatibility)', async () => {
      const userID = generateSnowflakeId();
      const tokenID = `pat_${generateSnowflakeId()}`;
      const tokenHash = 'hash_' + Math.random().toString(36);
      
      await createTestUser(userID);
      
      await eventstore.push({
        eventType: 'user.token.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
          tokenHash: tokenHash,
          scopes: ['read', 'write'],
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await pool.queryOne<{
        token_hash: string;
        scopes: string[];
      }>(
        `SELECT token_hash, scopes 
         FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', tokenID]
      );
      
      expect(result).toBeDefined();
      expect(result!.token_hash).toBe(tokenHash);
      expect(result!.scopes).toEqual(['read', 'write']);
    }, 5000);

    it('should process user.personal.access.token.removed event', async () => {
      const userID = generateSnowflakeId();
      const tokenID = `pat_${generateSnowflakeId()}`;
      const tokenHash = 'hash_' + Math.random().toString(36);
      
      await createTestUser(userID);
      
      // Add PAT first
      await eventstore.push({
        eventType: 'user.personal.access.token.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
          tokenHash: tokenHash,
          scopes: ['api'],
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify it was added
      let result = await pool.queryOne(
        `SELECT id FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', tokenID]
      );
      expect(result).toBeDefined();
      
      // Remove PAT
      await eventstore.push({
        eventType: 'user.personal.access.token.removed',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify it was deleted
      result = await pool.queryOne(
        `SELECT id FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', tokenID]
      );
      expect(result).toBeNull();
    }, 5000);

    it('should process user.personal.access.token.used event', async () => {
      const userID = generateSnowflakeId();
      const tokenID = `pat_${generateSnowflakeId()}`;
      const tokenHash = 'hash_' + Math.random().toString(36);
      
      await createTestUser(userID);
      
      // Add PAT first
      await eventstore.push({
        eventType: 'user.personal.access.token.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
          tokenHash: tokenHash,
          scopes: ['api'],
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify last_used is null initially
      let result = await pool.queryOne<{ last_used: Date | null }>(
        `SELECT last_used FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', tokenID]
      );
      expect(result!.last_used).toBeNull();
      
      // Use the PAT
      await eventstore.push({
        eventType: 'user.personal.access.token.used',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify last_used is now set
      result = await pool.queryOne<{ last_used: Date | null }>(
        `SELECT last_used FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND id = $2`,
        ['test-instance', tokenID]
      );
      expect(result!.last_used).toBeDefined();
      expect(result!.last_used).not.toBeNull();
    }, 5000);
  });

  describe('Query Scenarios', () => {
    it('should find PAT by token hash', async () => {
      const userID = generateSnowflakeId();
      const tokenID = `pat_${generateSnowflakeId()}`;
      const uniqueHash = 'unique_hash_' + Math.random().toString(36);
      
      await createTestUser(userID);
      
      await eventstore.push({
        eventType: 'user.personal.access.token.added',
        aggregateType: 'user',
        aggregateID: userID,
        payload: {
          id: tokenID,
          tokenHash: uniqueHash,
          scopes: ['read'],
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query by token hash (authentication scenario)
      const result = await pool.queryOne<{
        id: string;
        user_id: string;
        scopes: string[];
      }>(
        `SELECT id, user_id, scopes 
         FROM projections.personal_access_tokens 
         WHERE token_hash = $1`,
        [uniqueHash]
      );
      
      expect(result).toBeDefined();
      expect(result!.id).toBe(tokenID);
      expect(result!.user_id).toBe(userID);
    }, 5000);

    it('should list all PATs for a user', async () => {
      const userID = generateSnowflakeId();
      const token1ID = `pat_${generateSnowflakeId()}`;
      const token2ID = `pat_${generateSnowflakeId()}`;
      
      await createTestUser(userID);
      
      await eventstore.pushMany([
        {
          eventType: 'user.personal.access.token.added',
          aggregateType: 'user',
          aggregateID: userID,
          payload: {
            id: token1ID,
            tokenHash: 'hash1_' + Math.random().toString(36),
            scopes: ['read'],
          },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'user.personal.access.token.added',
          aggregateType: 'user',
          aggregateID: userID,
          payload: {
            id: token2ID,
            tokenHash: 'hash2_' + Math.random().toString(36),
            scopes: ['write'],
          },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const results = await pool.queryMany<{ id: string }>(
        `SELECT id FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND user_id = $2 
         ORDER BY created_at DESC`,
        ['test-instance', userID]
      );
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      const ids = results.map(r => r.id);
      expect(ids).toContain(token1ID);
      expect(ids).toContain(token2ID);
    }, 5000);

    it('should handle expired tokens query', async () => {
      const userID = generateSnowflakeId();
      const expiredTokenID = `pat_${generateSnowflakeId()}`;
      const activeTokenID = `pat_${generateSnowflakeId()}`;
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      await createTestUser(userID);
      
      await eventstore.pushMany([
        {
          eventType: 'user.personal.access.token.added',
          aggregateType: 'user',
          aggregateID: userID,
          payload: {
            id: expiredTokenID,
            tokenHash: 'expired_' + Math.random().toString(36),
            scopes: ['api'],
            expirationDate: pastDate,
          },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'user.personal.access.token.added',
          aggregateType: 'user',
          aggregateID: userID,
          payload: {
            id: activeTokenID,
            tokenHash: 'active_' + Math.random().toString(36),
            scopes: ['api'],
            expirationDate: futureDate,
          },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query for active (non-expired) tokens
      const activeTokens = await pool.queryMany<{ id: string }>(
        `SELECT id FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND user_id = $2 
         AND (expiration_date IS NULL OR expiration_date > NOW())`,
        ['test-instance', userID]
      );
      
      const activeIds = activeTokens.map(t => t.id);
      expect(activeIds).toContain(activeTokenID);
      expect(activeIds).not.toContain(expiredTokenID);
    }, 5000);
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate PATs by instance', async () => {
      const userID = generateSnowflakeId();
      const instance1TokenID = `pat_${generateSnowflakeId()}`;
      const instance2TokenID = `pat_${generateSnowflakeId()}`;
      
      await createTestUser(userID, 'test-instance');
      await createTestUser(userID, 'instance-2');
      
      await eventstore.pushMany([
        {
          eventType: 'user.personal.access.token.added',
          aggregateType: 'user',
          aggregateID: userID,
          payload: {
            id: instance1TokenID,
            tokenHash: 'inst1_' + Math.random().toString(36),
            scopes: ['api'],
          },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'user.personal.access.token.added',
          aggregateType: 'user',
          aggregateID: userID,
          payload: {
            id: instance2TokenID,
            tokenHash: 'inst2_' + Math.random().toString(36),
            scopes: ['api'],
          },
          creator: 'system',
          owner: 'instance-2',
          instanceID: 'instance-2',
        },
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query instance 1
      const instance1Tokens = await pool.queryMany<{ id: string }>(
        `SELECT id FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND user_id = $2`,
        ['test-instance', userID]
      );
      
      // Query instance 2
      const instance2Tokens = await pool.queryMany<{ id: string }>(
        `SELECT id FROM projections.personal_access_tokens 
         WHERE instance_id = $1 AND user_id = $2`,
        ['instance-2', userID]
      );
      
      expect(instance1Tokens.map(t => t.id)).toContain(instance1TokenID);
      expect(instance1Tokens.map(t => t.id)).not.toContain(instance2TokenID);
      expect(instance2Tokens.map(t => t.id)).toContain(instance2TokenID);
      expect(instance2Tokens.map(t => t.id)).not.toContain(instance1TokenID);
    }, 5000);
  });
});
