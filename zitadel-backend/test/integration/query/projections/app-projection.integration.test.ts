/**
 * Application Projection Integration Tests
 * 
 * Tests end-to-end event → projection → query workflow for OIDC/SAML/API apps
 * ALL test data is loaded in beforeAll, tests only validate results
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { 
  createAppProjection,
  createAppProjectionConfig,
} from '../../../../src/lib/query/projections/app-projection';
import { AppQueries } from '../../../../src/lib/query/app/app-queries';
import { AppState, AppType } from '../../../../src/lib/query/app/app-types';
import { generateId as generateSnowflakeId } from '../../../../src/lib/id/snowflake';

describe('Application Projection Integration Tests', () => {
  let pool: DatabasePool;
  let appQueries: AppQueries;
  
  // Test data IDs - each test uses different data
  const testData = {
    oidcApp1: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      clientId: 'oidc-client-1',
      name: 'OIDC App 1',
    },
    oidcApp2: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      clientId: 'oidc-client-2',
      name: 'OIDC App 2',
    },
    samlApp1: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      entityId: 'https://saml-entity-1.com',
      name: 'SAML App 1',
    },
    samlApp2: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      entityId: 'https://saml-entity-2.com',
      name: 'SAML App 2',
    },
    apiApp1: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      clientId: 'api-client-1',
      name: 'API App 1',
    },
    apiApp2: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      clientId: 'api-client-2',
      name: 'API App 2',
    },
    deactivatedApp: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      clientId: 'deactivated-client',
      name: 'Deactivated App',
    },
    removedApp: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      clientId: 'removed-client',
      name: 'Removed App',
    },
    lookupApp: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      clientId: 'lookup-client',
      name: 'Lookup App',
    },
    existsApp: {
      projectID: generateSnowflakeId(),
      appID: generateSnowflakeId(),
      clientId: 'exists-client',
      name: 'Exists App',
    },
  };

  beforeAll(async () => {
    // Setup database and run migrations
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    const eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    const registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register and start projection
    const appProjection = createAppProjection(eventstore, pool);
    await appProjection.init();
    
    const appConfig = createAppProjectionConfig();
    appConfig.interval = 50;
    registry.register(appConfig, appProjection);
    await registry.start('app_projection');
    
    // Load ALL test data in beforeAll
    const events = [
      // OIDC App 1
      {
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: testData.oidcApp1.projectID,
        payload: {
          appId: testData.oidcApp1.appID,
          projectId: testData.oidcApp1.projectID,
          name: testData.oidcApp1.name,
          clientId: testData.oidcApp1.clientId,
          clientSecret: 'secret-1',
          redirectUris: ['https://example.com/callback1'],
          responseTypes: ['code'],
          grantTypes: ['authorization_code', 'refresh_token'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      // OIDC App 2
      {
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: testData.oidcApp2.projectID,
        payload: {
          appId: testData.oidcApp2.appID,
          projectId: testData.oidcApp2.projectID,
          name: testData.oidcApp2.name,
          clientId: testData.oidcApp2.clientId,
          redirectUris: ['https://example.com/callback2'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      // SAML App 1
      {
        eventType: 'project.application.saml.added',
        aggregateType: 'project',
        aggregateID: testData.samlApp1.projectID,
        payload: {
          appId: testData.samlApp1.appID,
          projectId: testData.samlApp1.projectID,
          name: testData.samlApp1.name,
          entityId: testData.samlApp1.entityId,
          acsUrls: ['https://saml1.com/acs'],
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      // SAML App 2
      {
        eventType: 'project.application.saml.added',
        aggregateType: 'project',
        aggregateID: testData.samlApp2.projectID,
        payload: {
          appId: testData.samlApp2.appID,
          projectId: testData.samlApp2.projectID,
          name: testData.samlApp2.name,
          entityId: testData.samlApp2.entityId,
          acsUrls: ['https://saml2.com/acs'],
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      // API App 1
      {
        eventType: 'project.application.api.added',
        aggregateType: 'project',
        aggregateID: testData.apiApp1.projectID,
        payload: {
          appId: testData.apiApp1.appID,
          projectId: testData.apiApp1.projectID,
          name: testData.apiApp1.name,
          clientId: testData.apiApp1.clientId,
          clientSecret: 'api-secret-1',
          authMethodType: 'private_key_jwt',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      // API App 2
      {
        eventType: 'project.application.api.added',
        aggregateType: 'project',
        aggregateID: testData.apiApp2.projectID,
        payload: {
          appId: testData.apiApp2.appID,
          projectId: testData.apiApp2.projectID,
          name: testData.apiApp2.name,
          clientId: testData.apiApp2.clientId,
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      // Deactivated App
      {
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: testData.deactivatedApp.projectID,
        payload: {
          appId: testData.deactivatedApp.appID,
          projectId: testData.deactivatedApp.projectID,
          name: testData.deactivatedApp.name,
          clientId: testData.deactivatedApp.clientId,
          redirectUris: ['https://example.com/callback'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      {
        eventType: 'project.application.deactivated',
        aggregateType: 'project',
        aggregateID: testData.deactivatedApp.projectID,
        payload: { appId: testData.deactivatedApp.appID },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      // Removed App
      {
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: testData.removedApp.projectID,
        payload: {
          appId: testData.removedApp.appID,
          projectId: testData.removedApp.projectID,
          name: testData.removedApp.name,
          clientId: testData.removedApp.clientId,
          redirectUris: ['https://example.com/callback'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      {
        eventType: 'project.application.removed',
        aggregateType: 'project',
        aggregateID: testData.removedApp.projectID,
        payload: { appId: testData.removedApp.appID },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      // Lookup App
      {
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: testData.lookupApp.projectID,
        payload: {
          appId: testData.lookupApp.appID,
          projectId: testData.lookupApp.projectID,
          name: testData.lookupApp.name,
          clientId: testData.lookupApp.clientId,
          redirectUris: ['https://example.com/callback'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
      // Exists App
      {
        eventType: 'project.application.oidc.added',
        aggregateType: 'project',
        aggregateID: testData.existsApp.projectID,
        payload: {
          appId: testData.existsApp.appID,
          projectId: testData.existsApp.projectID,
          name: testData.existsApp.name,
          clientId: testData.existsApp.clientId,
          redirectUris: ['https://example.com/callback'],
          appType: 'web',
          authMethodType: 'basic',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      },
    ];
    
    // Push all events
    for (const event of events) {
      await eventstore.push(event);
    }
    
    // Wait for projections to process all events (longer wait for many events)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Initialize queries
    appQueries = new AppQueries(pool);
    
    // Stop registry but keep data
    for (const name of registry.getNames()) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore
      }
    }
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('OIDC Application Events', () => {
    it('should process project.application.oidc.added event', async () => {
      const app = await appQueries.getAppByID(testData.oidcApp1.appID, 'test-instance');
      
      expect(app).toBeTruthy();
      expect(app!.name).toBe(testData.oidcApp1.name);
      expect(app!.type).toBe(AppType.OIDC);
      expect(app!.state).toBe(AppState.ACTIVE);
      
      const oidcApp = app as any;
      expect(oidcApp.config.clientId).toBe(testData.oidcApp1.clientId);
      expect(oidcApp.config.redirectUris).toContain('https://example.com/callback1');
    });

    it('should get OIDC app by client ID', async () => {
      const app = await appQueries.getOIDCAppByClientID(testData.oidcApp2.clientId, 'test-instance');
      
      expect(app).toBeTruthy();
      expect(app!.config.clientId).toBe(testData.oidcApp2.clientId);
      expect(app!.type).toBe(AppType.OIDC);
    });
  });

  describe('SAML Application Events', () => {
    it('should process project.application.saml.added event', async () => {
      const app = await appQueries.getAppByID(testData.samlApp1.appID, 'test-instance');
      
      expect(app).toBeTruthy();
      expect(app!.type).toBe(AppType.SAML);
      expect(app!.name).toBe(testData.samlApp1.name);
      
      const samlApp = app as any;
      expect(samlApp.config.entityId).toBe(testData.samlApp1.entityId);
    });

    it('should get SAML app by entity ID', async () => {
      const app = await appQueries.getSAMLAppByEntityID(testData.samlApp2.entityId, 'test-instance');
      
      expect(app).toBeTruthy();
      expect(app!.config.entityId).toBe(testData.samlApp2.entityId);
      expect(app!.type).toBe(AppType.SAML);
    });
  });

  describe('API Application Events', () => {
    it('should process project.application.api.added event', async () => {
      const app = await appQueries.getAppByID(testData.apiApp1.appID, 'test-instance');
      
      expect(app).toBeTruthy();
      expect(app!.type).toBe(AppType.API);
      expect(app!.name).toBe(testData.apiApp1.name);
      
      const apiApp = app as any;
      expect(apiApp.config.clientId).toBe(testData.apiApp1.clientId);
      expect(apiApp.config.authMethodType).toBe('private_key_jwt');
    });

    it('should get API app by client ID', async () => {
      const app = await appQueries.getAPIAppByClientID(testData.apiApp2.clientId, 'test-instance');
      
      expect(app).toBeTruthy();
      expect(app!.config.clientId).toBe(testData.apiApp2.clientId);
      expect(app!.type).toBe(AppType.API);
    });
  });

  describe('Application State Management', () => {
    it('should process application deactivation', async () => {
      const app = await appQueries.getAppByID(testData.deactivatedApp.appID, 'test-instance');
      
      expect(app).toBeTruthy();
      expect(app!.state).toBe(AppState.INACTIVE);
    });

    it('should process application removal', async () => {
      const app = await appQueries.getAppByID(testData.removedApp.appID, 'test-instance');
      
      expect(app).toBeNull();
    });
  });

  describe('Search and Lookup Methods', () => {
    it('should get project by client ID', async () => {
      const foundProjectId = await appQueries.getProjectByClientID(testData.lookupApp.clientId, 'test-instance');
      
      expect(foundProjectId).toBe(testData.lookupApp.projectID);
    });

    it('should check if app exists', async () => {
      const exists = await appQueries.existsApp(testData.existsApp.appID, 'test-instance');
      const notExists = await appQueries.existsApp('nonexistent-id', 'test-instance');
      
      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });
  });
});
