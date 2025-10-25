/**
 * SMTP Configuration Commands Integration Tests
 * 
 * Tests command→event→projection→query flow for SMTP email delivery
 * Based on established pattern from jwt-idp.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { SMTPProjection } from '../../../src/lib/query/projections/smtp-projection';
import { SMTPQueries } from '../../../src/lib/query/smtp/smtp-queries';
import { SMTPConfigState } from '../../../src/lib/query/smtp/smtp-types';

describe('SMTP Configuration Commands - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let smtpProjection: SMTPProjection;
  let smtpQueries: SMTPQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    smtpProjection = new SMTPProjection(ctx.eventstore, pool);
    await smtpProjection.init();
    
    // Initialize query layer
    smtpQueries = new SMTPQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    // Clear all events
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE projections.smtp_configs CASCADE');
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
        await smtpProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType}`);
      } catch (err) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Verify SMTP config exists via Query Layer
   */
  async function assertSMTPConfigInQuery(orgID: string, expectedState?: SMTPConfigState) {
    const config = await smtpQueries.getSMTPConfig(
      ctx.createContext().instanceID,
      orgID
    );

    expect(config).not.toBeNull();

    if (expectedState !== undefined) {
      expect(config!.state).toBe(expectedState);
    }
    
    console.log(`✓ SMTP config verified via query layer: ${config!.state}`);
    return config;
  }

  describe('addSMTPConfigToOrg', () => {
    describe('Success Cases', () => {
      it('should add SMTP config with all fields', async () => {
        const org = await createTestOrg();

        console.log('\n--- Adding SMTP Config ---');
        const result = await ctx.commands.addSMTPConfigToOrg(
          ctx.createContext(),
          org,
          {
            description: 'Production SMTP',
            senderAddress: 'noreply@company.com',
            senderName: 'Company Name',
            replyToAddress: 'support@company.com',
            host: 'smtp.gmail.com',
            user: 'smtp-user',
            password: 'smtp-password',
            tls: true,
          }
        );

        expect(result).toBeDefined();
        expect(result.resourceOwner).toBe(org);

        // Verify event
        const event = await ctx.assertEventPublished('org.smtp.config.added');
        expect(event.payload).toHaveProperty('senderAddress', 'noreply@company.com');
        expect(event.payload).toHaveProperty('host', 'smtp.gmail.com');
        expect(event.payload).toHaveProperty('tls', true);

        // Process and verify via query layer
        await processProjection();
        await assertSMTPConfigInQuery(org, SMTPConfigState.INACTIVE);
      });

      it('should add SMTP config with minimal fields', async () => {
        const org = await createTestOrg();

        await ctx.commands.addSMTPConfigToOrg(
          ctx.createContext(),
          org,
          {
            senderAddress: 'noreply@example.com',
            host: 'smtp.example.com',
          }
        );

        const event = await ctx.assertEventPublished('org.smtp.config.added');
        expect(event.payload?.tls).toBe(true); // Default
        expect(event.payload?.senderName).toBe('');
        expect(event.payload?.replyToAddress).toBe('');

        console.log('✓ SMTP config with minimal fields added');
      });

      it('should support TLS disabled', async () => {
        const org = await createTestOrg();

        await ctx.commands.addSMTPConfigToOrg(
          ctx.createContext(),
          org,
          {
            senderAddress: 'noreply@example.com',
            host: 'smtp.example.com',
            tls: false,
          }
        );

        const event = await ctx.assertEventPublished('org.smtp.config.added');
        expect(event.payload?.tls).toBe(false);

        console.log('✓ SMTP config with TLS disabled');
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty sender address', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addSMTPConfigToOrg(
            ctx.createContext(),
            org,
            {
              senderAddress: '',
              host: 'smtp.example.com',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty sender address');
      });

      it('should fail with invalid sender email', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addSMTPConfigToOrg(
            ctx.createContext(),
            org,
            {
              senderAddress: 'invalid-email',
              host: 'smtp.example.com',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected invalid sender email');
      });

      it('should fail with empty host', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addSMTPConfigToOrg(
            ctx.createContext(),
            org,
            {
              senderAddress: 'noreply@example.com',
              host: '',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected empty host');
      });

      it('should fail with invalid reply-to email', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addSMTPConfigToOrg(
            ctx.createContext(),
            org,
            {
              senderAddress: 'noreply@example.com',
              host: 'smtp.example.com',
              replyToAddress: 'not-an-email',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected invalid reply-to email');
      });
    });
  });

  describe('changeSMTPConfig', () => {
    describe('Success Cases', () => {
      it('should change SMTP config fields', async () => {
        const org = await createTestOrg();

        // Add config
        await ctx.commands.addSMTPConfigToOrg(
          ctx.createContext(),
          org,
          {
            senderAddress: 'noreply@company.com',
            host: 'smtp.gmail.com',
          }
        );

        // Get configID from event
        const addEvent = await ctx.assertEventPublished('org.smtp.config.added');
        const configID = addEvent.payload?.id;

        console.log('\n--- Changing SMTP Config ---');
        await ctx.commands.changeSMTPConfig(
          ctx.createContext(),
          org,
          configID,
          {
            senderName: 'New Company Name',
            host: 'smtp.sendgrid.net',
          }
        );

        // Verify change event
        const changeEvent = await ctx.assertEventPublished('org.smtp.config.changed');
        expect(changeEvent.payload).toHaveProperty('senderName', 'New Company Name');
        expect(changeEvent.payload).toHaveProperty('host', 'smtp.sendgrid.net');

        console.log('✓ SMTP config changed successfully');
      });

      it('should be idempotent - no event for same values', async () => {
        const org = await createTestOrg();

        await ctx.commands.addSMTPConfigToOrg(
          ctx.createContext(),
          org,
          {
            senderAddress: 'noreply@company.com',
            senderName: 'Company',
            host: 'smtp.gmail.com',
          }
        );

        const addEvent = await ctx.assertEventPublished('org.smtp.config.added');
        const configID = addEvent.payload?.id;

        // Get event count before
        const eventsBefore = await ctx.getEvents('*', '*');
        const eventCountBefore = eventsBefore.length;

        // Change with same values
        await ctx.commands.changeSMTPConfig(
          ctx.createContext(),
          org,
          configID,
          {
            senderName: 'Company',
            host: 'smtp.gmail.com',
          }
        );

        // Verify no new event
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
          ctx.commands.changeSMTPConfig(
            ctx.createContext(),
            org,
            fakeConfigID,
            {
              senderName: 'New Name',
            }
          )
        ).rejects.toThrow();

        console.log('✓ Rejected change to non-existent config');
      });
    });
  });

  describe('activateSMTPConfig', () => {
    it('should activate SMTP config', async () => {
      const org = await createTestOrg();

      await ctx.commands.addSMTPConfigToOrg(
        ctx.createContext(),
        org,
        {
          senderAddress: 'noreply@company.com',
          host: 'smtp.gmail.com',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.smtp.config.added');
      const configID = addEvent.payload?.id;

      console.log('\n--- Activating SMTP Config ---');
      await ctx.commands.activateSMTPConfig(
        ctx.createContext(),
        org,
        configID
      );

      const activateEvent = await ctx.assertEventPublished('org.smtp.config.activated');
      expect(activateEvent.payload).toHaveProperty('id', configID);

      await processProjection();
      await assertSMTPConfigInQuery(org, SMTPConfigState.ACTIVE);
    });

    it('should be idempotent - no event if already active', async () => {
      const org = await createTestOrg();

      await ctx.commands.addSMTPConfigToOrg(
        ctx.createContext(),
        org,
        {
          senderAddress: 'noreply@company.com',
          host: 'smtp.gmail.com',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.smtp.config.added');
      const configID = addEvent.payload?.id;

      // Activate once
      await ctx.commands.activateSMTPConfig(ctx.createContext(), org, configID);

      const eventsBefore = await ctx.getEvents('*', '*');
      const eventCountBefore = eventsBefore.length;

      // Activate again
      await ctx.commands.activateSMTPConfig(ctx.createContext(), org, configID);

      const eventsAfter = await ctx.getEvents('*', '*');
      expect(eventsAfter.length).toBe(eventCountBefore);

      console.log('✓ Idempotent - no event if already active');
    });
  });

  describe('deactivateSMTPConfig', () => {
    it('should deactivate SMTP config', async () => {
      const org = await createTestOrg();

      await ctx.commands.addSMTPConfigToOrg(
        ctx.createContext(),
        org,
        {
          senderAddress: 'noreply@company.com',
          host: 'smtp.gmail.com',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.smtp.config.added');
      const configID = addEvent.payload?.id;

      // Activate first
      await ctx.commands.activateSMTPConfig(ctx.createContext(), org, configID);

      console.log('\n--- Deactivating SMTP Config ---');
      await ctx.commands.deactivateSMTPConfig(
        ctx.createContext(),
        org,
        configID
      );

      const deactivateEvent = await ctx.assertEventPublished('org.smtp.config.deactivated');
      expect(deactivateEvent.payload).toHaveProperty('id', configID);

      await processProjection();
      await assertSMTPConfigInQuery(org, SMTPConfigState.INACTIVE);
    });
  });

  describe('removeSMTPConfig', () => {
    it('should remove SMTP config', async () => {
      const org = await createTestOrg();

      await ctx.commands.addSMTPConfigToOrg(
        ctx.createContext(),
        org,
        {
          senderAddress: 'noreply@company.com',
          host: 'smtp.gmail.com',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.smtp.config.added');
      const configID = addEvent.payload?.id;

      console.log('\n--- Removing SMTP Config ---');
      await ctx.commands.removeSMTPConfig(
        ctx.createContext(),
        org,
        configID
      );

      const removeEvent = await ctx.assertEventPublished('org.smtp.config.removed');
      expect(removeEvent.payload).toHaveProperty('id', configID);

      await processProjection();
      
      // Config should be deleted from projection
      const config = await smtpQueries.getSMTPConfig(
        ctx.createContext().instanceID,
        org
      );
      expect(config).toBeNull();

      console.log('✓ SMTP config removed');
    });
  });

  describe('Complete Lifecycle', () => {
    it('should complete add → change → activate → deactivate → remove lifecycle', async () => {
      const org = await createTestOrg();

      console.log('\n--- Testing Complete Lifecycle ---');

      // 1. Add
      console.log('Step 1: Add SMTP config');
      await ctx.commands.addSMTPConfigToOrg(
        ctx.createContext(),
        org,
        {
          senderAddress: 'noreply@company.com',
          senderName: 'Company',
          host: 'smtp.gmail.com',
        }
      );

      const addEvent = await ctx.assertEventPublished('org.smtp.config.added');
      const configID = addEvent.payload?.id;

      await processProjection();
      await assertSMTPConfigInQuery(org, SMTPConfigState.INACTIVE);

      // 2. Change
      console.log('Step 2: Change SMTP config');
      await ctx.commands.changeSMTPConfig(
        ctx.createContext(),
        org,
        configID,
        {
          senderName: 'New Company Name',
        }
      );

      await processProjection();

      // 3. Activate
      console.log('Step 3: Activate SMTP config');
      await ctx.commands.activateSMTPConfig(ctx.createContext(), org, configID);

      await processProjection();
      await assertSMTPConfigInQuery(org, SMTPConfigState.ACTIVE);

      // 4. Deactivate
      console.log('Step 4: Deactivate SMTP config');
      await ctx.commands.deactivateSMTPConfig(ctx.createContext(), org, configID);

      await processProjection();
      await assertSMTPConfigInQuery(org, SMTPConfigState.INACTIVE);

      // 5. Remove
      console.log('Step 5: Remove SMTP config');
      await ctx.commands.removeSMTPConfig(ctx.createContext(), org, configID);

      await processProjection();

      const config = await smtpQueries.getSMTPConfig(
        ctx.createContext().instanceID,
        org
      );
      expect(config).toBeNull();

      console.log('✓ Complete lifecycle tested successfully');
    });
  });
});
