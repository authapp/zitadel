/**
 * Integration tests for IDP Projections
 * Tests all 4 IDP projections with real database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { IDPProjection, createIDPProjectionConfig } from '../../../src/lib/query/projections/idp-projection';
import { IDPTemplateProjection, createIDPTemplateProjectionConfig } from '../../../src/lib/query/projections/idp-template-projection';
import { IDPUserLinkProjection, createIDPUserLinkProjectionConfig } from '../../../src/lib/query/projections/idp-user-link-projection';
import { IDPLoginPolicyLinkProjection, createIDPLoginPolicyLinkProjectionConfig } from '../../../src/lib/query/projections/idp-login-policy-link-projection';
import { IDPQueries } from '../../../src/lib/query/idp/idp-queries';
import { IDPType } from '../../../src/lib/query/idp/idp-types';
import { generateId } from '../../../src/lib/id';

describe('IDP Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let idpQueries: IDPQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register all 4 IDP projections
    const idpConfig = createIDPProjectionConfig();
    idpConfig.interval = 50; // Optimized: 50ms for faster projection detection
    registry.register(idpConfig, new IDPProjection(eventstore, pool));

    const templateConfig = createIDPTemplateProjectionConfig();
    templateConfig.interval = 50; // Optimized: 50ms for faster projection detection
    registry.register(templateConfig, new IDPTemplateProjection(eventstore, pool));

    const userLinkConfig = createIDPUserLinkProjectionConfig();
    userLinkConfig.interval = 50; // Optimized: 50ms for faster projection detection
    registry.register(userLinkConfig, new IDPUserLinkProjection(eventstore, pool));

    const policyLinkConfig = createIDPLoginPolicyLinkProjectionConfig();
    policyLinkConfig.interval = 50; // Optimized: 50ms for faster projection detection
    registry.register(policyLinkConfig, new IDPLoginPolicyLinkProjection(eventstore, pool));
    
    // Start all projections
    await registry.start('idp_projection');
    await registry.start('idp_template_projection');
    await registry.start('idp_user_link_projection');
    await registry.start('idp_login_policy_link_projection');

    idpQueries = new IDPQueries(pool);
  });

  afterAll(async () => {
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

  const waitForProjection = (ms: number = 300) => // Optimized: 300ms sufficient for most projections
    new Promise(resolve => setTimeout(resolve, ms));

  describe('IDP Projection', () => {
    it('should process idp.oidc.added event', async () => {
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'idp',
        aggregateID: idpID,
        eventType: 'idp.oidc.added',
        payload: {
          name: 'My OIDC Provider',
          issuer: 'https://accounts.google.com',
          clientID: 'client-123',
          scopes: ['openid', 'profile', 'email'],
          isCreationAllowed: true,
          isLinkingAllowed: true,
        },
        creator: 'admin',
        owner: 'org-123',
      });

      await waitForProjection();

      const idp = await idpQueries.getIDPByID(idpID, instanceID);
      
      expect(idp).toBeTruthy();
      expect(idp!.id).toBe(idpID);
      expect(idp!.name).toBe('My OIDC Provider');
      expect(idp!.type).toBe(IDPType.OIDC);
    });

    it('should process idp.google.added event', async () => {
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'idp',
        aggregateID: idpID,
        eventType: 'idp.google.added',
        payload: {
          name: 'Google',
          clientID: 'google-client-123',
          scopes: ['openid', 'profile', 'email'],
        },
        creator: 'admin',
        owner: 'org-123',
      });

      await waitForProjection();

      const idp = await idpQueries.getIDPByID(idpID, instanceID);
      
      expect(idp).toBeTruthy();
      expect(idp!.type).toBe(IDPType.GOOGLE);
      expect(idp!.name).toBe('Google');
    });

    it('should update IDP on changed event', async () => {
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      // Add IDP
      await eventstore.push({
        instanceID,
        aggregateType: 'idp',
        aggregateID: idpID,
        eventType: 'idp.azure.added',
        payload: {
          name: 'Azure AD',
          clientID: 'azure-client',
          tenant: 'my-tenant',
        },
        creator: 'admin',
        owner: 'org-123',
      });

      await waitForProjection();

      // Change IDP
      await eventstore.push({
        instanceID,
        aggregateType: 'idp',
        aggregateID: idpID,
        eventType: 'idp.azure.changed',
        payload: {
          name: 'Azure AD Updated',
          isAutoCreation: true,
        },
        creator: 'admin',
        owner: 'org-123',
      });

      await waitForProjection();

      const idp = await idpQueries.getIDPByID(idpID, instanceID);
      
      expect(idp).toBeTruthy();
      expect(idp!.name).toBe('Azure AD Updated');
      expect(idp!.isAutoCreation).toBe(true);
    });

    it('should delete IDP on removed event', async () => {
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      // Add IDP
      await eventstore.push({
        instanceID,
        aggregateType: 'idp',
        aggregateID: idpID,
        eventType: 'idp.oauth.added',
        payload: {
          name: 'Custom OAuth',
          clientID: 'oauth-client',
          authorizationEndpoint: 'https://example.com/auth',
          tokenEndpoint: 'https://example.com/token',
          userEndpoint: 'https://example.com/user',
        },
        creator: 'admin',
        owner: 'org-123',
      });

      await waitForProjection();

      let idp = await idpQueries.getIDPByID(idpID, instanceID);
      expect(idp).toBeTruthy();

      // Remove IDP
      await eventstore.push({
        instanceID,
        aggregateType: 'idp',
        aggregateID: idpID,
        eventType: 'idp.removed',
        payload: {},
        creator: 'admin',
        owner: 'org-123',
      });

      await waitForProjection();

      idp = await idpQueries.getIDPByID(idpID, instanceID);
      expect(idp).toBeNull();
    });
  });

  describe('IDP Template Projection', () => {
    it('should process org IDP template added', async () => {
      const idpID = generateId();
      const orgID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.idp.added',
        payload: {
          idpID,
          name: 'Org OIDC Template',
          type: IDPType.OIDC,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const template = await idpQueries.getIDPTemplate(idpID, instanceID);
      
      expect(template).toBeTruthy();
      expect(template!.name).toBe('Org OIDC Template');
      expect(template!.ownerType).toBe('org');
    });

    it('should process instance IDP template added', async () => {
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.idp.added',
        payload: {
          idpID,
          name: 'Instance Google Template',
          type: IDPType.GOOGLE,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const template = await idpQueries.getIDPTemplate(idpID, instanceID);
      
      expect(template).toBeTruthy();
      expect(template!.ownerType).toBe('instance');
    });
  });

  describe('IDP User Link Projection', () => {
    it('should process user IDP link added', async () => {
      const userID = generateId();
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.idp.link.added',
        payload: {
          idpID,
          idpName: 'Google',
          providedUserID: 'google-user-123',
          providedUserName: 'user@example.com',
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      const link = await idpQueries.getUserIDPLink(userID, idpID, instanceID);
      
      expect(link).toBeTruthy();
      expect(link!.userID).toBe(userID);
      expect(link!.idpID).toBe(idpID);
      expect(link!.providedUserID).toBe('google-user-123');
    });

    it('should remove user IDP link', async () => {
      const userID = generateId();
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      // Add link
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.idp.link.added',
        payload: {
          idpID,
          idpName: 'Azure',
          providedUserID: 'azure-user-456',
          providedUserName: 'user@company.com',
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      let link = await idpQueries.getUserIDPLink(userID, idpID, instanceID);
      expect(link).toBeTruthy();

      // Remove link
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.idp.link.removed',
        payload: {
          idpID,
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      link = await idpQueries.getUserIDPLink(userID, idpID, instanceID);
      expect(link).toBeNull();
    });

    it('should remove all links when user is removed', async () => {
      const userID = generateId();
      const idpID1 = generateId();
      const idpID2 = generateId();
      const instanceID = 'test-instance';
      
      // Add two links
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.idp.link.added',
        payload: {
          idpID: idpID1,
          idpName: 'Google',
          providedUserID: 'google-123',
          providedUserName: 'user@example.com',
        },
        creator: userID,
        owner: 'org-123',
      });

      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.idp.link.added',
        payload: {
          idpID: idpID2,
          idpName: 'Azure',
          providedUserID: 'azure-456',
          providedUserName: 'user@company.com',
        },
        creator: userID,
        owner: 'org-123',
      });

      await waitForProjection();

      const linksBefore = await idpQueries.searchUserIDPLinks({ userID, instanceID });
      expect(linksBefore.total).toBeGreaterThanOrEqual(2);

      // Remove user
      await eventstore.push({
        instanceID,
        aggregateType: 'user',
        aggregateID: userID,
        eventType: 'user.removed',
        payload: {},
        creator: 'admin',
        owner: 'org-123',
      });

      await waitForProjection();

      const linksAfter = await idpQueries.searchUserIDPLinks({ userID, instanceID });
      expect(linksAfter.total).toBe(0);
    });
  });

  describe('IDP Login Policy Link Projection', () => {
    it('should process org login policy IDP link added', async () => {
      const orgID = generateId();
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.idp.config.added',
        payload: {
          idpID,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const link = await idpQueries.getLoginPolicyIDPLink(idpID, orgID, instanceID);
      
      expect(link).toBeTruthy();
      expect(link!.idpID).toBe(idpID);
      expect(link!.resourceOwner).toBe(orgID);
      expect(link!.ownerType).toBe('org');
    });

    it('should process instance login policy IDP link added', async () => {
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.idp.config.added',
        payload: {
          idpID,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const link = await idpQueries.getLoginPolicyIDPLink(idpID, instanceID, instanceID);
      
      expect(link).toBeTruthy();
      expect(link!.ownerType).toBe('instance');
    });

    it('should remove login policy IDP link', async () => {
      const orgID = generateId();
      const idpID = generateId();
      const instanceID = 'test-instance';
      
      // Add link
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.idp.config.added',
        payload: {
          idpID,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      let link = await idpQueries.getLoginPolicyIDPLink(idpID, orgID, instanceID);
      expect(link).toBeTruthy();

      // Remove link
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.idp.config.removed',
        payload: {
          idpID,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      link = await idpQueries.getLoginPolicyIDPLink(idpID, orgID, instanceID);
      expect(link).toBeNull();
    });
  });

  describe('Search Operations', () => {
    it('should search IDPs by type', async () => {
      const googleID = generateId();
      const azureID = generateId();
      const instanceID = 'test-instance';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'idp',
        aggregateID: googleID,
        eventType: 'idp.google.added',
        payload: {
          name: 'Google Search Test',
          clientID: 'google-123',
        },
        creator: 'admin',
        owner: 'org-search',
      });

      await eventstore.push({
        instanceID,
        aggregateType: 'idp',
        aggregateID: azureID,
        eventType: 'idp.azure.added',
        payload: {
          name: 'Azure Search Test',
          clientID: 'azure-123',
          tenant: 'test-tenant',
        },
        creator: 'admin',
        owner: 'org-search',
      });

      await waitForProjection();

      const googleResults = await idpQueries.searchIDPs({
        type: IDPType.GOOGLE,
        instanceID,
      });

      expect(googleResults.idps.some(idp => idp.id === googleID)).toBe(true);
    });
  });
});
