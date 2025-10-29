/**
 * Action Commands Integration Tests
 * Tests action lifecycle using command APIs and query models
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { ActionsProjection } from '../../../src/lib/query/projections/actions-projection';
import { ActionQueries } from '../../../src/lib/query/action/action-queries';
import { ActionState } from '../../../src/lib/domain/action';

describe('Action Commands Integration Tests', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let actionsProjection: ActionsProjection;
  let actionQueries: ActionQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    actionsProjection = new ActionsProjection(ctx.eventstore, pool);
    await actionsProjection.init();
    
    // Initialize query layer
    actionQueries = new ActionQueries(pool);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  /**
   * Helper: Process projections
   */
  async function processProjections(): Promise<void> {
    const events = await ctx.getEvents('*', '*');
    for (const event of events) {
      await actionsProjection.reduce(event);
    }
  }

  /**
   * Helper: Create test organization
   */
  async function createTestOrg() {
    const org = await ctx.commands.addOrg(ctx.createContext(), {
      name: `Test Org ${Date.now()}`,
    });
    return org;
  }

  describe('addAction', () => {
    describe('Success Cases', () => {
      it('should add action and verify via query layer', async () => {
        const org = await createTestOrg();

        console.log('\n--- Adding action ---');
        const result = await ctx.commands.addAction(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Test Action',
            script: 'console.log("Hello from action");',
            timeout: 5000,
            allowedToFail: false,
          }
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();

        // Verify event
        const event = await ctx.assertEventPublished('action.added');
        expect(event.payload).toHaveProperty('name', 'Test Action');
        expect(event.payload).toHaveProperty('script', 'console.log("Hello from action");');

        // Process projection
        await processProjections();
        
        // Verify via query layer
        const action = await actionQueries.getActionByID('test-instance', result.id);
        expect(action).not.toBeNull();
        expect(action!.name).toBe('Test Action');
        expect(action!.script).toBe('console.log("Hello from action");');
        expect(action!.timeout).toBe(5000);
        expect(action!.allowedToFail).toBe(false);
        expect(action!.state).toBe(ActionState.ACTIVE);

        console.log(`✓ Action verified via query layer`);
      });

      it('should allow multiple actions in same org', async () => {
        const org = await createTestOrg();

        const result1 = await ctx.commands.addAction(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Action 1',
            script: 'script1',
            timeout: 5000,
            allowedToFail: false,
          }
        );

        const result2 = await ctx.commands.addAction(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Action 2',
            script: 'script2',
            timeout: 10000,
            allowedToFail: true,
          }
        );

        expect(result1.id).not.toBe(result2.id);

        await processProjections();

        const action1 = await actionQueries.getActionByID('test-instance', result1.id);
        const action2 = await actionQueries.getActionByID('test-instance', result2.id);

        expect(action1!.name).toBe('Action 1');
        expect(action2!.name).toBe('Action 2');
      });

      it('should handle allowed to fail flag', async () => {
        const org = await createTestOrg();

        const result = await ctx.commands.addAction(
          ctx.createContext(),
          org.orgID,
          {
            name: 'Fault Tolerant Action',
            script: 'mayFail()',
            timeout: 30000,
            allowedToFail: true,
          }
        );

        await processProjections();

        const action = await actionQueries.getActionByID('test-instance', result.id);
        expect(action!.allowedToFail).toBe(true);
      });
    });

    describe('Error Cases', () => {
      it('should fail with empty name', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addAction(
            ctx.createContext(),
            org.orgID,
            {
              name: '',
              script: 'script',
              timeout: 5000,
              allowedToFail: false,
            }
          )
        ).rejects.toThrow();
      });

      it('should fail with empty script', async () => {
        const org = await createTestOrg();

        await expect(
          ctx.commands.addAction(
            ctx.createContext(),
            org.orgID,
            {
              name: 'Test',
              script: '',
              timeout: 5000,
              allowedToFail: false,
            }
          )
        ).rejects.toThrow();
      });

      it('should fail with empty orgID', async () => {
        await expect(
          ctx.commands.addAction(
            ctx.createContext(),
            '',
            {
              name: 'Test',
              script: 'script',
              timeout: 5000,
              allowedToFail: false,
            }
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('changeAction', () => {
    it('should update action properties', async () => {
      const org = await createTestOrg();

      const result = await ctx.commands.addAction(
        ctx.createContext(),
        org.orgID,
        {
          name: 'Original Name',
          script: 'originalScript()',
          timeout: 5000,
          allowedToFail: false,
        }
      );

      // Don't clear events - we need them for the write model to load
      // await ctx.clearEvents();

      await ctx.commands.changeAction(
        ctx.createContext(),
        org.orgID,
        result.id,
        {
          name: 'Updated Name',
          script: 'updatedScript()',
          timeout: 10000,
          allowedToFail: true,
        }
      );

      const event = await ctx.assertEventPublished('action.changed');
      expect(event.payload).toHaveProperty('name', 'Updated Name');

      await processProjections();

      const action = await actionQueries.getActionByID('test-instance', result.id);
      expect(action!.name).toBe('Updated Name');
      expect(action!.script).toBe('updatedScript()');
      expect(action!.timeout).toBe(10000);
      expect(action!.allowedToFail).toBe(true);
    });
  });

  describe('deactivateAction and reactivateAction', () => {
    it('should deactivate and reactivate action', async () => {
      const org = await createTestOrg();

      const result = await ctx.commands.addAction(
        ctx.createContext(),
        org.orgID,
        {
          name: 'Toggle Action',
          script: 'toggle()',
          timeout: 5000,
          allowedToFail: false,
        }
      );

      await processProjections();

      // Deactivate
      await ctx.commands.deactivateAction(ctx.createContext(), org.orgID, result.id);
      await processProjections();

      let action = await actionQueries.getActionByID('test-instance', result.id);
      expect(action!.state).toBe(ActionState.INACTIVE);

      // Reactivate
      await ctx.commands.reactivateAction(ctx.createContext(), org.orgID, result.id);
      await processProjections();

      action = await actionQueries.getActionByID('test-instance', result.id);
      expect(action!.state).toBe(ActionState.ACTIVE);
    });
  });

  describe('deleteAction', () => {
    it('should delete action', async () => {
      const org = await createTestOrg();

      const result = await ctx.commands.addAction(
        ctx.createContext(),
        org.orgID,
        {
          name: 'To Be Removed',
          script: 'remove()',
          timeout: 5000,
          allowedToFail: false,
        }
      );

      await processProjections();

      await ctx.commands.deleteAction(ctx.createContext(), org.orgID, result.id);
      await processProjections();

      const action = await actionQueries.getActionByID('test-instance', result.id);
      expect(action).toBeNull();
    });
  });

  describe('Complete Action Lifecycle', () => {
    it('should handle full action lifecycle: add → change → deactivate → reactivate → delete', async () => {
      const org = await createTestOrg();

      // 1. Add
      console.log('Step 1: Add action');
      const result = await ctx.commands.addAction(
        ctx.createContext(),
        org.orgID,
        {
          name: 'Lifecycle Action',
          script: 'lifecycle()',
          timeout: 5000,
          allowedToFail: false,
        }
      );
      await processProjections();

      let action = await actionQueries.getActionByID('test-instance', result.id);
      expect(action!.state).toBe(ActionState.ACTIVE);

      // 2. Change
      console.log('Step 2: Update action');
      await ctx.commands.changeAction(
        ctx.createContext(),
        org.orgID,
        result.id,
        {
          name: 'Updated Lifecycle Action',
          script: 'updatedLifecycle()',
          timeout: 10000,
          allowedToFail: true,
        }
      );
      await processProjections();

      action = await actionQueries.getActionByID('test-instance', result.id);
      expect(action!.name).toBe('Updated Lifecycle Action');

      // 3. Deactivate
      console.log('Step 3: Deactivate action');
      await ctx.commands.deactivateAction(ctx.createContext(), org.orgID, result.id);
      await processProjections();

      action = await actionQueries.getActionByID('test-instance', result.id);
      expect(action!.state).toBe(ActionState.INACTIVE);

      // 4. Reactivate
      console.log('Step 4: Reactivate action');
      await ctx.commands.reactivateAction(ctx.createContext(), org.orgID, result.id);
      await processProjections();

      action = await actionQueries.getActionByID('test-instance', result.id);
      expect(action!.state).toBe(ActionState.ACTIVE);

      // 5. Delete
      console.log('Step 5: Delete action');
      await ctx.commands.deleteAction(ctx.createContext(), org.orgID, result.id);
      await processProjections();

      action = await actionQueries.getActionByID('test-instance', result.id);
      expect(action).toBeNull();

      console.log('✓ Complete action lifecycle successful');
    });
  });
});
