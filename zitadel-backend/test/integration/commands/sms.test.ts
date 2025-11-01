/**
 * SMS Configuration Commands Integration Tests
 * 
 * Tests command→event→projection→query flow for SMS delivery
 * Based on established pattern from smtp.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { SMSProjection } from '../../../src/lib/query/projections/sms-projection';
import { SMSQueries } from '../../../src/lib/query/sms/sms-queries';
import { SMSConfigState, SMSProviderType } from '../../../src/lib/query/sms/sms-types';

describe('SMS Configuration Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let smsProjection: SMSProjection;
  let smsQueries: SMSQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    smsProjection = new SMSProjection(ctx.eventstore, pool);
    await smsProjection.init();
    
    // Initialize query layer
    smsQueries = new SMSQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clear all events
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE projections.sms_configs CASCADE');
  });

  /**
   * Helper: Create test organization
   */
  async function createTestOrg(): Promise<string> {
    const orgID = await ctx.commands.nextID();
    await ctx.commands.addOrg(ctx.createContext(), {
      name: `Test Org ${orgID}`,
    });
    return orgID;
  }

  /**
   * Helper: Process projection
   */
  async function processProjection() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projection...`);
    
    for (const event of events) {
      try {
        await smsProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType}`);
      } catch (err) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Verify SMS config exists via Query Layer
   */
  async function assertSMSConfigInQuery(
    orgID: string, 
    expectedState?: SMSConfigState,
    expectedProvider?: SMSProviderType
  ) {
    const config = await smsQueries.getSMSConfig(
      ctx.createContext().instanceID,
      orgID
    );

    expect(config).not.toBeNull();

    if (expectedState !== undefined) {
      expect(config!.state).toBe(expectedState);
    }

    if (expectedProvider !== undefined) {
      expect(config!.providerType).toBe(expectedProvider);
    }
    
    console.log(`✓ SMS config verified via query layer: ${config!.providerType} (${config!.state})`);
    return config;
  }

  describe('addTwilioSMSConfigToOrg', () => {
    describe('Success Cases', () => {
      it('should add Twilio SMS config with all fields', async () => {
        const org = await createTestOrg();

        console.log('\n--- Adding Twilio SMS Config ---');
        const result = await ctx.commands.addTwilioSMSConfigToOrg(
          ctx.createContext(),
          org,
          {
            description: 'Production Twilio',
            sid: 'ACxxxxxxxxxxxxxxxxxxxx',
            token: 'auth-token-secret',
            senderNumber: '+1234567890',
            verifyServiceSID: 'VAxxxxxxxxxxxxxxxxxxxx',
          }
        );

        expect(result).toBeDefined();
        expect(result.details.resourceOwner).toBe(org);

        // Verify event
        const event = await ctx.assertEventPublished('org.sms.config.twilio.added');
        expect(event.payload).toHaveProperty('sid', 'ACxxxxxxxxxxxxxxxxxxxx');
        expect(event.payload).toHaveProperty('senderNumber', '+1234567890');

        // Process and verify via query layer
        await processProjection();
        await assertSMSConfigInQuery(org, SMSConfigState.INACTIVE, SMSProviderType.TWILIO);
      });

      it('should add Twilio SMS config with minimal fields', async () => {
        const org = await createTestOrg();

        await ctx.commands.addTwilioSMSConfigToOrg(
          ctx.createContext(),
          org,
          {
            sid: 'ACtest',
            token: 'test-token',
            senderNumber: '+1234567890',
          }
        );

        const event = await ctx.assertEventPublished('org.sms.config.twilio.added');
        expect(event.payload?.description).toBe('');
        expect(event.payload?.verifyServiceSID).toBe('');

        console.log('✓ Twilio SMS config with minimal fields added');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty SID', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addTwilioSMSConfigToOrg(
            ctx.createContext(),
            org,
            {
              sid: '',
              token: 'test-token',
              senderNumber: '+1234567890',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty SID');
      });

      it('should fail with empty token', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addTwilioSMSConfigToOrg(
            ctx.createContext(),
            org,
            {
              sid: 'ACtest',
              token: '',
              senderNumber: '+1234567890',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty token');
      });

      it('should fail with empty sender number', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addTwilioSMSConfigToOrg(
            ctx.createContext(),
            org,
            {
              sid: 'ACtest',
              token: 'test-token',
              senderNumber: '',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty sender number');
      });
    });
  });

  describe('changeTwilioSMSConfig', () => {
    describe('Success Cases', () => {
      it('should change Twilio SMS config fields', async () => {
        const org = await createTestOrg();

        // Add config
        await ctx.commands.addTwilioSMSConfigToOrg(
          ctx.createContext(),
          org,
          {
            sid: 'ACtest',
            token: 'test-token',
            senderNumber: '+1234567890',
          }
        );

        const addEvent = await ctx.assertEventPublished('org.sms.config.twilio.added');
        const configID = addEvent.payload?.id;

        console.log('\n--- Changing Twilio SMS Config ---');
        await ctx.commands.changeTwilioSMSConfig(
          ctx.createContext(),
          org,
          configID,
          {
            senderNumber: '+9876543210',
            verifyServiceSID: 'VAnewservice',
          }
        );

        const changeEvent = await ctx.assertEventPublished('org.sms.config.twilio.changed');
        expect(changeEvent.payload).toHaveProperty('senderNumber', '+9876543210');
        expect(changeEvent.payload).toHaveProperty('verifyServiceSID', 'VAnewservice');

        console.log('✓ Twilio SMS config changed successfully');
      });

      it('should be idempotent - no event for same values', async () => {
        const org = await createTestOrg();

        await ctx.commands.addTwilioSMSConfigToOrg(
          ctx.createContext(),
          org,
          {
            sid: 'ACtest',
            token: 'test-token',
            senderNumber: '+1234567890',
          }
        );

        const addEvent = await ctx.assertEventPublished('org.sms.config.twilio.added');
        const configID = addEvent.payload?.id;

        const eventsBefore = await ctx.getEvents('*', '*');
        const eventCountBefore = eventsBefore.length;

        // Change with same values
        await ctx.commands.changeTwilioSMSConfig(
          ctx.createContext(),
          org,
          configID,
          {
            senderNumber: '+1234567890',
          }
        );

        const eventsAfter = await ctx.getEvents('*', '*');
        expect(eventsAfter.length).toBe(eventCountBefore);

        console.log('✓ Idempotent - no event for same values');
      });
    });

    describe('Error Cases', () => {
      it('should fail on non-existent config', async () => {
        const org = await createTestOrg();
        const fakeConfigID = await ctx.commands.nextID();

        await expect(
          ctx.commands.changeTwilioSMSConfig(
            ctx.createContext(),
            org,
            fakeConfigID,
            {
              senderNumber: '+9999999999',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected change to non-existent config');
      });

      it('should fail when config is HTTP type', async () => {
        const org = await createTestOrg();

        // Add HTTP config
        await ctx.commands.addHTTPSMSConfigToOrg(
          ctx.createContext(),
          org,
          {
            endpoint: 'https://sms.example.com/send',
          }
        );

        const addEvent = await ctx.assertEventPublished('org.sms.config.http.added');
        const configID = addEvent.payload?.id;

        // Try to change as Twilio
        await expect(
          ctx.commands.changeTwilioSMSConfig(
            ctx.createContext(),
            org,
            configID,
            {
              senderNumber: '+1234567890',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected Twilio change on HTTP config');
      });
    });
  });

  describe('addHTTPSMSConfigToOrg', () => {
    describe('Success Cases', () => {
      it('should add HTTP SMS config', async () => {
        const org = await createTestOrg();

        console.log('\n--- Adding HTTP SMS Config ---');
        const result = await ctx.commands.addHTTPSMSConfigToOrg(
          ctx.createContext(),
          org,
          {
            description: 'Custom SMS Gateway',
            endpoint: 'https://sms-gateway.company.com/send',
          }
        );

        expect(result).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('org.sms.config.http.added');
        expect(event.payload).toHaveProperty('endpoint', 'https://sms-gateway.company.com/send');

        // Process and verify via query layer
        await processProjection();
        await assertSMSConfigInQuery(org, SMSConfigState.INACTIVE, SMSProviderType.HTTP);
      });

      it('should add HTTP SMS config with minimal fields', async () => {
        const org = await createTestOrg();

        await ctx.commands.addHTTPSMSConfigToOrg(
          ctx.createContext(),
          org,
          {
            endpoint: 'https://sms.example.com/send',
          }
        );

        const event = await ctx.assertEventPublished('org.sms.config.http.added');
        expect(event.payload?.description).toBe('');

        console.log('✓ HTTP SMS config with minimal fields added');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty endpoint', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addHTTPSMSConfigToOrg(
            ctx.createContext(),
            org,
            {
              endpoint: '',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty endpoint');
      });

      it('should fail with invalid endpoint URL', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addHTTPSMSConfigToOrg(
            ctx.createContext(),
            org,
            {
              endpoint: 'not-a-valid-url',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected invalid endpoint URL');
      });
    });
  });

  describe('changeHTTPSMSConfig', () => {
    describe('Success Cases', () => {
      it('should change HTTP SMS config endpoint', async () => {
        const org = await createTestOrg();

        await ctx.commands.addHTTPSMSConfigToOrg(
          ctx.createContext(),
          org,
          {
            endpoint: 'https://sms.example.com/send',
          }
        );

        const addEvent = await ctx.assertEventPublished('org.sms.config.http.added');
        const configID = addEvent.payload?.id;

        console.log('\n--- Changing HTTP SMS Config ---');
        await ctx.commands.changeHTTPSMSConfig(
          ctx.createContext(),
          org,
          configID,
          {
            description: 'Updated Gateway',
            endpoint: 'https://new-sms-gateway.com/api/send',
          }
        );

        const changeEvent = await ctx.assertEventPublished('org.sms.config.http.changed');
        expect(changeEvent.payload).toHaveProperty('endpoint', 'https://new-sms-gateway.com/api/send');

        console.log('✓ HTTP SMS config changed successfully');
      });
    });

    describe('Error Cases', () => {
      it('should fail when config is Twilio type', async () => {
        const org = await createTestOrg();

        // Add Twilio config
        await ctx.commands.addTwilioSMSConfigToOrg(
          ctx.createContext(),
          org,
          {
            sid: 'ACtest',
            token: 'test-token',
            senderNumber: '+1234567890',
          }
        );

        const addEvent = await ctx.assertEventPublished('org.sms.config.twilio.added');
        const configID = addEvent.payload?.id;

        // Try to change as HTTP
        await expect(
          ctx.commands.changeHTTPSMSConfig(
            ctx.createContext(),
            org,
            configID,
            {
              endpoint: 'https://sms.example.com/send',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected HTTP change on Twilio config');
      });
    });
  });

  describe('activateSMSConfig', () => {
    it('should activate Twilio SMS config', async () => {
      const org = await createTestOrg();

      await ctx.commands.addTwilioSMSConfigToOrg(
        ctx.createContext(),
        org,
        {
          sid: 'ACtest',
          token: 'test-token',
          senderNumber: '+1234567890',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.sms.config.twilio.added');
      const configID = addEvent.payload?.id;

      console.log('\n--- Activating SMS Config ---');
      await ctx.commands.activateSMSConfig(
        ctx.createContext(),
        org,
        configID
      );

      const activateEvent = await ctx.assertEventPublished('org.sms.config.activated');
      expect(activateEvent.payload).toHaveProperty('id', configID);

      await processProjection();
      await assertSMSConfigInQuery(org, SMSConfigState.ACTIVE);
    });

    it('should activate HTTP SMS config', async () => {
      const org = await createTestOrg();

      await ctx.commands.addHTTPSMSConfigToOrg(
        ctx.createContext(),
        org,
        {
          endpoint: 'https://sms.example.com/send',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.sms.config.http.added');
      const configID = addEvent.payload?.id;

      await ctx.commands.activateSMSConfig(ctx.createContext(), org, configID);

      await processProjection();
      await assertSMSConfigInQuery(org, SMSConfigState.ACTIVE, SMSProviderType.HTTP);

      console.log('✓ HTTP SMS config activated');
    });
  });

  describe('deactivateSMSConfig', () => {
    it('should deactivate SMS config', async () => {
      const org = await createTestOrg();

      await ctx.commands.addTwilioSMSConfigToOrg(
        ctx.createContext(),
        org,
        {
          sid: 'ACtest',
          token: 'test-token',
          senderNumber: '+1234567890',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.sms.config.twilio.added');
      const configID = addEvent.payload?.id;

      // Activate first
      await ctx.commands.activateSMSConfig(ctx.createContext(), org, configID);

      console.log('\n--- Deactivating SMS Config ---');
      await ctx.commands.deactivateSMSConfig(
        ctx.createContext(),
        org,
        configID
      );

      const deactivateEvent = await ctx.assertEventPublished('org.sms.config.deactivated');
      expect(deactivateEvent.payload).toHaveProperty('id', configID);

      await processProjection();
      await assertSMSConfigInQuery(org, SMSConfigState.INACTIVE);
    });
  });

  describe('removeSMSConfig', () => {
    it('should remove Twilio SMS config', async () => {
      const org = await createTestOrg();

      await ctx.commands.addTwilioSMSConfigToOrg(
        ctx.createContext(),
        org,
        {
          sid: 'ACtest',
          token: 'test-token',
          senderNumber: '+1234567890',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.sms.config.twilio.added');
      const configID = addEvent.payload?.id;

      console.log('\n--- Removing SMS Config ---');
      await ctx.commands.removeSMSConfig(
        ctx.createContext(),
        org,
        configID
      );

      const removeEvent = await ctx.assertEventPublished('org.sms.config.removed');
      expect(removeEvent.payload).toHaveProperty('id', configID);

      await processProjection();

      const config = await smsQueries.getSMSConfig(
        ctx.createContext().instanceID,
        org
      );
      expect(config).toBeNull();

      console.log('✓ SMS config removed');
    });
  });

  describe('Complete Lifecycle', () => {
    it('should complete Twilio lifecycle: add → change → activate → deactivate → remove', async () => {
      const org = await createTestOrg();

      console.log('\n--- Testing Twilio Complete Lifecycle ---');

      // 1. Add
      console.log('Step 1: Add Twilio SMS config');
      await ctx.commands.addTwilioSMSConfigToOrg(
        ctx.createContext(),
        org,
        {
          sid: 'ACtest',
          token: 'test-token',
          senderNumber: '+1234567890',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.sms.config.twilio.added');
      const configID = addEvent.payload?.id;

      await processProjection();
      await assertSMSConfigInQuery(org, SMSConfigState.INACTIVE, SMSProviderType.TWILIO);

      // 2. Change
      console.log('Step 2: Change Twilio SMS config');
      await ctx.commands.changeTwilioSMSConfig(
        ctx.createContext(),
        org,
        configID,
        {
          senderNumber: '+9876543210',
        }
      );

      await processProjection();

      // 3. Activate
      console.log('Step 3: Activate SMS config');
      await ctx.commands.activateSMSConfig(ctx.createContext(), org, configID);

      await processProjection();
      await assertSMSConfigInQuery(org, SMSConfigState.ACTIVE);

      // 4. Deactivate
      console.log('Step 4: Deactivate SMS config');
      await ctx.commands.deactivateSMSConfig(ctx.createContext(), org, configID);

      await processProjection();
      await assertSMSConfigInQuery(org, SMSConfigState.INACTIVE);

      // 5. Remove
      console.log('Step 5: Remove SMS config');
      await ctx.commands.removeSMSConfig(ctx.createContext(), org, configID);

      await processProjection();

      const config = await smsQueries.getSMSConfig(
        ctx.createContext().instanceID,
        org
      );
      expect(config).toBeNull();

      console.log('✓ Twilio complete lifecycle tested successfully');
    });

    it('should complete HTTP lifecycle: add → change → activate → remove', async () => {
      const org = await createTestOrg();

      console.log('\n--- Testing HTTP Complete Lifecycle ---');

      // 1. Add
      console.log('Step 1: Add HTTP SMS config');
      await ctx.commands.addHTTPSMSConfigToOrg(
        ctx.createContext(),
        org,
        {
          endpoint: 'https://sms.example.com/send',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.sms.config.http.added');
      const configID = addEvent.payload?.id;

      await processProjection();
      await assertSMSConfigInQuery(org, SMSConfigState.INACTIVE, SMSProviderType.HTTP);

      // 2. Change
      console.log('Step 2: Change HTTP SMS config');
      await ctx.commands.changeHTTPSMSConfig(
        ctx.createContext(),
        org,
        configID,
        {
          endpoint: 'https://new-gateway.com/api/send',
        }
      );

      await processProjection();

      // 3. Activate
      console.log('Step 3: Activate SMS config');
      await ctx.commands.activateSMSConfig(ctx.createContext(), org, configID);

      await processProjection();
      await assertSMSConfigInQuery(org, SMSConfigState.ACTIVE, SMSProviderType.HTTP);

      // 4. Remove
      console.log('Step 4: Remove SMS config');
      await ctx.commands.removeSMSConfig(ctx.createContext(), org, configID);

      await processProjection();

      const config = await smsQueries.getSMSConfig(
        ctx.createContext().instanceID,
        org
      );
      expect(config).toBeNull();

      console.log('✓ HTTP complete lifecycle tested successfully');
    });
  });
});
