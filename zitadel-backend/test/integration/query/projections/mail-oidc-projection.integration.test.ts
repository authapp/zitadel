/**
 * Integration tests for Mail & OIDC Projection
 * Tests mail templates and OIDC settings with real database and projections
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { MailOIDCProjection, createMailOIDCProjectionConfig } from '../../../../src/lib/query/projections/mail-oidc-projection';
import { MailTemplateQueries } from '../../../../src/lib/query/policy/mail-template-queries';
import { OIDCSettingsQueries } from '../../../../src/lib/query/policy/oidc-settings-queries';
import { generateId } from '../../../../src/lib/id';

describe('Mail & OIDC Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let mailTemplateQueries: MailTemplateQueries;
  let oidcSettingsQueries: OIDCSettingsQueries;

  const TEST_INSTANCE_ID = 'test-instance';

  beforeAll(async () => {
    pool = await createTestDatabase();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: TEST_INSTANCE_ID,
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register projection
    const projection = new MailOIDCProjection(eventstore, pool);
    await projection.init();
    
    const config = createMailOIDCProjectionConfig();
    config.interval = 50; // Optimized: 50ms for faster projection detection
    registry.register(config, projection);
    
    await registry.start('mail_oidc_projection');

    // Initialize query classes
    mailTemplateQueries = new MailTemplateQueries(pool);
    oidcSettingsQueries = new OIDCSettingsQueries(pool);
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

  describe('Mail Template', () => {
    it('should return built-in default when no templates exist', async () => {
      const template = await mailTemplateQueries.getDefaultMailTemplate(TEST_INSTANCE_ID);

      expect(template.aggregateID).toBe('built-in-default');
      expect(template.template).toContain('<!DOCTYPE html>');
      expect(template.template).toContain('{{.Title}}');
      expect(template.template).toContain('{{.Content}}');
      expect(template.isDefault).toBe(true);
    });

    it('should process instance.mail.template.added event', async () => {
      const instanceID = generateId();
      const customTemplate = '<html><body><h1>{{.Title}}</h1><p>{{.Content}}</p></body></html>';
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.mail.template.added',
        payload: {
          template: customTemplate,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const template = await mailTemplateQueries.getDefaultMailTemplate(instanceID);
      
      expect(template.aggregateID).toBe(instanceID);
      expect(template.template).toBe(customTemplate);
      expect(template.isDefault).toBe(true);
    });

    it('should retrieve org-specific template over instance default', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      
      // Instance template
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.mail.template.added',
        payload: {
          template: '<html><body>Instance Template</body></html>',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Org-specific template
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.mail.template.added',
        payload: {
          template: '<html><body>Org Custom Template</body></html>',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const template = await mailTemplateQueries.getMailTemplate(instanceID, orgID);
      
      expect(template.organizationID).toBe(orgID);
      expect(template.template).toBe('<html><body>Org Custom Template</body></html>');
      expect(template.isDefault).toBe(false);
    });

    it('should update mail template on changed event', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.mail.template.added',
        payload: {
          template: '<html><body>Original</body></html>',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Change template
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.mail.template.changed',
        payload: {
          template: '<html><body>Updated Template</body></html>',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const template = await mailTemplateQueries.getDefaultMailTemplate(instanceID);
      
      expect(template.template).toBe('<html><body>Updated Template</body></html>');
    });
  });

  describe('OIDC Settings', () => {
    it('should return built-in default when no settings exist', async () => {
      const settings = await oidcSettingsQueries.getOIDCSettings(TEST_INSTANCE_ID);

      expect(settings.aggregateID).toBe(TEST_INSTANCE_ID);
      expect(settings.accessTokenLifetime).toBe(43200); // 12 hours
      expect(settings.idTokenLifetime).toBe(43200); // 12 hours
      expect(settings.refreshTokenIdleExpiration).toBe(1296000); // 15 days
      expect(settings.refreshTokenExpiration).toBe(2592000); // 30 days
    });

    it('should process instance.oidc.settings.added event', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.oidc.settings.added',
        payload: {
          accessTokenLifetime: 3600, // 1 hour
          idTokenLifetime: 3600, // 1 hour
          refreshTokenIdleExpiration: 604800, // 7 days
          refreshTokenExpiration: 1209600, // 14 days
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const settings = await oidcSettingsQueries.getOIDCSettings(instanceID);
      
      expect(settings.accessTokenLifetime).toBe(3600);
      expect(settings.idTokenLifetime).toBe(3600);
      expect(settings.refreshTokenIdleExpiration).toBe(604800);
      expect(settings.refreshTokenExpiration).toBe(1209600);
    });

    it('should update OIDC settings on changed event', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.oidc.settings.added',
        payload: {
          accessTokenLifetime: 3600,
          idTokenLifetime: 3600,
          refreshTokenIdleExpiration: 604800,
          refreshTokenExpiration: 1209600,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Change settings
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.oidc.settings.changed',
        payload: {
          accessTokenLifetime: 7200, // 2 hours
          refreshTokenExpiration: 2592000, // 30 days
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const settings = await oidcSettingsQueries.getOIDCSettings(instanceID);
      
      expect(settings.accessTokenLifetime).toBe(7200);
      expect(settings.idTokenLifetime).toBe(3600); // Unchanged
      expect(settings.refreshTokenExpiration).toBe(2592000);
    });
  });

  describe('Combined Features', () => {
    it('should handle both mail template and OIDC settings for same instance', async () => {
      const instanceID = generateId();
      
      // Add mail template
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.mail.template.added',
        payload: {
          template: '<html><body>Combined Test</body></html>',
        },
        creator: 'admin',
        owner: instanceID,
      });

      // Add OIDC settings
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.oidc.settings.added',
        payload: {
          accessTokenLifetime: 5400,
          idTokenLifetime: 5400,
          refreshTokenIdleExpiration: 864000,
          refreshTokenExpiration: 1728000,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const template = await mailTemplateQueries.getDefaultMailTemplate(instanceID);
      const settings = await oidcSettingsQueries.getOIDCSettings(instanceID);
      
      expect(template.template).toBe('<html><body>Combined Test</body></html>');
      expect(settings.accessTokenLifetime).toBe(5400);
    });
  });

  describe('Cleanup Events', () => {
    it('should delete org mail templates when org is removed', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      
      // Create org template
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.mail.template.added',
        payload: {
          template: '<html><body>Org Template</body></html>',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      let template = await mailTemplateQueries.getMailTemplate(instanceID, orgID);
      expect(template.organizationID).toBe(orgID);

      // Remove org
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.removed',
        payload: {},
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      // Should fall back to built-in default
      template = await mailTemplateQueries.getMailTemplate(instanceID, orgID);
      expect(template.aggregateID).toBe('built-in-default');
    });
  });
});
