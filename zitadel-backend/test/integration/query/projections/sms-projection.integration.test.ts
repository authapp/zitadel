/**
 * Integration tests for SMS Projection
 * Tests SMS configuration with real database and projections
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { SMSProjection, createSMSProjectionConfig } from '../../../../src/lib/query/projections/sms-projection';
import { SMSQueries } from '../../../../src/lib/query/sms/sms-queries';
import { SMSConfigState, SMSProviderType } from '../../../../src/lib/query/sms/sms-types';
import { generateId } from '../../../../src/lib/id';
import { waitForProjectionCatchUp, delay } from '../../../helpers/projection-test-helpers';

describe('SMS Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let smsQueries: SMSQueries;

  const TEST_INSTANCE_ID = 'test-instance';

  beforeAll(async () => {
    pool = await createTestDatabase();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: TEST_INSTANCE_ID,
      maxPushBatchSize: 100,
      enableSubscriptions: true,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    const projection = new SMSProjection(eventstore, pool);
    await projection.init();
    
    const config = createSMSProjectionConfig();
    config.interval = 50; // Optimized: 50ms for faster projection detection
    registry.register(config, projection);
    
    await registry.start('sms_projection');

    smsQueries = new SMSQueries(pool);
    
    // Give projection time to start and establish subscriptions
    await delay(100);
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

  // Helper to wait for projection to process events
  const waitForEvents = async () => {
    await waitForProjectionCatchUp(registry, eventstore, 'sms_projection', 2000);
  };

  describe('Twilio SMS Config', () => {
    it('should process instance.sms.config.twilio.added event', async () => {
      const instanceID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.sms.config.twilio.added',
        payload: {
          id: configID,
          description: 'Production Twilio',
          state: SMSConfigState.ACTIVE,
          sid: 'AC123456789',
          senderNumber: '+15551234567',
          verifyServiceSID: 'VA123456789',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForEvents();

      const config = await smsQueries.getSMSConfigByID(instanceID, configID);
      
      expect(config).toBeTruthy();
      expect(config!.providerType).toBe(SMSProviderType.TWILIO);
      expect(config!.twilioSID).toBe('AC123456789');
      expect(config!.twilioSenderNumber).toBe('+15551234567');
      expect(config!.state).toBe(SMSConfigState.ACTIVE);
    });

    it('should update Twilio SMS config on changed event', async () => {
      const instanceID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.sms.config.twilio.added',
        payload: {
          id: configID,
          sid: 'AC_OLD',
          senderNumber: '+15550000000',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForEvents();

      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.sms.config.twilio.changed',
        payload: {
          id: configID,
          sid: 'AC_NEW',
          senderNumber: '+15559999999',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForEvents();

      const config = await smsQueries.getSMSConfigByID(instanceID, configID);
      
      expect(config!.twilioSID).toBe('AC_NEW');
      expect(config!.twilioSenderNumber).toBe('+15559999999');
    });
  });

  describe('HTTP SMS Config', () => {
    it('should process instance.sms.config.http.added event', async () => {
      const instanceID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.sms.config.http.added',
        payload: {
          id: configID,
          description: 'HTTP SMS Provider',
          state: SMSConfigState.ACTIVE,
          endpoint: 'https://api.sms-provider.com/send',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForEvents();

      const config = await smsQueries.getSMSConfigByID(instanceID, configID);
      
      expect(config).toBeTruthy();
      expect(config!.providerType).toBe(SMSProviderType.HTTP);
      expect(config!.httpEndpoint).toBe('https://api.sms-provider.com/send');
      expect(config!.state).toBe(SMSConfigState.ACTIVE);
    });
  });

  describe('SMS Config Lifecycle', () => {
    it('should get active SMS config', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: configID,
        eventType: 'org.sms.config.twilio.added',
        payload: {
          id: configID,
          description: 'Org SMS',
          state: SMSConfigState.ACTIVE,
          sid: 'AC_ORG',
          senderNumber: '+15551111111',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForEvents();

      const config = await smsQueries.getActiveSMSConfig(instanceID, orgID);
      
      expect(config).toBeTruthy();
      expect(config!.state).toBe(SMSConfigState.ACTIVE);
      expect(config!.resourceOwner).toBe(orgID);
    });

    it('should activate and deactivate SMS config', async () => {
      const instanceID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.sms.config.twilio.added',
        payload: {
          id: configID,
          sid: 'AC_TEST',
          senderNumber: '+15552222222',
          state: SMSConfigState.INACTIVE,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForEvents();

      let config = await smsQueries.getSMSConfigByID(instanceID, configID);
      expect(config!.state).toBe(SMSConfigState.INACTIVE);

      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.sms.config.activated',
        payload: { id: configID },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForEvents();

      config = await smsQueries.getSMSConfigByID(instanceID, configID);
      expect(config!.state).toBe(SMSConfigState.ACTIVE);

      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: configID,
        eventType: 'instance.sms.config.deactivated',
        payload: { id: configID },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForEvents();

      config = await smsQueries.getSMSConfigByID(instanceID, configID);
      expect(config!.state).toBe(SMSConfigState.INACTIVE);
    });
  });

  describe('Cleanup Events', () => {
    it('should delete org SMS configs when org is removed', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      const configID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: configID,
        eventType: 'org.sms.config.twilio.added',
        payload: {
          id: configID,
          sid: 'AC_REMOVE',
          senderNumber: '+15553333333',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForEvents();

      let config = await smsQueries.getSMSConfigByID(instanceID, configID);
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

      await waitForEvents();

      config = await smsQueries.getSMSConfigByID(instanceID, configID);
      expect(config).toBeNull();
    });
  });
});
