/**
 * Integration tests for SMTP Projection
 * Tests SMTP configuration with real database and projections
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { SMTPProjection, createSMTPProjectionConfig } from '../../../src/lib/query/projections/smtp-projection';
import { SMTPQueries } from '../../../src/lib/query/smtp/smtp-queries';
import { SMTPConfigState } from '../../../src/lib/query/smtp/smtp-types';
import { generateId } from '../../../src/lib/id';

describe('SMTP Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let smtpQueries: SMTPQueries;

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
    
    const config = createSMTPProjectionConfig();
    config.interval = 100;
    registry.register(config, new SMTPProjection(eventstore, pool));
    
    await registry.start('smtp_projection');

    smtpQueries = new SMTPQueries(pool);
  });

  afterAll(async () => {
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {}
    }
    
    await closeTestDatabase();
  });

  const waitForProjection = (ms: number = 1500) => 
    new Promise(resolve => setTimeout(resolve, ms));

  describe('SMTP Config Lifecycle', () => {
    it('should process instance.smtp.config.added event', async () => {
      const instanceID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.smtp.config.added',
        payload: {
          id: configID,
          description: 'Production SMTP',
          state: SMTPConfigState.ACTIVE,
          tls: true,
          senderAddress: 'noreply@example.com',
          senderName: 'Example App',
          replyToAddress: 'support@example.com',
          host: 'smtp.example.com',
          user: 'smtp-user',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const config = await smtpQueries.getSMTPConfigByID(instanceID, configID);
      
      expect(config).toBeTruthy();
      expect(config!.senderAddress).toBe('noreply@example.com');
      expect(config!.tls).toBe(true);
      expect(config!.state).toBe(SMTPConfigState.ACTIVE);
    });

    it('should get active SMTP config', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: configID,
        eventType: 'org.smtp.config.added',
        payload: {
          id: configID,
          description: 'Org SMTP',
          state: SMTPConfigState.ACTIVE,
          tls: true,
          senderAddress: 'org@example.com',
          senderName: 'Organization',
          host: 'mail.example.com',
          user: 'org-user',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const config = await smtpQueries.getActiveSMTPConfig(instanceID, orgID);
      
      expect(config).toBeTruthy();
      expect(config!.state).toBe(SMTPConfigState.ACTIVE);
      expect(config!.resourceOwner).toBe(orgID);
    });

    it('should update SMTP config on changed event', async () => {
      const instanceID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.smtp.config.added',
        payload: {
          id: configID,
          description: 'Initial',
          senderAddress: 'initial@example.com',
          host: 'smtp1.example.com',
          tls: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.smtp.config.changed',
        payload: {
          id: configID,
          description: 'Updated',
          senderAddress: 'updated@example.com',
          host: 'smtp2.example.com',
          tls: true,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const config = await smtpQueries.getSMTPConfigByID(instanceID, configID);
      
      expect(config!.description).toBe('Updated');
      expect(config!.senderAddress).toBe('updated@example.com');
      expect(config!.host).toBe('smtp2.example.com');
      expect(config!.tls).toBe(true);
    });

    it('should activate and deactivate SMTP config', async () => {
      const instanceID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.smtp.config.added',
        payload: {
          id: configID,
          senderAddress: 'test@example.com',
          host: 'smtp.example.com',
          state: SMTPConfigState.INACTIVE,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      let config = await smtpQueries.getSMTPConfigByID(instanceID, configID);
      expect(config!.state).toBe(SMTPConfigState.INACTIVE);

      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.smtp.config.activated',
        payload: { id: configID },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      config = await smtpQueries.getSMTPConfigByID(instanceID, configID);
      expect(config!.state).toBe(SMTPConfigState.ACTIVE);

      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.smtp.config.deactivated',
        payload: { id: configID },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      config = await smtpQueries.getSMTPConfigByID(instanceID, configID);
      expect(config!.state).toBe(SMTPConfigState.INACTIVE);
    });
  });

  describe('Cleanup Events', () => {
    it('should delete org SMTP configs when org is removed', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: configID,
        eventType: 'org.smtp.config.added',
        payload: {
          id: configID,
          senderAddress: 'org@example.com',
          host: 'smtp.example.com',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      let config = await smtpQueries.getSMTPConfigByID(instanceID, configID);
      expect(config).toBeTruthy();

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

      config = await smtpQueries.getSMTPConfigByID(instanceID, configID);
      expect(config).toBeNull();
    });
  });
});
