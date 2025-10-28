/**
 * Integration tests for UserGrantProjection
 * Tests real database interactions with user grant events
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database';
import { UserGrantProjection } from '../../../../src/lib/query/projections/user-grant-projection';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { Event } from '../../../../src/lib/eventstore/types';
import { State } from '../../../../src/lib/query/converters/state-converter';

describe('UserGrantProjection Integration', () => {
  let database: DatabasePool;
  let projection: UserGrantProjection;
  let eventstore: PostgresEventstore;

  beforeAll(async () => {
    database = await createTestDatabase();
    
    // Create real eventstore
    eventstore = new PostgresEventstore(database, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    projection = new UserGrantProjection(eventstore, database);
    await projection.init();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean up projection data before each test
    await database.query('TRUNCATE TABLE projections.user_grants CASCADE');
  });

  describe('handleGrantAdded', () => {
    it('should create user grant on user.grant.added', async () => {
      const event: Event = {
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-1',
          userID: 'user-456',
          projectID: 'proj-789',
          roleKeys: ['admin', 'viewer'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      };

      await projection.reduce(event);

      const result = await database.queryOne(
        'SELECT * FROM projections.user_grants WHERE id = $1 AND instance_id = $2',
        ['grant-1', 'inst-123']
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe('grant-1');
      expect(result!.user_id).toBe('user-456');
      expect(result!.project_id).toBe('proj-789');
      expect(result!.state).toBe(State.ACTIVE);
      expect(result!.roles).toEqual(['admin', 'viewer']);
    });

    it('should handle grant with project_grant_id', async () => {
      const event: Event = {
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-1',
          userID: 'user-456',
          projectID: 'proj-789',
          projectGrantID: 'pg-999',
          roleKeys: ['viewer'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      };

      await projection.reduce(event);

      const result = await database.queryOne(
        'SELECT * FROM projections.user_grants WHERE id = $1',
        ['grant-1']
      );

      expect(result!.project_grant_id).toBe('pg-999');
    });
  });

  describe('handleGrantChanged', () => {
    it('should update grant roles on user.grant.changed', async () => {
      // First add a grant
      const addEvent: Event = {
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-1',
          userID: 'user-456',
          projectID: 'proj-789',
          roleKeys: ['viewer'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      };

      await projection.reduce(addEvent);

      // Then change it
      const changeEvent: Event = {
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.changed',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {
          userGrantID: 'grant-1',
          roleKeys: ['admin', 'viewer', 'editor'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      };

      await projection.reduce(changeEvent);

      const result = await database.queryOne(
        'SELECT * FROM projections.user_grants WHERE id = $1',
        ['grant-1']
      );

      expect(result!.roles).toEqual(['admin', 'viewer', 'editor']);
      expect(Number(result!.sequence)).toBe(2);
    });
  });

  describe('handleGrantDeactivated', () => {
    it('should set state to inactive on user.grant.deactivated', async () => {
      // Add grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-1',
          userID: 'user-456',
          projectID: 'proj-789',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      // Deactivate grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.deactivated',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {
          userGrantID: 'grant-1',
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      const result = await database.queryOne(
        'SELECT * FROM projections.user_grants WHERE id = $1',
        ['grant-1']
      );

      expect(result!.state).toBe(State.INACTIVE);
    });
  });

  describe('handleGrantReactivated', () => {
    it('should set state to active on user.grant.reactivated', async () => {
      // Add and deactivate grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-1',
          userID: 'user-456',
          projectID: 'proj-789',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.deactivated',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: { userGrantID: 'grant-1' },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      // Reactivate grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.reactivated',
        aggregateVersion: BigInt(3),
        revision: 1,
        createdAt: new Date('2024-01-03'),
        payload: { userGrantID: 'grant-1' },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 3, inTxOrder: 0 },
      });

      const result = await database.queryOne(
        'SELECT * FROM projections.user_grants WHERE id = $1',
        ['grant-1']
      );

      expect(result!.state).toBe(State.ACTIVE);
    });
  });

  describe('handleGrantRemoved', () => {
    it('should delete grant on user.grant.removed', async () => {
      // Add grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-1',
          userID: 'user-456',
          projectID: 'proj-789',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      // Remove grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.removed',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: { userGrantID: 'grant-1' },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      const result = await database.queryOne(
        'SELECT * FROM projections.user_grants WHERE id = $1',
        ['grant-1']
      );

      expect(result).toBeNull();
    });
  });

  describe('handleProjectRemoved', () => {
    it('should cascade delete all grants for project', async () => {
      // Add multiple grants for same project
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-1',
          userID: 'user-1',
          projectID: 'proj-789',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-2',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-2',
          userID: 'user-2',
          projectID: 'proj-789',
          roleKeys: ['viewer'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      // Remove project
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.removed',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {},
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 3, inTxOrder: 0 },
      });

      const result = await database.query(
        'SELECT * FROM projections.user_grants WHERE project_id = $1',
        ['proj-789']
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('handleUserRemoved', () => {
    it('should cascade delete all grants for user', async () => {
      // Add multiple grants for same user
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-1',
          userID: 'user-456',
          projectID: 'proj-1',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.grant.added',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userGrantID: 'grant-2',
          userID: 'user-456',
          projectID: 'proj-2',
          roleKeys: ['viewer'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      // Remove user
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.removed',
        aggregateVersion: BigInt(3),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {},
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 3, inTxOrder: 0 },
      });

      const result = await database.query(
        'SELECT * FROM projections.user_grants WHERE user_id = $1',
        ['user-456']
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('table structure', () => {
    it('should have correct indexes', async () => {
      const indexes = await database.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'projections'
          AND tablename = 'user_grants'
      `);

      const indexNames = indexes.rows.map((row: any) => row.indexname);
      
      expect(indexNames).toContain('user_grants_user_id_idx');
      expect(indexNames).toContain('user_grants_project_id_idx');
      expect(indexNames).toContain('user_grants_resource_owner_idx');
      expect(indexNames).toContain('user_grants_state_idx');
    });
  });
});
