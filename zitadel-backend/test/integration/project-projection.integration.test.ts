/**
 * Project Projection Integration Tests
 * 
 * Tests end-to-end event → projection → query workflow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { DatabasePool } from '../../src/lib/database';
import { createTestDatabase, closeTestDatabase, cleanDatabase } from './setup';
import { DatabaseMigrator } from '../../src/lib/database/migrator';
import { PostgresEventstore } from '../../src/lib/eventstore';
import { ProjectionRegistry } from '../../src/lib/query/projection/projection-registry';
import { 
  createProjectProjection,
  createProjectProjectionConfig,
} from '../../src/lib/query/projections/project-projection';
import {
  createProjectRoleProjection,
  createProjectRoleProjectionConfig,
} from '../../src/lib/query/projections/project-role-projection';
import { ProjectQueries } from '../../src/lib/query/project/project-queries';
import { ProjectState } from '../../src/lib/query/project/project-types';
import { generateId as generateSnowflakeId } from '../../src/lib/id/snowflake';

describe('Project Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let projectQueries: ProjectQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register project projection
    const projectConfig = createProjectProjectionConfig();
    const projectProjection = createProjectProjection(eventstore, pool);
    registry.register(projectConfig, projectProjection);
    
    // Register project role projection
    const roleConfig = createProjectRoleProjectionConfig();
    const roleProjection = createProjectRoleProjection(eventstore, pool);
    registry.register(roleConfig, roleProjection);
    
    projectQueries = new ProjectQueries(pool);
  });

  afterEach(async () => {
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore
      }
    }
  });

  describe('Project Events', () => {
    it('should process project.added event', async () => {
      const projectID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { 
            name: 'Test Project',
            projectRoleAssertion: true,
            projectRoleCheck: false,
            hasProjectCheck: true,
          },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('project_projection'),
        registry.start('project_role_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const project = await projectQueries.getProjectByID(projectID);
      expect(project).toBeDefined();
      expect(project!.name).toBe('Test Project');
      expect(project!.state).toBe(ProjectState.ACTIVE);
      expect(project!.projectRoleAssertion).toBe(true);
      expect(project!.projectRoleCheck).toBe(false);
      expect(project!.hasProjectCheck).toBe(true);
      expect(project!.resourceOwner).toBe('org-123');
    }, 12000);

    it('should process project.changed event', async () => {
      const projectID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { name: 'Original Name' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.changed',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { name: 'Updated Name' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('project_projection'),
        registry.start('project_role_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const project = await projectQueries.getProjectByID(projectID);
      expect(project).toBeDefined();
      expect(project!.name).toBe('Updated Name');
    }, 12000);

    it('should process project.deactivated event', async () => {
      const projectID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { name: 'Test Project' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.deactivated',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: {},
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('project_projection'),
        registry.start('project_role_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const project = await projectQueries.getProjectByID(projectID);
      expect(project).toBeDefined();
      expect(project!.state).toBe(ProjectState.INACTIVE);
    }, 12000);

    it('should process project.reactivated event', async () => {
      const projectID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { name: 'Test Project' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.deactivated',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: {},
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.reactivated',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: {},
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('project_projection'),
        registry.start('project_role_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const project = await projectQueries.getProjectByID(projectID);
      expect(project).toBeDefined();
      expect(project!.state).toBe(ProjectState.ACTIVE);
    }, 12000);
  });

  describe('Project Role Events', () => {
    it('should process project.role.added event', async () => {
      const projectID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { name: 'Test Project' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.role.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { 
            roleKey: 'admin',
            displayName: 'Administrator',
            group: 'management',
          },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('project_projection'),
        registry.start('project_role_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const roles = await projectQueries.getProjectRoles(projectID);
      expect(roles).toHaveLength(1);
      expect(roles[0].roleKey).toBe('admin');
      expect(roles[0].displayName).toBe('Administrator');
      expect(roles[0].group).toBe('management');
    }, 12000);

    it('should process project.role.changed event', async () => {
      const projectID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { name: 'Test Project' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.role.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { 
            roleKey: 'admin',
            displayName: 'Admin',
          },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.role.changed',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { 
            roleKey: 'admin',
            displayName: 'Administrator',
          },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('project_projection'),
        registry.start('project_role_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const roles = await projectQueries.getProjectRoles(projectID);
      expect(roles).toHaveLength(1);
      expect(roles[0].displayName).toBe('Administrator');
    }, 12000);

    it('should process project.role.removed event', async () => {
      const projectID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { name: 'Test Project' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.role.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { 
            roleKey: 'admin',
            displayName: 'Administrator',
          },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.role.removed',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { roleKey: 'admin' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('project_projection'),
        registry.start('project_role_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const roles = await projectQueries.getProjectRoles(projectID);
      expect(roles).toHaveLength(0);
    }, 12000);
  });

  describe('Query Methods', () => {
    it('should get project with roles', async () => {
      const projectID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { name: 'Test Project' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.role.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { roleKey: 'admin', displayName: 'Administrator' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.role.added',
          aggregateType: 'project',
          aggregateID: projectID,
          payload: { roleKey: 'viewer', displayName: 'Viewer' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('project_projection'),
        registry.start('project_role_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result = await projectQueries.getProjectWithRoles(projectID);
      expect(result).toBeDefined();
      expect(result!.project.name).toBe('Test Project');
      expect(result!.roles).toHaveLength(2);
      expect(result!.roles.map(r => r.roleKey)).toContain('admin');
      expect(result!.roles.map(r => r.roleKey)).toContain('viewer');
    }, 12000);

    it('should search projects', async () => {
      const project1ID = generateSnowflakeId();
      const project2ID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: project1ID,
          payload: { name: 'Project Alpha' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
        {
          eventType: 'project.added',
          aggregateType: 'project',
          aggregateID: project2ID,
          payload: { name: 'Project Beta' },
          creator: 'system',
          owner: 'org-123',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('project_projection'),
        registry.start('project_role_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result = await projectQueries.searchProjects({ resourceOwner: 'org-123' });
      expect(result.projects.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    }, 12000);
  });
});
