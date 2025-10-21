/**
 * Integration tests for all Member Projections
 * Tests real database interactions with member events across all scopes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { InstanceMemberProjection } from '../../../src/lib/query/projections/instance-member-projection';
import { OrgMemberProjection } from '../../../src/lib/query/projections/org-member-projection';
import { ProjectMemberProjection } from '../../../src/lib/query/projections/project-member-projection';
import { ProjectGrantMemberProjection } from '../../../src/lib/query/projections/project-grant-member-projection';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { Event } from '../../../src/lib/eventstore/types';

describe('Member Projections Integration', () => {
  let database: DatabasePool;
  let eventstore: PostgresEventstore;
  let instanceMemberProj: InstanceMemberProjection;
  let orgMemberProj: OrgMemberProjection;
  let projectMemberProj: ProjectMemberProjection;
  let projectGrantMemberProj: ProjectGrantMemberProjection;

  beforeAll(async () => {
    database = await createTestDatabase();
    
    eventstore = new PostgresEventstore(database, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    instanceMemberProj = new InstanceMemberProjection(eventstore, database);
    orgMemberProj = new OrgMemberProjection(eventstore, database);
    projectMemberProj = new ProjectMemberProjection(eventstore, database);
    projectGrantMemberProj = new ProjectGrantMemberProjection(eventstore, database);
    
    await instanceMemberProj.init();
    await orgMemberProj.init();
    await projectMemberProj.init();
    await projectGrantMemberProj.init();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean up projection data before each test
    await database.query('TRUNCATE TABLE projections.instance_members CASCADE');
    await database.query('TRUNCATE TABLE projections.org_members CASCADE');
    await database.query('TRUNCATE TABLE projections.project_members CASCADE');
    await database.query('TRUNCATE TABLE projections.project_grant_members CASCADE');
  });

  describe('InstanceMemberProjection', () => {
    it('should create instance member on instance.member.added', async () => {
      const event: Event = {
        instanceID: 'inst-123',
        aggregateType: 'instance',
        aggregateID: 'inst-123',
        eventType: 'instance.member.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userID: 'user-456',
          roles: ['IAM_OWNER', 'IAM_ADMIN'],
        },
        creator: 'system@example.com',
        owner: 'inst-123',
        position: { position: 1, inTxOrder: 0 },
      };

      await instanceMemberProj.reduce(event);

      const result = await database.queryOne(
        'SELECT * FROM projections.instance_members WHERE instance_id = $1 AND user_id = $2',
        ['inst-123', 'user-456']
      );

      expect(result).toBeDefined();
      expect(result!.user_id).toBe('user-456');
      expect(result!.roles).toEqual(['IAM_OWNER', 'IAM_ADMIN']);
    });

    it('should update instance member on instance.member.changed', async () => {
      // Add member
      await instanceMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'instance',
        aggregateID: 'inst-123',
        eventType: 'instance.member.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: { userID: 'user-456', roles: ['IAM_ADMIN'] },
        creator: 'system@example.com',
        owner: 'inst-123',
        position: { position: 1, inTxOrder: 0 },
      });

      // Change member
      await instanceMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'instance',
        aggregateID: 'inst-123',
        eventType: 'instance.member.changed',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: { userID: 'user-456', roles: ['IAM_OWNER', 'IAM_ADMIN'] },
        creator: 'system@example.com',
        owner: 'inst-123',
        position: { position: 2, inTxOrder: 0 },
      });

      const result = await database.queryOne(
        'SELECT * FROM projections.instance_members WHERE user_id = $1',
        ['user-456']
      );

      expect(result!.roles).toEqual(['IAM_OWNER', 'IAM_ADMIN']);
    });

    it('should delete instance member on user.removed', async () => {
      // Add member
      await instanceMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'instance',
        aggregateID: 'inst-123',
        eventType: 'instance.member.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: { userID: 'user-456', roles: ['IAM_ADMIN'] },
        creator: 'system@example.com',
        owner: 'inst-123',
        position: { position: 1, inTxOrder: 0 },
      });

      // Remove user
      await instanceMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'user',
        aggregateID: 'user-456',
        eventType: 'user.removed',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {},
        creator: 'system@example.com',
        owner: 'inst-123',
        position: { position: 2, inTxOrder: 0 },
      });

      const result = await database.queryOne(
        'SELECT * FROM projections.instance_members WHERE user_id = $1',
        ['user-456']
      );

      expect(result).toBeNull();
    });
  });

  describe('OrgMemberProjection', () => {
    it('should create org member on org.member.added', async () => {
      const event: Event = {
        instanceID: 'inst-123',
        aggregateType: 'org',
        aggregateID: 'org-789',
        eventType: 'org.member.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userID: 'user-456',
          roles: ['ORG_OWNER'],
        },
        creator: 'admin@example.com',
        owner: 'org-789',
        position: { position: 1, inTxOrder: 0 },
      };

      await orgMemberProj.reduce(event);

      const result = await database.queryOne(
        'SELECT * FROM projections.org_members WHERE org_id = $1 AND user_id = $2',
        ['org-789', 'user-456']
      );

      expect(result).toBeDefined();
      expect(result!.org_id).toBe('org-789');
      expect(result!.user_id).toBe('user-456');
      expect(result!.roles).toEqual(['ORG_OWNER']);
    });

    it('should cascade delete members on org.removed', async () => {
      // Add multiple members
      await orgMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'org',
        aggregateID: 'org-789',
        eventType: 'org.member.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: { userID: 'user-1', roles: ['ORG_OWNER'] },
        creator: 'admin@example.com',
        owner: 'org-789',
        position: { position: 1, inTxOrder: 0 },
      });

      await orgMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'org',
        aggregateID: 'org-789',
        eventType: 'org.member.added',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: { userID: 'user-2', roles: ['ORG_USER'] },
        creator: 'admin@example.com',
        owner: 'org-789',
        position: { position: 2, inTxOrder: 0 },
      });

      // Remove org
      await orgMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'org',
        aggregateID: 'org-789',
        eventType: 'org.removed',
        aggregateVersion: BigInt(3),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {},
        creator: 'admin@example.com',
        owner: 'org-789',
        position: { position: 3, inTxOrder: 0 },
      });

      const result = await database.query(
        'SELECT * FROM projections.org_members WHERE org_id = $1',
        ['org-789']
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('ProjectMemberProjection', () => {
    it('should create project member on project.member.added', async () => {
      const event: Event = {
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-999',
        eventType: 'project.member.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          userID: 'user-456',
          roles: ['PROJECT_OWNER'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      };

      await projectMemberProj.reduce(event);

      const result = await database.queryOne(
        'SELECT * FROM projections.project_members WHERE project_id = $1 AND user_id = $2',
        ['proj-999', 'user-456']
      );

      expect(result).toBeDefined();
      expect(result!.project_id).toBe('proj-999');
      expect(result!.user_id).toBe('user-456');
      expect(result!.roles).toEqual(['PROJECT_OWNER']);
    });

    it('should cascade delete members on project.removed', async () => {
      // Add member
      await projectMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-999',
        eventType: 'project.member.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: { userID: 'user-456', roles: ['PROJECT_OWNER'] },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      // Remove project
      await projectMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-999',
        eventType: 'project.removed',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: {},
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      const result = await database.query(
        'SELECT * FROM projections.project_members WHERE project_id = $1',
        ['proj-999']
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('ProjectGrantMemberProjection', () => {
    it('should create project grant member on project.grant.member.added', async () => {
      const event: Event = {
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-999',
        eventType: 'project.grant.member.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          projectID: 'proj-999',
          grantID: 'grant-111',
          userID: 'user-456',
          roles: ['PROJECT_GRANT_OWNER'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      };

      await projectGrantMemberProj.reduce(event);

      const result = await database.queryOne(
        'SELECT * FROM projections.project_grant_members WHERE grant_id = $1 AND user_id = $2',
        ['grant-111', 'user-456']
      );

      expect(result).toBeDefined();
      expect(result!.project_id).toBe('proj-999');
      expect(result!.grant_id).toBe('grant-111');
      expect(result!.user_id).toBe('user-456');
      expect(result!.roles).toEqual(['PROJECT_GRANT_OWNER']);
    });

    it('should cascade delete members on project.grant.removed', async () => {
      // Add member
      await projectGrantMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-999',
        eventType: 'project.grant.member.added',
        aggregateVersion: BigInt(1),
        revision: 1,
        createdAt: new Date('2024-01-01'),
        payload: {
          projectID: 'proj-999',
          grantID: 'grant-111',
          userID: 'user-456',
          roles: ['PROJECT_GRANT_OWNER'],
        },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 1, inTxOrder: 0 },
      });

      // Remove grant
      await projectGrantMemberProj.reduce({
        instanceID: 'inst-123',
        aggregateType: 'project',
        aggregateID: 'proj-999',
        eventType: 'project.grant.removed',
        aggregateVersion: BigInt(2),
        revision: 1,
        createdAt: new Date('2024-01-02'),
        payload: { grantID: 'grant-111' },
        creator: 'admin@example.com',
        owner: 'org-123',
        position: { position: 2, inTxOrder: 0 },
      });

      const result = await database.query(
        'SELECT * FROM projections.project_grant_members WHERE grant_id = $1',
        ['grant-111']
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Table Structures', () => {
    it('should have correct indexes for instance_members', async () => {
      const indexes = await database.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'projections'
          AND tablename = 'instance_members'
      `);

      const indexNames = indexes.rows.map((row: any) => row.indexname);
      
      expect(indexNames).toContain('instance_members_user_id_idx');
      expect(indexNames).toContain('instance_members_resource_owner_idx');
    });

    it('should have correct indexes for org_members', async () => {
      const indexes = await database.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'projections'
          AND tablename = 'org_members'
      `);

      const indexNames = indexes.rows.map((row: any) => row.indexname);
      
      expect(indexNames).toContain('org_members_org_id_idx');
      expect(indexNames).toContain('org_members_user_id_idx');
    });

    it('should have correct indexes for project_members', async () => {
      const indexes = await database.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'projections'
          AND tablename = 'project_members'
      `);

      const indexNames = indexes.rows.map((row: any) => row.indexname);
      
      expect(indexNames).toContain('project_members_project_id_idx');
      expect(indexNames).toContain('project_members_user_id_idx');
    });

    it('should have correct indexes for project_grant_members', async () => {
      const indexes = await database.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'projections'
          AND tablename = 'project_grant_members'
      `);

      const indexNames = indexes.rows.map((row: any) => row.indexname);
      
      expect(indexNames).toContain('project_grant_members_grant_id_idx');
      expect(indexNames).toContain('project_grant_members_user_id_idx');
    });
  });
});
