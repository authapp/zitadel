/**
 * Instance Flow Commands Integration Tests - Fully Isolated
 * Tests instance-level flow management (applies across all organizations)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { Action } from '../../../src/lib/domain/action';
import { FlowType, TriggerType } from '../../../src/lib/domain/flow';
import { InstanceActionProjection } from '../../../src/lib/query/projections/instance-action-projection';
import { InstanceFlowProjection } from '../../../src/lib/query/projections/instance-flow-projection';
import { ActionQueries } from '../../../src/lib/query/action/action-queries';

describe('Instance Flow Commands Integration Tests (E2E)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let actionProjection: InstanceActionProjection;
  let flowProjection: InstanceFlowProjection;
  let queries: ActionQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projections and queries
    actionProjection = new InstanceActionProjection(ctx.eventstore, pool);
    await actionProjection.init();
    flowProjection = new InstanceFlowProjection(ctx.eventstore, pool);
    await flowProjection.init();
    queries = new ActionQueries(pool);
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  afterAll(async () => {
    await pool.close();
  });

  /**
   * Helper: Process projections
   */
  async function processProjections(): Promise<void> {
    const events = await ctx.getEvents('*', '*');
    for (const event of events) {
      await actionProjection.reduce(event);
      await flowProjection.reduce(event);
    }
  }

  /**
   * Helper: Create test action
   */
  async function createTestAction(name: string): Promise<string> {
    const action: Action = {
      name,
      script: `function execute(ctx) { console.log("${name}"); return ctx; }`,
      timeout: 5000,
      allowedToFail: false,
    };

    const result = await ctx.commands.addInstanceAction(
      ctx.createContext(),
      action
    );

    return result.id;
  }

  describe('setInstanceTriggerActions', () => {
    describe('Success Cases', () => {
      it('should set actions for instance flow trigger (E2E)', async () => {
        const actionID1 = await createTestAction('Instance Security Check');
        const actionID2 = await createTestAction('Instance Audit Log');

        // 1. Execute command
        const result = await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.PRE_CREATION,
          [actionID1, actionID2]
        );

        expect(result).toBeDefined();

        // 2. Verify event
        const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
        const setEvent = events.find(e => e.eventType === 'instance.trigger.actions.set');
        expect(setEvent).toBeDefined();
        expect(setEvent!.payload).toMatchObject({
          flowType: FlowType.EXTERNAL_AUTHENTICATION,
          triggerType: TriggerType.PRE_CREATION,
          actionIDs: [actionID1, actionID2],
        });

        // 3. Process projections
        await processProjections();

        // 4. Verify via query layer
        const triggerActions = await queries.getTriggerActions(
          ctx.createContext().instanceID,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.PRE_CREATION,
          ctx.createContext().instanceID // Instance-level (resourceOwner = instanceID)
        );

        expect(triggerActions).toEqual([actionID1, actionID2]);

        console.log('✓ E2E verified: Command → Event → Projection → Query');
      });

      it('should update existing trigger actions', async () => {
        const actionID1 = await createTestAction('Action 1');
        const actionID2 = await createTestAction('Action 2');
        const actionID3 = await createTestAction('Action 3');

        // Set initial actions
        await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.INTERNAL_AUTHENTICATION,
          TriggerType.POST_CREATION,
          [actionID1, actionID2]
        );

        // Update to different actions
        await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.INTERNAL_AUTHENTICATION,
          TriggerType.POST_CREATION,
          [actionID2, actionID3] // Different set
        );

        const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
        const setEvents = events.filter(e => e.eventType === 'instance.trigger.actions.set');
        expect(setEvents).toHaveLength(2);
      });

      it('should set empty array to clear trigger', async () => {
        const actionID = await createTestAction('Temporary Action');

        // Set action
        await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.CUSTOMISE_TOKEN,
          TriggerType.PRE_ACCESS_TOKEN_CREATION,
          [actionID]
        );

        // Clear with empty array
        await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.CUSTOMISE_TOKEN,
          TriggerType.PRE_ACCESS_TOKEN_CREATION,
          []
        );

        const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
        const lastSetEvent = events.filter(e => e.eventType === 'instance.trigger.actions.set').pop();
        expect(lastSetEvent!.payload!.actionIDs).toEqual([]);
      });
    });

    describe('Error Cases', () => {
      it('should fail with invalid flow type', async () => {
        const actionID = await createTestAction('Test Action');

        await expect(
          ctx.commands.setInstanceTriggerActions(
            ctx.createContext(),
            999 as FlowType, // Invalid
            TriggerType.PRE_CREATION,
            [actionID]
          )
        ).rejects.toThrow(/invalid flow type/);
      });

      it('should fail with invalid trigger type', async () => {
        const actionID = await createTestAction('Test Action');

        await expect(
          ctx.commands.setInstanceTriggerActions(
            ctx.createContext(),
            FlowType.EXTERNAL_AUTHENTICATION,
            999 as TriggerType, // Invalid
            [actionID]
          )
        ).rejects.toThrow(/invalid trigger type/);
      });

      it('should fail with incompatible flow/trigger combination', async () => {
        const actionID = await createTestAction('Test Action');

        // PRE_ACCESS_TOKEN_CREATION doesn't work with EXTERNAL_AUTHENTICATION
        await expect(
          ctx.commands.setInstanceTriggerActions(
            ctx.createContext(),
            FlowType.EXTERNAL_AUTHENTICATION,
            TriggerType.PRE_ACCESS_TOKEN_CREATION,
            [actionID]
          )
        ).rejects.toThrow(/trigger type not valid for this flow type/);
      });

      it('should fail when no changes detected (idempotency)', async () => {
        const actionID = await createTestAction('Same Action');

        // Set actions
        await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.INTERNAL_AUTHENTICATION,
          TriggerType.PRE_CREATION,
          [actionID]
        );

        // Try to set same actions again
        await expect(
          ctx.commands.setInstanceTriggerActions(
            ctx.createContext(),
            FlowType.INTERNAL_AUTHENTICATION,
            TriggerType.PRE_CREATION,
            [actionID]
          )
        ).rejects.toThrow(/no changes to instance trigger actions/);
      });
    });
  });

  describe('clearInstanceFlow', () => {
    describe('Success Cases', () => {
      it('should clear all triggers from instance flow (E2E)', async () => {
        const actionID1 = await createTestAction('Clear Action 1');
        const actionID2 = await createTestAction('Clear Action 2');

        // Set actions on multiple triggers
        await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.PRE_CREATION,
          [actionID1]
        );

        await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_CREATION,
          [actionID2]
        );

        // Clear the flow
        await ctx.commands.clearInstanceFlow(
          ctx.createContext(),
          FlowType.EXTERNAL_AUTHENTICATION
        );

        const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
        const clearEvent = events.find(e => e.eventType === 'instance.flow.cleared');
        expect(clearEvent).toBeDefined();
        expect(clearEvent!.payload!.flowType).toBe(FlowType.EXTERNAL_AUTHENTICATION);

        // Process projections
        await processProjections();

        // Verify via query layer - should be empty
        const trigger1Actions = await queries.getTriggerActions(
          ctx.createContext().instanceID,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.PRE_CREATION,
          ctx.createContext().instanceID
        );

        const trigger2Actions = await queries.getTriggerActions(
          ctx.createContext().instanceID,
          FlowType.EXTERNAL_AUTHENTICATION,
          TriggerType.POST_CREATION,
          ctx.createContext().instanceID
        );

        expect(trigger1Actions).toEqual([]);
        expect(trigger2Actions).toEqual([]);

        console.log('✓ E2E verified: Flow cleared in query layer');
      });
    });

    describe('Error Cases', () => {
      it('should fail clearing empty flow', async () => {
        await expect(
          ctx.commands.clearInstanceFlow(
            ctx.createContext(),
            FlowType.CUSTOMIZE_SAML_RESPONSE
          )
        ).rejects.toThrow(/instance flow is already empty/);
      });

      it('should fail with invalid flow type', async () => {
        await expect(
          ctx.commands.clearInstanceFlow(
            ctx.createContext(),
            999 as FlowType
          )
        ).rejects.toThrow(/invalid flow type/);
      });
    });
  });

  describe('removeInstanceActionFromTrigger', () => {
    describe('Success Cases', () => {
      it('should remove specific action from trigger (E2E)', async () => {
        const actionID1 = await createTestAction('Keep Action');
        const actionID2 = await createTestAction('Remove Action');
        const actionID3 = await createTestAction('Also Keep');

        // Set multiple actions
        await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.INTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          [actionID1, actionID2, actionID3]
        );

        // Remove one action
        await ctx.commands.removeInstanceActionFromTrigger(
          ctx.createContext(),
          FlowType.INTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          actionID2
        );

        // Verify remaining actions via event
        const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
        const lastSetEvent = events.filter(e => e.eventType === 'instance.trigger.actions.set').pop();
        expect(lastSetEvent!.payload!.actionIDs).toEqual([actionID1, actionID3]);

        // Process projections
        await processProjections();

        // Verify via query layer
        const triggerActions = await queries.getTriggerActions(
          ctx.createContext().instanceID,
          FlowType.INTERNAL_AUTHENTICATION,
          TriggerType.POST_AUTHENTICATION,
          ctx.createContext().instanceID
        );

        expect(triggerActions).toEqual([actionID1, actionID3]);

        console.log('✓ E2E verified: Action removal reflected in query layer');
      });
    });

    describe('Error Cases', () => {
      it('should fail removing non-existent action from trigger', async () => {
        const actionID = await createTestAction('Existing Action');

        await ctx.commands.setInstanceTriggerActions(
          ctx.createContext(),
          FlowType.CUSTOMISE_TOKEN,
          TriggerType.PRE_USERINFO_CREATION,
          [actionID]
        );

        await expect(
          ctx.commands.removeInstanceActionFromTrigger(
            ctx.createContext(),
            FlowType.CUSTOMISE_TOKEN,
            TriggerType.PRE_USERINFO_CREATION,
            'non-existent-action-id'
          )
        ).rejects.toThrow(/action not found in trigger/);
      });
    });
  });

  describe('Complete Lifecycle Tests', () => {
    it('complete flow lifecycle: set → update → remove → clear', async () => {
      const actionID1 = await createTestAction('Lifecycle Action 1');
      const actionID2 = await createTestAction('Lifecycle Action 2');
      const actionID3 = await createTestAction('Lifecycle Action 3');

      // 1. Set initial actions
      await ctx.commands.setInstanceTriggerActions(
        ctx.createContext(),
        FlowType.EXTERNAL_AUTHENTICATION,
        TriggerType.PRE_CREATION,
        [actionID1, actionID2]
      );

      // 2. Update to add more actions
      await ctx.commands.setInstanceTriggerActions(
        ctx.createContext(),
        FlowType.EXTERNAL_AUTHENTICATION,
        TriggerType.PRE_CREATION,
        [actionID1, actionID2, actionID3]
      );

      // 3. Remove one action
      await ctx.commands.removeInstanceActionFromTrigger(
        ctx.createContext(),
        FlowType.EXTERNAL_AUTHENTICATION,
        TriggerType.PRE_CREATION,
        actionID2
      );

      // 4. Clear entire flow
      await ctx.commands.clearInstanceFlow(
        ctx.createContext(),
        FlowType.EXTERNAL_AUTHENTICATION
      );

      // Verify event sequence
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const flowEvents = events.filter(e => 
        e.eventType === 'instance.trigger.actions.set' || 
        e.eventType === 'instance.flow.cleared'
      );
      expect(flowEvents.length).toBeGreaterThanOrEqual(4);
    });

    it('multi-trigger flow configuration', async () => {
      const preAction = await createTestAction('Pre-Creation Security');
      const postAction = await createTestAction('Post-Creation Audit');
      const authAction = await createTestAction('Post-Auth Logging');

      // Configure multiple triggers in same flow
      await ctx.commands.setInstanceTriggerActions(
        ctx.createContext(),
        FlowType.INTERNAL_AUTHENTICATION,
        TriggerType.PRE_CREATION,
        [preAction]
      );

      await ctx.commands.setInstanceTriggerActions(
        ctx.createContext(),
        FlowType.INTERNAL_AUTHENTICATION,
        TriggerType.POST_CREATION,
        [postAction]
      );

      await ctx.commands.setInstanceTriggerActions(
        ctx.createContext(),
        FlowType.INTERNAL_AUTHENTICATION,
        TriggerType.POST_AUTHENTICATION,
        [authAction]
      );

      // Verify all configured
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const setEvents = events.filter(e => e.eventType === 'instance.trigger.actions.set');
      expect(setEvents).toHaveLength(3);
    });

    it('instance-wide enforcement scenario', async () => {
      // Create mandatory security checks for all organizations
      const securityScan = await createTestAction('Mandatory Security Scan');
      const complianceCheck = await createTestAction('GDPR Compliance Check');

      // Set on login flow (applies to ALL orgs)
      await ctx.commands.setInstanceTriggerActions(
        ctx.createContext(),
        FlowType.INTERNAL_AUTHENTICATION,
        TriggerType.POST_AUTHENTICATION,
        [securityScan, complianceCheck]
      );

      // These actions would execute before ANY user authentication
      // across all organizations in the instance
      const events = await ctx.getEvents('instance', ctx.createContext().instanceID);
      const setEvent = events.find(e => e.eventType === 'instance.trigger.actions.set');
      expect(setEvent!.owner).toBe(ctx.createContext().instanceID);
      expect(setEvent!.payload!.actionIDs).toHaveLength(2);
    });
  });
});
