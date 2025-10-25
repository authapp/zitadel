/**
 * Application Projection Integration Tests
 * 
 * Tests end-to-end event → projection → query workflow for OIDC/SAML/API apps
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabaseMigrator } from '../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { 
  createAppProjection,
  createAppProjectionConfig,
} from '../../../src/lib/query/projections/app-projection';
import { AppQueries } from '../../../src/lib/query/app/app-queries';
import { AppState, AppType } from '../../../src/lib/query/app/app-types';
import { generateId as generateSnowflakeId } from '../../../src/lib/id/snowflake';

describe('Application Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let appQueries: AppQueries;

  beforeAll(async () => {
    // Setup database and run migrations (automatically provides clean state)
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
    
    // Register app projection with fast polling
    const appConfig = createAppProjectionConfig();
    appConfig.interval = 50; // Fast polling for tests
    const appProjection = createAppProjection(eventstore, pool);
    registry.register(appConfig, appProjection);
    
    // Start projection once for all tests
    await registry.start('app_projection');
    
    appQueries = new AppQueries(pool);
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

  describe('OIDC Application Events', () => {
    it('should process project.application.oidc.added event', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'My OIDC App',
          clientId: 'oidc-client-123',
          clientSecret: 'secret-456',
          redirectUris: ['https://example.com/callback'],
          responseTypes: ['code'],
          grantTypes: ['authorization_code', 'refresh_token'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const app = await appQueries.getAppByID(appID);
      
      expect(app).toBeTruthy();
      expect(app!.name).toBe('My OIDC App');
      expect(app!.type).toBe(AppType.OIDC);
      expect(app!.state).toBe(AppState.ACTIVE);
      
      const oidcApp = app as any;
      expect(oidcApp.config.clientId).toBe('oidc-client-123');
      expect(oidcApp.config.redirectUris).toContain('https://example.com/callback');
    }, 5000);

    it('should get OIDC app by client ID', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      const clientId = 'unique-client-' + generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'Test App',
          clientId: clientId,
          redirectUris: ['https://example.com/callback'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const app = await appQueries.getOIDCAppByClientID(clientId);
      
      expect(app).toBeTruthy();
      expect(app!.config.clientId).toBe(clientId);
      expect(app!.type).toBe(AppType.OIDC);
    }, 5000);
  });

  describe('SAML Application Events', () => {
    it('should process project.application.saml.added event', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.saml.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'SAML App',
          entityId: 'https://example.com/saml/entity',
          acsUrls: ['https://example.com/saml/acs'],
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const app = await appQueries.getAppByID(appID);
      
      expect(app).toBeTruthy();
      expect(app!.type).toBe(AppType.SAML);
      expect(app!.name).toBe('SAML App');
      
      const samlApp = app as any;
      expect(samlApp.config.entityId).toBe('https://example.com/saml/entity');
    }, 5000);

    it('should get SAML app by entity ID', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      const entityId = 'https://unique-entity-' + generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.saml.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'SAML Test',
          entityId: entityId,
          acsUrls: ['https://example.com/saml/acs'],
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const app = await appQueries.getSAMLAppByEntityID(entityId);
      
      expect(app).toBeTruthy();
      expect(app!.config.entityId).toBe(entityId);
      expect(app!.type).toBe(AppType.SAML);
    }, 5000);
  });

  describe('API Application Events', () => {
    it('should process project.application.api.added event', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.api.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'API App',
          clientId: 'api-client-123',
          clientSecret: 'api-secret-456',
          authMethodType: 'private_key_jwt',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const app = await appQueries.getAppByID(appID);
      
      expect(app).toBeTruthy();
      expect(app!.type).toBe(AppType.API);
      expect(app!.name).toBe('API App');
      
      const apiApp = app as any;
      expect(apiApp.config.clientId).toBe('api-client-123');
      expect(apiApp.config.authMethodType).toBe('private_key_jwt');
    }, 5000);

    it('should get API app by client ID', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      const clientId = 'api-client-' + generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.api.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'API Test',
          clientId: clientId,
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const app = await appQueries.getAPIAppByClientID(clientId);
      
      expect(app).toBeTruthy();
      expect(app!.config.clientId).toBe(clientId);
      expect(app!.type).toBe(AppType.API);
    }, 5000);
  });

  describe('Application State Management', () => {
    it('should process application deactivation', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      const clientId = 'deactivate-client-' + generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'Test App',
          clientId: clientId,
          redirectUris: ['https://example.com/callback'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await eventstore.push({
        eventType: 'project.application.deactivated',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: { appId: appID },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const app = await appQueries.getAppByID(appID);
      
      expect(app).toBeTruthy();
      expect(app!.state).toBe(AppState.INACTIVE);
    }, 5000);

    it('should process application removal', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      const clientId = 'remove-client-' + generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'Test App',
          clientId: clientId,
          redirectUris: ['https://example.com/callback'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await eventstore.push({
        eventType: 'project.application.removed',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: { appId: appID },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const app = await appQueries.getAppByID(appID);
      
      expect(app).toBeNull();
    }, 5000);
  });

  describe('Search and Lookup Methods', () => {
    it('should get project by client ID', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      const clientId = 'lookup-client-' + generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'Test App',
          clientId: clientId,
          redirectUris: ['https://example.com/callback'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const foundProjectId = await appQueries.getProjectByClientID(clientId);
      
      expect(foundProjectId).toBe(projectID);
    }, 5000);

    it('should check if app exists', async () => {
      const projectID = generateSnowflakeId();
      const appID = generateSnowflakeId();
      const clientId = 'exists-client-' + generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: projectID,
        payload: {
          appId: appID,
          projectId: projectID,
          name: 'Test App',
          clientId: clientId,
          redirectUris: ['https://example.com/callback'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });

      await waitForProjection();

      const exists = await appQueries.existsApp(appID);
      const notExists = await appQueries.existsApp('nonexistent-id');
      
      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    }, 5000);
  });
});
