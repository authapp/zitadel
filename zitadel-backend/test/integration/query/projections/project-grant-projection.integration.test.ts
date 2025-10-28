/**
 * Integration tests for ProjectGrantProjection
 * Tests real database interactions with project grant events
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database';
import { ProjectGrantProjection } from '../../../../src/lib/query/projections/project-grant-projection';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { Event } from '../../../../src/lib/eventstore/types';
import { State } from '../../../../src/lib/query/converters/state-converter';

describe('ProjectGrantProjection Integration', () => {
  let database: DatabasePool;
  let projection: ProjectGrantProjection;
  let eventstore: PostgresEventstore;

  beforeAll(async () => {
    database = await createTestDatabase();
    
    // Create real eventstore
    eventstore = new PostgresEventstore(database, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    projection = new ProjectGrantProjection(eventstore, database);
    await projection.init();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean up projection data before each test
    await database.query('TRUNCATE TABLE projections.project_grants CASCADE');
  });

  describe('handleGrantAdded', () => {
    it('should create project grant on project.grant.added', async () => {
      const event: Event = {
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-1',
          projectID: 'proj-789',
          grantedOrgID: 'org-456',
          roleKeys: ['admin', 'viewer'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      };

      await projection.reduce(event);

      const result = await database.queryOne(
        'SELECT * FROM projections.project_grants WHERE id = $1 AND instance_id = $2',
        ['grant-1', 'inst-123']
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe('grant-1');
      expect(result!.project_id).toBe('proj-789');
      expect(result!.granted_org_id).toBe('org-456');
      expect(result!.state).toBe(State.ACTIVE);
      expect(result!.granted_roles).toEqual(['admin', 'viewer']);
    });

    it('should handle grant with empty roles', async () => {
      const event: Event = {
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-1',
          projectID: 'proj-789',
          grantedOrgID: 'org-456',
          roleKeys: [],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      };

      await projection.reduce(event);

      const result = await database.queryOne(
        'SELECT * FROM projections.project_grants WHERE id = $1',
        ['grant-1']
      );

      expect(result!.granted_roles).toEqual([]);
    });
  });

  describe('handleGrantChanged', () => {
    it('should update grant roles on project.grant.changed', async () => {
      // First add a grant
      const addEvent: Event = {
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-1',
          projectID: 'proj-789',
          grantedOrgID: 'org-456',
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
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.changed',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {
          grantID: 'grant-1',
          roleKeys: ['admin', 'viewer', 'editor'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      };

      await projection.reduce(changeEvent);

      const result = await database.queryOne(
        'SELECT * FROM projections.project_grants WHERE id = $1',
        ['grant-1']
      );

      expect(result!.granted_roles).toEqual(['admin', 'viewer', 'editor']);
      expect(Number(result!.sequence)).toBe(2);
    });
  });

  describe('handleGrantDeactivated', () => {
    it('should set state to inactive on project.grant.deactivated', async () => {
      // Add grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-1',
          projectID: 'proj-789',
          grantedOrgID: 'org-456',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      // Deactivate grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.deactivated',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {
          grantID: 'grant-1',
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      const result = await database.queryOne(
        'SELECT * FROM projections.project_grants WHERE id = $1',
        ['grant-1']
      );

      expect(result!.state).toBe(State.INACTIVE);
    });
  });

  describe('handleGrantReactivated', () => {
    it('should set state to active on project.grant.reactivated', async () => {
      // Add and deactivate grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-1',
          projectID: 'proj-789',
          grantedOrgID: 'org-456',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.deactivated',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: { grantID: 'grant-1' },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      // Reactivate grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.reactivated',
        aggregateVersion: BigInt(3),
        revision: 1,
        createdAt: new Date('2024-01-03'),
        payload: { grantID: 'grant-1' },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 3, inTxOrder: 0 },
      });

      const result = await database.queryOne(
        'SELECT * FROM projections.project_grants WHERE id = $1',
        ['grant-1']
      );

      expect(result!.state).toBe(State.ACTIVE);
    });
  });

  describe('handleGrantRemoved', () => {
    it('should delete grant on project.grant.removed', async () => {
      // Add grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-1',
          projectID: 'proj-789',
          grantedOrgID: 'org-456',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      // Remove grant
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.removed',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: { grantID: 'grant-1' },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      const result = await database.queryOne(
        'SELECT * FROM projections.project_grants WHERE id = $1',
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
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-1',
          projectID: 'proj-789',
          grantedOrgID: 'org-456',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-2',
          projectID: 'proj-789',
          grantedOrgID: 'org-999',
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
        aggregateVersion: BigInt(3),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {},
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 3, inTxOrder: 0 },
      });

      const result = await database.query(
        'SELECT * FROM projections.project_grants WHERE project_id = $1',
        ['proj-789']
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('handleOrgRemoved', () => {
    it('should cascade delete all grants for granted org', async () => {
      // Add multiple grants for same granted org
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-789',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-1',
          projectID: 'proj-789',
          grantedOrgID: 'org-456',
          roleKeys: ['admin'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-888',
        eventType: 'project.grant.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          grantID: 'grant-2',
          projectID: 'proj-888',
          grantedOrgID: 'org-456',
          roleKeys: ['viewer'],
        },
        creator: 'admin@example.com',
        owner: 'org-999',
        position: { position: 2, inTxOrder: 0 },
      });

      // Remove granted organization
      await projection.reduce({
        instanceID: 'inst-123',
        aggregateType: 'org',
        aggregateID: 'org-456',
        eventType: 'org.removed',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {},
        creator: 'admin@example.com',
        owner: 'org-456',
        position: { position: 3, inTxOrder: 0 },
      });

      const result = await database.query(
        'SELECT * FROM projections.project_grants WHERE granted_org_id = $1',
        ['org-456']
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
          AND tablename = 'project_grants'
      `);

      const indexNames = indexes.rows.map((row: any) => row.indexname);
      
      expect(indexNames).toContain('project_grants_project_id_idx');
      expect(indexNames).toContain('project_grants_granted_org_id_idx');
      expect(indexNames).toContain('project_grants_resource_owner_idx');
      expect(indexNames).toContain('project_grants_state_idx');
    });
  });
});
