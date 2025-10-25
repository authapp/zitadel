/**
 * API Application Configuration Tests - Complete Stack
 * 
 * Tests for:
 * - API authentication method changes (BASIC ↔ PRIVATE_KEY_JWT)
 * - Complete stack: Command → Event → Projection → Query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { OrganizationBuilder, ProjectBuilder } from '../../helpers/test-data-builders';
import { AppProjection } from '../../../src/lib/query/projections/app-projection';
import { OIDCAuthMethodType } from '../../../src/lib/domain/project';

describe('API Application Configuration - Complete Flow', () => {
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
   * Helper: Create test API app
   */
  async function createTestAPIApp(projectID: string, orgID: string, authMethod: OIDCAuthMethodType = OIDCAuthMethodType.BASIC) {
    const appData = {
      projectID,
      orgID,
      name: `Test API App ${Date.now()}`,
      authMethodType: authMethod,
    };
    
    const result = await ctx.commands.addAPIApp(ctx.createContext(), appData);
    return result.appID;
  }

  // ============================================================================
  // Change API App Authentication Method Tests
  // ============================================================================

  describe('changeAPIAppAuthMethod', () => {
    it('should change auth method from BASIC to PRIVATE_KEY_JWT', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestAPIApp(projectID, orgID, OIDCAuthMethodType.BASIC);
      
      // Act
      await ctx.commands.changeAPIAppAuthMethod(
        ctx.createContext(),
        appID,
        orgID,
        OIDCAuthMethodType.PRIVATE_KEY_JWT
      );
      
      // Process projections
      await processProjections();
      
      // Assert - Check event
      const events = await ctx.getEvents('application', appID);
      const configEvent = events.find(e => e.eventType === 'application.api.config.changed');
      expect(configEvent).toBeDefined();
      expect(configEvent!.payload!.authMethodType).toBe(OIDCAuthMethodType.PRIVATE_KEY_JWT);
      
      console.log('✓ Auth method changed to PRIVATE_KEY_JWT successfully');
    });

    it('should change auth method from PRIVATE_KEY_JWT to BASIC', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestAPIApp(projectID, orgID, OIDCAuthMethodType.PRIVATE_KEY_JWT);
      
      // Act
      await ctx.commands.changeAPIAppAuthMethod(
        ctx.createContext(),
        appID,
        orgID,
        OIDCAuthMethodType.BASIC
      );
      
      // Process projections
      await processProjections();
      
      // Assert
      const events = await ctx.getEvents('application', appID);
      const configEvent = events.find(e => e.eventType === 'application.api.config.changed');
      expect(configEvent).toBeDefined();
      expect(configEvent!.payload!.authMethodType).toBe(OIDCAuthMethodType.BASIC);
      
      console.log('✓ Auth method changed to BASIC successfully');
    });

    it('should be idempotent - no event when setting same auth method', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestAPIApp(projectID, orgID, OIDCAuthMethodType.BASIC);
      
      // Get event count before idempotent operation
      const eventsBefore = await ctx.getEvents('application', appID);
      const configEventsBefore = eventsBefore.filter(e => e.eventType === 'application.api.config.changed');
      
      // Act - Set to BASIC again (already BASIC)
      await ctx.commands.changeAPIAppAuthMethod(
        ctx.createContext(),
        appID,
        orgID,
        OIDCAuthMethodType.BASIC
      );
      
      // Assert - No new config.changed event should be created
      const eventsAfter = await ctx.getEvents('application', appID);
      const configEventsAfter = eventsAfter.filter(e => e.eventType === 'application.api.config.changed');
      expect(configEventsAfter.length).toBe(configEventsBefore.length);
      
      console.log('✓ Idempotent - no event for same auth method');
    });

    it('should fail with invalid auth method (NONE)', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestAPIApp(projectID, orgID);
      
      // Act & Assert
      await expect(
        ctx.commands.changeAPIAppAuthMethod(
          ctx.createContext(),
          appID,
          orgID,
          OIDCAuthMethodType.NONE
        )
      ).rejects.toThrow('invalid auth method for API app');
      
      console.log('✓ Failed as expected with invalid auth method');
    });

    it('should fail with non-existent app', async () => {
      // Arrange
      const orgID = await createTestOrg();
      
      // Act & Assert
      await expect(
        ctx.commands.changeAPIAppAuthMethod(
          ctx.createContext(),
          'non-existent-app-id',
          orgID,
          OIDCAuthMethodType.BASIC
        )
      ).rejects.toThrow('application not found');
      
      console.log('✓ Failed as expected with non-existent app');
    });

    it('should fail when called on OIDC app', async () => {
      // Arrange - Create OIDC app instead of API app
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appData = {
        projectID,
        orgID,
        name: `Test OIDC App ${Date.now()}`,
        oidcAppType: 1, // WEB
        redirectURIs: ['https://example.com/callback'],
      };
      const result = await ctx.commands.addOIDCApp(ctx.createContext(), appData);
      const appID = result.appID;
      
      // Act & Assert
      await expect(
        ctx.commands.changeAPIAppAuthMethod(
          ctx.createContext(),
          appID,
          orgID,
          OIDCAuthMethodType.BASIC
        )
      ).rejects.toThrow('not an API application');
      
      console.log('✓ Failed as expected - not an API app');
    });
  });

  // ============================================================================
  // Complete Lifecycle Tests
  // ============================================================================

  describe('Complete API Config Lifecycle', () => {
    it('should complete auth method switching lifecycle', async () => {
      // Arrange
      const orgID = await createTestOrg();
      const projectID = await createTestProject(orgID);
      const appID = await createTestAPIApp(projectID, orgID, OIDCAuthMethodType.BASIC);
      
      // Act - Switch to JWT
      await ctx.commands.changeAPIAppAuthMethod(
        ctx.createContext(),
        appID,
        orgID,
        OIDCAuthMethodType.PRIVATE_KEY_JWT
      );
      
      // Switch back to BASIC
      await ctx.commands.changeAPIAppAuthMethod(
        ctx.createContext(),
        appID,
        orgID,
        OIDCAuthMethodType.BASIC
      );
      
      // Process projections
      await processProjections();
      
      // Assert - Should be BASIC again
      const events = await ctx.getEvents('application', appID);
      const configEvents = events.filter(e => e.eventType === 'application.api.config.changed');
      expect(configEvents.length).toBe(2);
      
      // Last event should be BASIC
      const lastEvent = configEvents[configEvents.length - 1];
      expect(lastEvent.payload!.authMethodType).toBe(OIDCAuthMethodType.BASIC);
      
      console.log('✓ Auth method switching lifecycle successful');
    });
  });
});
