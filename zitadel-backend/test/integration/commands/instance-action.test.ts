/**
 * Instance Action Commands Integration Tests - Fully Isolated
 * Tests instance-level action management (applies across all organizations)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { Action } from '../../../src/lib/domain/action';

describe('Instance Action Commands Integration Tests (Isolated)', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  /**
   * Helper: Create test action
   */
  function createTestAction(name: string): Action {
    return {
      name,
      script: `function execute(ctx) { console.log("${name}"); return ctx; }`,
      timeout: 5000,
      allowedToFail: false,
    };
  }

  describe('addInstanceAction', () => {
    describe('Success Cases', () => {
      it('should create instance action with auto-generated ID', async () => {
        const action = createTestAction('Instance Action 1');

        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.details).toBeDefined();

        // Verify event
        const events = await ctx.getEvents('instance_action', result.id);
        const addEvent = events.find(e => e.eventType === 'instance.action.added');
        expect(addEvent).toBeDefined();
        expect(addEvent!.payload).toMatchObject({
          name: action.name,
          script: action.script,
          timeout: action.timeout,
          allowedToFail: action.allowedToFail,
        });
      });

      it('should create instance action with specific ID', async () => {
        const action = createTestAction('Instance Action 2');
        const actionID = await ctx.commands.generateID();

        const result = await ctx.commands.addInstanceActionWithID(
          ctx.createContext(),
          actionID,
          action
        );

        expect(result.id).toBe(actionID);

        const events = await ctx.getEvents('instance_action', actionID);
        expect(events.find(e => e.eventType === 'instance.action.added')).toBeDefined();
      });

      it('should create instance action with allowedToFail=true', async () => {
        const action = createTestAction('Fault Tolerant Action');
        action.allowedToFail = true;

        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        const events = await ctx.getEvents('instance_action', result.id);
        const addEvent = events.find(e => e.eventType === 'instance.action.added');
        expect(addEvent!.payload!.allowedToFail).toBe(true);
      });
    });

    describe('Error Cases', () => {
      it('should fail with invalid action (empty name)', async () => {
        const action = createTestAction('');

        await expect(
          ctx.commands.addInstanceAction(
            ctx.createContext(),
            action
          )
        ).rejects.toThrow(/action is invalid/);
      });

      it('should fail adding duplicate action with same ID', async () => {
        const action = createTestAction('Duplicate Action');
        const actionID = await ctx.commands.generateID();

        // Add once
        await ctx.commands.addInstanceActionWithID(
          ctx.createContext(),
          actionID,
          action
        );

        // Try to add again with same ID
        await expect(
          ctx.commands.addInstanceActionWithID(
            ctx.createContext(),
            actionID,
            action
          )
        ).rejects.toThrow(/instance action already exists/);
      });
    });
  });

  describe('changeInstanceAction', () => {
    describe('Success Cases', () => {
      it('should update instance action successfully', async () => {
        // Create action
        const action = createTestAction('Original Name');
        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        // Update action
        const updatedAction = createTestAction('Updated Name');
        updatedAction.timeout = 10000;

        await ctx.commands.changeInstanceAction(
          ctx.createContext(),
          result.id,
          updatedAction
        );

        // Verify event
        const events = await ctx.getEvents('instance_action', result.id);
        const changeEvent = events.find(e => e.eventType === 'instance.action.changed');
        expect(changeEvent).toBeDefined();
        expect(changeEvent!.payload).toMatchObject({
          name: 'Updated Name',
          oldName: 'Original Name',
          timeout: 10000,
        });
      });

      it('should handle idempotent updates (no changes)', async () => {
        const action = createTestAction('Same Action');
        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        // Update with same values
        const updateResult = await ctx.commands.changeInstanceAction(
          ctx.createContext(),
          result.id,
          action
        );

        expect(updateResult).toBeDefined();

        // Should not create new event
        const events = await ctx.getEvents('instance_action', result.id);
        const changeEvents = events.filter(e => e.eventType === 'instance.action.changed');
        expect(changeEvents).toHaveLength(0);
      });
    });

    describe('Error Cases', () => {
      it('should fail updating non-existent action', async () => {
        const action = createTestAction('Non-existent');

        await expect(
          ctx.commands.changeInstanceAction(
            ctx.createContext(),
            'non-existent-id',
            action
          )
        ).rejects.toThrow(/instance action not found/);
      });
    });
  });

  describe('deactivateInstanceAction', () => {
    describe('Success Cases', () => {
      it('should deactivate instance action', async () => {
        const action = createTestAction('Action to Deactivate');
        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        await ctx.commands.deactivateInstanceAction(
          ctx.createContext(),
          result.id
        );

        const events = await ctx.getEvents('instance_action', result.id);
        const deactivateEvent = events.find(e => e.eventType === 'instance.action.deactivated');
        expect(deactivateEvent).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail deactivating non-existent action', async () => {
        await expect(
          ctx.commands.deactivateInstanceAction(
            ctx.createContext(),
            'non-existent-id'
          )
        ).rejects.toThrow(/instance action not found/);
      });

      it('should fail deactivating already inactive action', async () => {
        const action = createTestAction('Already Inactive');
        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        // Deactivate once
        await ctx.commands.deactivateInstanceAction(
          ctx.createContext(),
          result.id
        );

        // Try to deactivate again
        await expect(
          ctx.commands.deactivateInstanceAction(
            ctx.createContext(),
            result.id
          )
        ).rejects.toThrow(/instance action is not active/);
      });
    });
  });

  describe('reactivateInstanceAction', () => {
    describe('Success Cases', () => {
      it('should reactivate deactivated instance action', async () => {
        const action = createTestAction('Action to Reactivate');
        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        // Deactivate first
        await ctx.commands.deactivateInstanceAction(
          ctx.createContext(),
          result.id
        );

        // Reactivate
        await ctx.commands.reactivateInstanceAction(
          ctx.createContext(),
          result.id
        );

        const events = await ctx.getEvents('instance_action', result.id);
        const reactivateEvent = events.find(e => e.eventType === 'instance.action.reactivated');
        expect(reactivateEvent).toBeDefined();
      });
    });

    describe('Error Cases', () => {
      it('should fail reactivating active action', async () => {
        const action = createTestAction('Already Active');
        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        await expect(
          ctx.commands.reactivateInstanceAction(
            ctx.createContext(),
            result.id
          )
        ).rejects.toThrow(/instance action is not inactive/);
      });
    });
  });

  describe('deleteInstanceAction', () => {
    describe('Success Cases', () => {
      it('should delete instance action', async () => {
        const action = createTestAction('Action to Delete');
        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        await ctx.commands.deleteInstanceAction(
          ctx.createContext(),
          result.id
        );

        const events = await ctx.getEvents('instance_action', result.id);
        const removeEvent = events.find(e => e.eventType === 'instance.action.removed');
        expect(removeEvent).toBeDefined();
        expect(removeEvent!.payload).toMatchObject({
          name: action.name,
        });
      });

      it('should delete with cascade removal from flows', async () => {
        const action = createTestAction('Action with Cascades');
        const result = await ctx.commands.addInstanceAction(
          ctx.createContext(),
          action
        );

        // Delete with flow types
        await ctx.commands.deleteInstanceAction(
          ctx.createContext(),
          result.id,
          [1, 2] // Flow types
        );

        const events = await ctx.getEvents('instance_action', result.id);
        expect(events).toHaveLength(3); // removed + 2 cascade events
      });
    });

    describe('Error Cases', () => {
      it('should fail deleting non-existent action', async () => {
        await expect(
          ctx.commands.deleteInstanceAction(
            ctx.createContext(),
            'non-existent-id'
          )
        ).rejects.toThrow(/instance action not found/);
      });
    });
  });

  describe('Complete Lifecycle Tests', () => {
    it('complete lifecycle: add → change → deactivate → reactivate → delete', async () => {
      // 1. Add
      const action = createTestAction('Lifecycle Action');
      const result = await ctx.commands.addInstanceAction(
        ctx.createContext(),
        action
      );

      // 2. Change
      const updatedAction = createTestAction('Updated Lifecycle Action');
      await ctx.commands.changeInstanceAction(
        ctx.createContext(),
        result.id,
        updatedAction
      );

      // 3. Deactivate
      await ctx.commands.deactivateInstanceAction(
        ctx.createContext(),
        result.id
      );

      // 4. Reactivate
      await ctx.commands.reactivateInstanceAction(
        ctx.createContext(),
        result.id
      );

      // 5. Delete
      await ctx.commands.deleteInstanceAction(
        ctx.createContext(),
        result.id
      );

      // Verify event sequence
      const events = await ctx.getEvents('instance_action', result.id);
      expect(events).toHaveLength(5);
      expect(events[0].eventType).toBe('instance.action.added');
      expect(events[1].eventType).toBe('instance.action.changed');
      expect(events[2].eventType).toBe('instance.action.deactivated');
      expect(events[3].eventType).toBe('instance.action.reactivated');
      expect(events[4].eventType).toBe('instance.action.removed');
    });

    it('instance-wide application scenario', async () => {
      // Create compliance action that applies to all orgs
      const complianceAction = createTestAction('GDPR Compliance Check');
      complianceAction.allowedToFail = false; // Must succeed

      const result = await ctx.commands.addInstanceAction(
        ctx.createContext(),
        complianceAction
      );

      expect(result.id).toBeDefined();

      // This action would be enforced on all organizations
      // Verify it's created at instance level
      const events = await ctx.getEvents('instance_action', result.id);
      const addEvent = events.find(e => e.eventType === 'instance.action.added');
      expect(addEvent!.owner).toBe(ctx.createContext().instanceID);
    });
  });
});
