/**
 * Custom Text Integration Tests - Complete Stack
 * 
 * Tests for:
 * - Organization-level text customization
 * - Instance-level text customization
 * - Login screen text customization
 * - Message template customization
 * - Multi-language support (i18n)
 * - Complete stack: Command → Event → Projection → Query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder } from '../../helpers/test-data-builders';
import { CustomTextProjection } from '../../../src/lib/query/projections/custom-text-projection';
import { CustomTextQueries } from '../../../src/lib/query/custom-text/custom-text-queries';

describe('Custom Text Commands', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let customTextProjection: CustomTextProjection;
  let customTextQueries: CustomTextQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    customTextProjection = new CustomTextProjection(ctx.eventstore, pool);
    await customTextProjection.init();
    
    // Initialize query layer
    customTextQueries = new CustomTextQueries(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
    
    // Clear projection data
    await pool.query('TRUNCATE projections.custom_texts CASCADE');
  });
  
  /**
   * Helper: Process projection for custom text events with intervals
   */
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    
    // Process events with 50ms intervals
    for (const event of events) {
      await customTextProjection.reduce(event);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Wait additional 100ms for database consistency
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Create test organization
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`Test Org ${Date.now()}`)
      .build();
    
    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return result.orgID;
  }

  // ============================================================================
  // ORGANIZATION CUSTOM TEXT
  // ============================================================================

  describe('setCustomText (org-level)', () => {
    it('should set custom text for organization and verify in projection', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      await ctx.commands.setCustomText(
        ctx.createContext(),
        orgID,
        {
          language: 'en',
          key: 'Login.Title',
          text: 'Welcome to Our Platform',
        }
      );
      
      // Assert - Verify event
      const events = await ctx.getEvents('org', orgID);
      const textEvent = events.find(e => e.eventType === 'org.custom.text.set');
      expect(textEvent).toBeDefined();
      expect(textEvent!.payload).toMatchObject({
        language: 'en',
        key: 'Login.Title',
        text: 'Welcome to Our Platform',
      });
      
      // Process projection
      await processProjections();
      
      // Verify in query layer
      const customText = await customTextQueries.getCustomText(
        orgID,
        'org',
        'en',
        'Login.Title',
        'test-instance'
      );
      
      expect(customText).not.toBeNull();
      expect(customText!.text).toBe('Welcome to Our Platform');
      expect(customText!.language).toBe('en');
      expect(customText!.key).toBe('Login.Title');
      
      console.log('✓ Organization custom text set successfully and verified in projection');
    });

    it('should support multiple languages', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act - Set text in multiple languages
      await ctx.commands.setCustomText(
        ctx.createContext(),
        orgID,
        { language: 'en', key: 'Login.Title', text: 'Welcome' }
      );
      
      await ctx.commands.setCustomText(
        ctx.createContext(),
        orgID,
        { language: 'de', key: 'Login.Title', text: 'Willkommen' }
      );
      
      await ctx.commands.setCustomText(
        ctx.createContext(),
        orgID,
        { language: 'fr', key: 'Login.Title', text: 'Bienvenue' }
      );
      
      // Assert - Verify all language events
      const events = await ctx.getEvents('org', orgID);
      const textEvents = events.filter(e => e.eventType === 'org.custom.text.set');
      expect(textEvents).toHaveLength(3);
      
      const languages = textEvents.map(e => e.payload!.language);
      expect(languages).toContain('en');
      expect(languages).toContain('de');
      expect(languages).toContain('fr');
      
      console.log('✓ Multi-language custom text set successfully');
    });

    it('should fail with empty orgID', async () => {
      await expect(
        ctx.commands.setCustomText(
          ctx.createContext(),
          '',
          { language: 'en', key: 'Login.Title', text: 'Welcome' }
        )
      ).rejects.toThrow('orgID is required');
    });

    it('should fail with empty language', async () => {
      const orgID = await createTestOrg();
      
      await expect(
        ctx.commands.setCustomText(
          ctx.createContext(),
          orgID,
          { language: '', key: 'Login.Title', text: 'Welcome' }
        )
      ).rejects.toThrow('language is required');
    });

    it('should fail with invalid language code', async () => {
      const orgID = await createTestOrg();
      
      await expect(
        ctx.commands.setCustomText(
          ctx.createContext(),
          orgID,
          { language: 'eng', key: 'Login.Title', text: 'Welcome' }
        )
      ).rejects.toThrow('invalid language code format');
    });

    it('should fail with empty key', async () => {
      const orgID = await createTestOrg();
      
      await expect(
        ctx.commands.setCustomText(
          ctx.createContext(),
          orgID,
          { language: 'en', key: '', text: 'Welcome' }
        )
      ).rejects.toThrow('key is required');
    });

    it('should fail with empty text', async () => {
      const orgID = await createTestOrg();
      
      await expect(
        ctx.commands.setCustomText(
          ctx.createContext(),
          orgID,
          { language: 'en', key: 'Login.Title', text: '' }
        )
      ).rejects.toThrow('text is required');
    });
  });

  describe('resetCustomText (org-level)', () => {
    it('should reset custom text to defaults', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Set some custom text first
      await ctx.commands.setCustomText(
        ctx.createContext(),
        orgID,
        { language: 'en', key: 'Login.Title', text: 'Custom Title' }
      );
      
      // Act - Reset
      await ctx.commands.resetCustomText(
        ctx.createContext(),
        orgID,
        'en'
      );
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const resetEvent = events.find(e => e.eventType === 'org.custom.text.reset');
      expect(resetEvent).toBeDefined();
      expect(resetEvent!.payload).toMatchObject({
        language: 'en',
      });
      
      console.log('✓ Organization custom text reset successfully');
    });

    it('should fail with empty language', async () => {
      const orgID = await createTestOrg();
      
      await expect(
        ctx.commands.resetCustomText(
          ctx.createContext(),
          orgID,
          ''
        )
      ).rejects.toThrow('language is required');
    });

    it('should fail with invalid language code', async () => {
      const orgID = await createTestOrg();
      
      await expect(
        ctx.commands.resetCustomText(
          ctx.createContext(),
          orgID,
          'ENG'
        )
      ).rejects.toThrow('invalid language code format');
    });
  });

  // ============================================================================
  // INSTANCE LOGIN TEXT
  // ============================================================================

  describe('setCustomLoginText (instance-level)', () => {
    it('should set custom login text', async () => {
      // Arrange
      const instanceID = 'test-instance';
      
      // Act
      await ctx.commands.setCustomLoginText(
        ctx.createContext(),
        instanceID,
        {
          language: 'en',
          screen: 'login',
          key: 'Title',
          text: 'Sign In to Your Account',
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', instanceID);
      const loginTextEvent = events.find(e => e.eventType === 'instance.login.custom.text.set');
      expect(loginTextEvent).toBeDefined();
      expect(loginTextEvent!.payload).toMatchObject({
        language: 'en',
        screen: 'login',
        key: 'Title',
        text: 'Sign In to Your Account',
      });
      
      console.log('✓ Login custom text set successfully');
    });

    it('should support multiple screens', async () => {
      // Arrange
      const instanceID = 'test-instance';
      
      // Act - Set text for different screens
      await ctx.commands.setCustomLoginText(
        ctx.createContext(),
        instanceID,
        { language: 'en', screen: 'login', key: 'Title', text: 'Sign In' }
      );
      
      await ctx.commands.setCustomLoginText(
        ctx.createContext(),
        instanceID,
        { language: 'en', screen: 'register', key: 'Title', text: 'Create Account' }
      );
      
      await ctx.commands.setCustomLoginText(
        ctx.createContext(),
        instanceID,
        { language: 'en', screen: 'password_reset', key: 'Title', text: 'Reset Password' }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', instanceID);
      const loginTextEvents = events.filter(e => e.eventType === 'instance.login.custom.text.set');
      expect(loginTextEvents).toHaveLength(3);
      
      const screens = loginTextEvents.map(e => e.payload!.screen);
      expect(screens).toContain('login');
      expect(screens).toContain('register');
      expect(screens).toContain('password_reset');
      
      console.log('✓ Multi-screen login text set successfully');
    });

    it('should fail with empty screen', async () => {
      const instanceID = 'test-instance';
      
      await expect(
        ctx.commands.setCustomLoginText(
          ctx.createContext(),
          instanceID,
          { language: 'en', screen: '', key: 'Title', text: 'Sign In' }
        )
      ).rejects.toThrow('screen is required');
    });
  });

  describe('resetCustomLoginText (instance-level)', () => {
    it('should reset login text to defaults', async () => {
      // Arrange
      const instanceID = 'test-instance';
      
      // Set custom login text first
      await ctx.commands.setCustomLoginText(
        ctx.createContext(),
        instanceID,
        { language: 'en', screen: 'login', key: 'Title', text: 'Custom Login' }
      );
      
      // Act - Reset
      await ctx.commands.resetCustomLoginText(
        ctx.createContext(),
        instanceID,
        'en'
      );
      
      // Assert
      const events = await ctx.getEvents('instance', instanceID);
      const resetEvent = events.find(e => e.eventType === 'instance.login.custom.text.reset');
      expect(resetEvent).toBeDefined();
      expect(resetEvent!.payload).toMatchObject({
        language: 'en',
      });
      
      console.log('✓ Login custom text reset successfully');
    });
  });

  // ============================================================================
  // INSTANCE INIT MESSAGE TEXT
  // ============================================================================

  describe('setCustomInitMessageText (instance-level)', () => {
    it('should set init message template', async () => {
      // Arrange
      const instanceID = 'test-instance';
      
      // Act
      await ctx.commands.setCustomInitMessageText(
        ctx.createContext(),
        instanceID,
        {
          language: 'en',
          title: 'Welcome Email',
          preHeader: 'Get started with your account',
          subject: 'Welcome to Our Platform',
          greeting: 'Hello',
          text: 'Welcome to our platform! Click the button below to get started.',
          buttonText: 'Get Started',
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', instanceID);
      const messageEvent = events.find(e => e.eventType === 'instance.init.message.text.set');
      expect(messageEvent).toBeDefined();
      expect(messageEvent!.payload).toMatchObject({
        language: 'en',
        title: 'Welcome Email',
        subject: 'Welcome to Our Platform',
        greeting: 'Hello',
        text: 'Welcome to our platform! Click the button below to get started.',
        buttonText: 'Get Started',
      });
      
      console.log('✓ Init message template set successfully');
    });

    it('should fail with empty title', async () => {
      const instanceID = 'test-instance';
      
      await expect(
        ctx.commands.setCustomInitMessageText(
          ctx.createContext(),
          instanceID,
          {
            language: 'en',
            title: '',
            preHeader: 'Welcome',
            subject: 'Welcome',
            greeting: 'Hello',
            text: 'Welcome text',
          }
        )
      ).rejects.toThrow('title is required');
    });
  });

  // ============================================================================
  // MESSAGE TEXT (INSTANCE & ORG)
  // ============================================================================

  describe('setCustomMessageText (instance-level)', () => {
    it('should set custom message text', async () => {
      // Arrange
      const instanceID = 'test-instance';
      
      // Act
      await ctx.commands.setCustomMessageText(
        ctx.createContext(),
        instanceID,
        {
          language: 'en',
          messageType: 'InitCode',
          title: 'Verification Code',
          subject: 'Your Verification Code',
          greeting: 'Hello',
          text: 'Your verification code is: {{.Code}}',
          buttonText: 'Verify',
        }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', instanceID);
      const messageEvent = events.find(e => e.eventType === 'instance.custom.message.text.set');
      expect(messageEvent).toBeDefined();
      expect(messageEvent!.payload).toMatchObject({
        language: 'en',
        messageType: 'InitCode',
        title: 'Verification Code',
        subject: 'Your Verification Code',
      });
      
      console.log('✓ Instance message text set successfully');
    });

    it('should support multiple message types', async () => {
      // Arrange
      const instanceID = 'test-instance';
      
      // Act - Different message types
      await ctx.commands.setCustomMessageText(
        ctx.createContext(),
        instanceID,
        { language: 'en', messageType: 'InitCode', title: 'Init Code', subject: 'Code' }
      );
      
      await ctx.commands.setCustomMessageText(
        ctx.createContext(),
        instanceID,
        { language: 'en', messageType: 'PasswordReset', title: 'Password Reset', subject: 'Reset' }
      );
      
      await ctx.commands.setCustomMessageText(
        ctx.createContext(),
        instanceID,
        { language: 'en', messageType: 'VerifyEmail', title: 'Verify Email', subject: 'Verify' }
      );
      
      // Assert
      const events = await ctx.getEvents('instance', instanceID);
      const messageEvents = events.filter(e => e.eventType === 'instance.custom.message.text.set');
      expect(messageEvents).toHaveLength(3);
      
      const types = messageEvents.map(e => e.payload!.messageType);
      expect(types).toContain('InitCode');
      expect(types).toContain('PasswordReset');
      expect(types).toContain('VerifyEmail');
      
      console.log('✓ Multiple message types set successfully');
    });

    it('should fail with empty message type', async () => {
      const instanceID = 'test-instance';
      
      await expect(
        ctx.commands.setCustomMessageText(
          ctx.createContext(),
          instanceID,
          { language: 'en', messageType: '', title: 'Title' }
        )
      ).rejects.toThrow('messageType is required');
    });
  });

  describe('setOrgCustomMessageText (org-level)', () => {
    it('should set org-level custom message text', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act
      await ctx.commands.setOrgCustomMessageText(
        ctx.createContext(),
        orgID,
        {
          language: 'en',
          messageType: 'PasswordReset',
          title: 'Reset Your Password',
          subject: 'Password Reset Request',
          greeting: 'Hi',
          text: 'Click the link below to reset your password.',
          buttonText: 'Reset Password',
        }
      );
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const messageEvent = events.find(e => e.eventType === 'org.custom.message.text.set');
      expect(messageEvent).toBeDefined();
      expect(messageEvent!.payload).toMatchObject({
        language: 'en',
        messageType: 'PasswordReset',
        title: 'Reset Your Password',
      });
      
      console.log('✓ Org message text set successfully');
    });
  });

  describe('resetCustomMessageText (instance-level)', () => {
    it('should reset message text to defaults', async () => {
      // Arrange
      const instanceID = 'test-instance';
      
      // Set custom message text first
      await ctx.commands.setCustomMessageText(
        ctx.createContext(),
        instanceID,
        { language: 'en', messageType: 'InitCode', title: 'Custom' }
      );
      
      // Act - Reset
      await ctx.commands.resetCustomMessageText(
        ctx.createContext(),
        instanceID,
        'en',
        'InitCode'
      );
      
      // Assert
      const events = await ctx.getEvents('instance', instanceID);
      const resetEvent = events.find(e => e.eventType === 'instance.custom.message.text.reset');
      expect(resetEvent).toBeDefined();
      expect(resetEvent!.payload).toMatchObject({
        language: 'en',
        messageType: 'InitCode',
      });
      
      console.log('✓ Instance message text reset successfully');
    });
  });

  describe('resetOrgCustomMessageText (org-level)', () => {
    it('should reset org message text to defaults', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Set custom message text first
      await ctx.commands.setOrgCustomMessageText(
        ctx.createContext(),
        orgID,
        { language: 'en', messageType: 'PasswordReset', title: 'Custom' }
      );
      
      // Act - Reset
      await ctx.commands.resetOrgCustomMessageText(
        ctx.createContext(),
        orgID,
        'en',
        'PasswordReset'
      );
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const resetEvent = events.find(e => e.eventType === 'org.custom.message.text.reset');
      expect(resetEvent).toBeDefined();
      expect(resetEvent!.payload).toMatchObject({
        language: 'en',
        messageType: 'PasswordReset',
      });
      
      console.log('✓ Org message text reset successfully');
    });
  });

  // ============================================================================
  // COMPLETE LIFECYCLE TESTS
  // ============================================================================

  describe('Complete Custom Text Lifecycle', () => {
    it('should handle org text lifecycle: set → update → reset', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Step 1: Set custom text
      await ctx.commands.setCustomText(
        ctx.createContext(),
        orgID,
        { language: 'en', key: 'Login.Title', text: 'Original Title' }
      );
      
      // Step 2: Update custom text
      await ctx.commands.setCustomText(
        ctx.createContext(),
        orgID,
        { language: 'en', key: 'Login.Title', text: 'Updated Title' }
      );
      
      // Step 3: Reset to defaults
      await ctx.commands.resetCustomText(
        ctx.createContext(),
        orgID,
        'en'
      );
      
      // Assert - Verify complete lifecycle
      const events = await ctx.getEvents('org', orgID);
      const setEvents = events.filter(e => e.eventType === 'org.custom.text.set');
      const resetEvents = events.filter(e => e.eventType === 'org.custom.text.reset');
      
      expect(setEvents).toHaveLength(2); // Original + Update
      expect(resetEvents).toHaveLength(1);
      
      console.log('✓ Org custom text lifecycle complete');
    });

    it('should handle instance message lifecycle: set → reset', async () => {
      // Arrange
      const instanceID = 'test-instance';
      
      // Step 1: Set custom message
      await ctx.commands.setCustomMessageText(
        ctx.createContext(),
        instanceID,
        {
          language: 'en',
          messageType: 'InitCode',
          title: 'Verification Code',
          subject: 'Your Code',
        }
      );
      
      // Step 2: Reset message
      await ctx.commands.resetCustomMessageText(
        ctx.createContext(),
        instanceID,
        'en',
        'InitCode'
      );
      
      // Assert
      const events = await ctx.getEvents('instance', instanceID);
      const setEvents = events.filter(e => e.eventType === 'instance.custom.message.text.set');
      const resetEvents = events.filter(e => e.eventType === 'instance.custom.message.text.reset');
      
      expect(setEvents).toHaveLength(1);
      expect(resetEvents).toHaveLength(1);
      
      console.log('✓ Instance message lifecycle complete');
    });

    it('should handle multi-language org text', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act - Set text in multiple languages
      const languages = ['en', 'de', 'fr', 'es', 'it'];
      for (const lang of languages) {
        await ctx.commands.setCustomText(
          ctx.createContext(),
          orgID,
          { language: lang, key: 'Login.Title', text: `Welcome ${lang}` }
        );
      }
      
      // Assert
      const events = await ctx.getEvents('org', orgID);
      const textEvents = events.filter(e => e.eventType === 'org.custom.text.set');
      expect(textEvents).toHaveLength(5);
      
      // Verify all languages
      const setLanguages = textEvents.map(e => e.payload!.language);
      languages.forEach(lang => {
        expect(setLanguages).toContain(lang);
      });
      
      console.log('✓ Multi-language org text complete');
    });
  });
});
