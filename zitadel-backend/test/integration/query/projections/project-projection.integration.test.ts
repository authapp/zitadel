/**
 * Project Projection Integration Tests
 * 
 * Tests end-to-end event → projection → query workflow
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { 
  createProjectProjection,
  createProjectProjectionConfig,
} from '../../../../src/lib/query/projections/project-projection';
import {
  createProjectRoleProjection,
  createProjectRoleProjectionConfig,
} from '../../../../src/lib/query/projections/project-role-projection';
import { ProjectQueries } from '../../../../src/lib/query/project/project-queries';
import { ProjectState } from '../../../../src/lib/query/project/project-types';
import { generateId as generateSnowflakeId } from '../../../../src/lib/id/snowflake';

describe('Project Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let projectQueries: ProjectQueries;

  beforeAll(async () => {
    // Setup database and run migrations (automatically provides clean state)
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    // Create eventstore
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    // Create projection registry
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register project projection with fast polling
    const projectConfig = createProjectProjectionConfig();
    projectConfig.interval = 50; // Fast polling for tests
    const projectProjection = createProjectProjection(eventstore, pool);
    registry.register(projectConfig, projectProjection);
    
    // Register project role projection with fast polling
    const roleConfig = createProjectRoleProjectionConfig();
    roleConfig.interval = 50; // Fast polling for tests
    const roleProjection = createProjectRoleProjection(eventstore, pool);
    registry.register(roleConfig, roleProjection);
    
    // Start projections once for all tests
    await Promise.all([
      registry.start('project_projection'),
      registry.start('project_role_projection'),
    ]);
    
    projectQueries = new ProjectQueries(pool);
  });

  afterAll(async () => {
    // Stop projections
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore
      }
    }
    
    await closeTestDatabase();
  });

  // Helper to wait for projection to process (fast with 100ms polling)
  const waitForProjection = (ms: number = 300) => 
    new Promise(resolve => setTimeout(resolve, ms));

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
      
      await waitForProjection();
      
      const project = await projectQueries.getProjectByID(projectID);
      expect(project).toBeDefined();
      expect(project!.name).toBe('Test Project');
      expect(project!.state).toBe(ProjectState.ACTIVE);
      expect(project!.projectRoleAssertion).toBe(true);
      expect(project!.projectRoleCheck).toBe(false);
      expect(project!.hasProjectCheck).toBe(true);
      expect(project!.resourceOwner).toBe('org-123');
    }, 5000);

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
      
      await waitForProjection();
      
      const project = await projectQueries.getProjectByID(projectID);
      expect(project).toBeDefined();
      expect(project!.name).toBe('Updated Name');
    }, 5000);

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
      
      await waitForProjection();
      
      const project = await projectQueries.getProjectByID(projectID);
      expect(project).toBeDefined();
      expect(project!.state).toBe(ProjectState.INACTIVE);
    }, 5000);

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
      
      await waitForProjection();
      
      const project = await projectQueries.getProjectByID(projectID);
      expect(project).toBeDefined();
      expect(project!.state).toBe(ProjectState.ACTIVE);
    }, 5000);
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
      
      await waitForProjection();
      
      const roles = await projectQueries.getProjectRoles(projectID);
      expect(roles).toHaveLength(1);
      expect(roles[0].roleKey).toBe('admin');
      expect(roles[0].displayName).toBe('Administrator');
      expect(roles[0].group).toBe('management');
    }, 5000);

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
      
      await waitForProjection();
      
      const roles = await projectQueries.getProjectRoles(projectID);
      expect(roles).toHaveLength(1);
      expect(roles[0].displayName).toBe('Administrator');
    }, 5000);

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
      
      await waitForProjection();
      
      const roles = await projectQueries.getProjectRoles(projectID);
      expect(roles).toHaveLength(0);
    }, 5000);
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
      
      await waitForProjection();
      
      const result = await projectQueries.getProjectWithRoles(projectID);
      expect(result).toBeDefined();
      expect(result!.project.name).toBe('Test Project');
      expect(result!.roles).toHaveLength(2);
      expect(result!.roles.map(r => r.roleKey)).toContain('admin');
      expect(result!.roles.map(r => r.roleKey)).toContain('viewer');
    }, 5000);

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
      
      await waitForProjection();
      
      const result = await projectQueries.searchProjects({ resourceOwner: 'org-123' });
      expect(result.projects.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    }, 5000);
  });
});
