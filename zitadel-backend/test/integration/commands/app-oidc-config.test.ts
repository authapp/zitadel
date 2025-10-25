/**
 * OIDC Application Configuration Tests - Complete Stack
 * 
 * Tests for:
 * - OIDC redirect URI management (add, remove)
 * - Client type switching (confidential ↔ public)
 * - Complete stack: Command → Event → Projection → Query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder, ProjectBuilder } from '../../helpers/test-data-builders';
import { AppProjection } from '../../../src/lib/query/projections/app-projection';
import { OIDCAppType, OIDCAuthMethodType } from '../../../src/lib/domain/project';

describe('OIDC Application Configuration - Complete Flow', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let appProjection: AppProjection;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    appProjection = new AppProjection(ctx.eventstore, pool);
    await appProjection.init();
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  /**
   * Helper: Process projections
   */
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    
    console.log(`Processing ${events.length} event(s) through projections...`);
    
    for (const event of events) {
      try {
        await appProjection.reduce(event);
        console.log(`  ✓ Processed ${event.eventType} for ${event.aggregateID}`);
      } catch (err: any) {
        console.error(`  ✗ Failed to process ${event.eventType}:`, err.message);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Helper: Create test org
   */
  async function createTestOrg() {
    const orgData = new OrganizationBuilder()
      .withName(`Test Org ${Date.now()}`)
      .build();
    
    const result = await ctx.commands.addOrg(ctx.createContext(), orgData);
    return result.orgID;
  }

  /**
   * Helper: Create test project
   */
  async function createTestProject(orgID: string) {
    const projectData = new ProjectBuilder()
      .withName(`Test Project ${Date.now()}`)
      .build();
    
    const result = await ctx.commands.addProject(ctx.createContext(), { ...projectData, orgID });
    return result.projectID;
  }

  /**
   * Helper: Create test OIDC app
   */
  async function createTestOIDCApp(projectID: string, orgID: string) {
    const appData = {
      projectID,
      orgID,
      name: `Test OIDC App ${Date.now()}`,
      oidcAppType: OIDCAppType.WEB,
      redirectURIs: ['https://example.com/callback'],
      responseTypes: ['code'],
      grantTypes: ['authorization_code', 'refresh_token'],
    };
    
    const result = await ctx.commands.addOIDCApp(ctx.createContext(), appData);
    return result.appID;
  }

  // ============================================================================
  // Add OIDC Redirect URI Tests
  // ============================================================================

  describe('addOIDCRedirectURI', () => {
    it('should add redirect URI successfully', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act
      const newURI = 'https://example.com/callback2';
      await ctx.commands.addOIDCRedirectURI(
        ctx.createContext(),
        appID,
        orgID,
        newURI
      );
      
      // Process projections
      await processProjections();
      
      // Assert - Check event
      const events = await ctx.getEvents('application', appID);
      const configEvent = events.find(e => e.eventType === 'application.oidc.config.changed');
      expect(configEvent).toBeDefined();
      expect(configEvent!.payload!.redirectURIs).toContain(newURI);
      expect(configEvent!.payload!.redirectURIs).toContain('https://example.com/callback');
      
      console.log('✓ Redirect URI added successfully');
    });

    it('should add multiple redirect URIs', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act - Add 2 more URIs
      await ctx.commands.addOIDCRedirectURI(
        ctx.createContext(),
        appID,
        orgID,
        'https://example.com/callback2'
      );
      await ctx.commands.addOIDCRedirectURI(
        ctx.createContext(),
        appID,
        orgID,
        'https://example.com/callback3'
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('application', appID);
      const configEvents = events.filter(e => e.eventType === 'application.oidc.config.changed');
      expect(configEvents.length).toBe(2);
      
      // Last event should have all 3 URIs
      const lastEvent = configEvents[configEvents.length - 1];
      expect(lastEvent.payload!.redirectURIs).toHaveLength(3);
      
      console.log('✓ Multiple redirect URIs added successfully');
    });

    it('should fail with invalid URI', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act & Assert
      await expect(
        ctx.commands.addOIDCRedirectURI(
          ctx.createContext(),
          appID,
          orgID,
          'not-a-valid-url'
        )
      ).rejects.toThrow();
      
      console.log('✓ Failed as expected with invalid URI');
    });

    it('should fail with duplicate URI', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act & Assert
      await expect(
        ctx.commands.addOIDCRedirectURI(
          ctx.createContext(),
          appID,
          orgID,
          'https://example.com/callback' // Already exists
        )
      ).rejects.toThrow('redirect URI already exists');
      
      console.log('✓ Failed as expected with duplicate URI');
    });

    it('should fail with non-existent app', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act & Assert
      await expect(
        ctx.commands.addOIDCRedirectURI(
          ctx.createContext(),
          'non-existent-app-id',
          orgID,
          'https://example.com/callback'
        )
      ).rejects.toThrow('application not found');
      
      console.log('✓ Failed as expected with non-existent app');
    });
  });

  // ============================================================================
  // Remove OIDC Redirect URI Tests
  // ============================================================================

  describe('removeOIDCRedirectURI', () => {
    it('should remove redirect URI successfully', async () => {
      // Arrange - Create app with 2 URIs
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      await ctx.commands.addOIDCRedirectURI(
        ctx.createContext(),
        appID,
        orgID,
        'https://example.com/callback2'
      );
      
      // Act - Remove second URI
      await ctx.commands.removeOIDCRedirectURI(
        ctx.createContext(),
        appID,
        orgID,
        'https://example.com/callback2'
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('application', appID);
      const configEvents = events.filter(e => e.eventType === 'application.oidc.config.changed');
      const lastEvent = configEvents[configEvents.length - 1];
      expect(lastEvent.payload!.redirectURIs).toHaveLength(1);
      expect(lastEvent.payload!.redirectURIs).toContain('https://example.com/callback');
      expect(lastEvent.payload!.redirectURIs).not.toContain('https://example.com/callback2');
      
      console.log('✓ Redirect URI removed successfully');
    });

    it('should fail to remove last redirect URI', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act & Assert
      await expect(
        ctx.commands.removeOIDCRedirectURI(
          ctx.createContext(),
          appID,
          orgID,
          'https://example.com/callback'
        )
      ).rejects.toThrow('cannot remove last redirect URI');
      
      console.log('✓ Failed as expected - cannot remove last URI');
    });

    it('should fail with non-existent URI', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act & Assert
      await expect(
        ctx.commands.removeOIDCRedirectURI(
          ctx.createContext(),
          appID,
          orgID,
          'https://notexist.com/callback'
        )
      ).rejects.toThrow('redirect URI not found');
      
      console.log('✓ Failed as expected with non-existent URI');
    });
  });

  // ============================================================================
  // Change OIDC App Type Tests
  // ============================================================================

  describe('changeOIDCAppToConfidential', () => {
    it('should change public app to confidential', async () => {
      // Arrange - Create public app (USER_AGENT)
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appData = {
        projectID,
        orgID,
        name: `Test Public App ${Date.now()}`,
        oidcAppType: OIDCAppType.USER_AGENT,
        redirectURIs: ['https://example.com/callback'],
        responseTypes: ['code'],
        grantTypes: ['authorization_code'],
      };
      const result = await ctx.commands.addOIDCApp(ctx.createContext(), appData);
      const appID = result.appID;
      
      // Act - Change to confidential
      await ctx.commands.changeOIDCAppToConfidential(
        ctx.createContext(),
        appID,
        orgID
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('application', appID);
      const configEvent = events.find(e => e.eventType === 'application.oidc.config.changed');
      expect(configEvent).toBeDefined();
      expect(configEvent!.payload!.oidcAppType).toBe(OIDCAppType.WEB);
      expect(configEvent!.payload!.authMethodType).toBe(OIDCAuthMethodType.BASIC);
      
      console.log('✓ Changed to confidential client successfully');
    });

    it('should fail if already confidential', async () => {
      // Arrange - App is already WEB (confidential)
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act & Assert
      await expect(
        ctx.commands.changeOIDCAppToConfidential(
          ctx.createContext(),
          appID,
          orgID
        )
      ).rejects.toThrow('application is already confidential');
      
      console.log('✓ Failed as expected - already confidential');
    });
  });

  describe('changeOIDCAppToPublic', () => {
    it('should change confidential app to public', async () => {
      // Arrange - App is WEB (confidential)
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act - Change to public
      await ctx.commands.changeOIDCAppToPublic(
        ctx.createContext(),
        appID,
        orgID
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('application', appID);
      const configEvent = events.find(e => e.eventType === 'application.oidc.config.changed');
      expect(configEvent).toBeDefined();
      expect(configEvent!.payload!.oidcAppType).toBe(OIDCAppType.USER_AGENT);
      expect(configEvent!.payload!.authMethodType).toBe(OIDCAuthMethodType.NONE);
      
      console.log('✓ Changed to public client successfully');
    });

    it('should fail if already public', async () => {
      // Arrange - Create public app
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appData = {
        projectID,
        orgID,
        name: `Test Public App ${Date.now()}`,
        oidcAppType: OIDCAppType.USER_AGENT,
        redirectURIs: ['https://example.com/callback'],
        responseTypes: ['code'],
        grantTypes: ['authorization_code'],
      };
      const result = await ctx.commands.addOIDCApp(ctx.createContext(), appData);
      const appID = result.appID;
      
      // Act & Assert
      await expect(
        ctx.commands.changeOIDCAppToPublic(
          ctx.createContext(),
          appID,
          orgID
        )
      ).rejects.toThrow('application is already public');
      
      console.log('✓ Failed as expected - already public');
    });
  });

  // ============================================================================
  // Complete Lifecycle Tests
  // ============================================================================

  describe('Complete OIDC Config Lifecycle', () => {
    it('should complete full redirect URI lifecycle', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act - Add 2 URIs
      await ctx.commands.addOIDCRedirectURI(
        ctx.createContext(),
        appID,
        orgID,
        'https://example.com/callback2'
      );
      await ctx.commands.addOIDCRedirectURI(
        ctx.createContext(),
        appID,
        orgID,
        'https://example.com/callback3'
      );
      
      // Remove one URI
      await ctx.commands.removeOIDCRedirectURI(
        ctx.createContext(),
        appID,
        orgID,
        'https://example.com/callback2'
      );
      
      // Process projections
      await processProjections();
      
      // Assert - Final state should have 2 URIs
      const events = await ctx.getEvents('application', appID);
      const configEvents = events.filter(e => e.eventType === 'application.oidc.config.changed');
      const lastEvent = configEvents[configEvents.length - 1];
      expect(lastEvent.payload!.redirectURIs).toHaveLength(2);
      expect(lastEvent.payload!.redirectURIs).toContain('https://example.com/callback');
      expect(lastEvent.payload!.redirectURIs).toContain('https://example.com/callback3');
      
      console.log('✓ Complete redirect URI lifecycle successful');
    });

    it('should complete client type switching lifecycle', async () => {
      // Arrange - Start with confidential
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestOIDCApp(projectID, orgID);
      
      // Act - Switch to public
      await ctx.commands.changeOIDCAppToPublic(
        ctx.createContext(),
        appID,
        orgID
      );
      
      // Switch back to confidential
      await ctx.commands.changeOIDCAppToConfidential(
        ctx.createContext(),
        appID,
        orgID
      );
      
      // Process projections
      await processProjections();
      
      // Assert - Should be confidential again
      const events = await ctx.getEvents('application', appID);
      const configEvents = events.filter(e => e.eventType === 'application.oidc.config.changed');
      const lastEvent = configEvents[configEvents.length - 1];
      expect(lastEvent.payload!.oidcAppType).toBe(OIDCAppType.WEB);
      expect(lastEvent.payload!.authMethodType).toBe(OIDCAuthMethodType.BASIC);
      
      console.log('✓ Client type switching lifecycle successful');
    });
  });
});
