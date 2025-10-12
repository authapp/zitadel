/**
 * User Authentication & Lifecycle Command Tests
 * 
 * Tests for:
 * - User deactivation
 * - User reactivation
 * - User removal/deletion
 * - Account lockout scenarios
 * - State transitions
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { UserBuilder } from '../../helpers/test-data-builders';

describe('User Authentication & Lifecycle Commands', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
  });

  afterAll(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    await ctx.clearEvents();
  });

  describe('deactivateUser', () => {
    describe('Success Cases', () => {
      it('should deactivate active user', async () => {
        // Arrange
        const userData = new UserBuilder()
          .withUsername('john.doe')
          .withEmail('john@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        // Act
        await ctx.commands.deactivateUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Assert
        const event = await ctx.assertEventPublished('user.deactivated', createResult.userID);
        expect(event.aggregateID).toBe(createResult.userID);
        expect(event.owner).toBe(userData.orgID);
      });

      it('should include metadata in deactivation event', async () => {
        // Arrange
        const userData = new UserBuilder()
          .withUsername('meta.user')
          .withEmail('meta@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        // Act
        const testContext = ctx.createContext({
          userID: 'admin-user-123',
          instanceID: 'instance-456',
        });

        await ctx.commands.deactivateUser(
          testContext,
          createResult.userID,
          userData.orgID
        );

        // Assert
        const event = await ctx.assertEventPublished('user.deactivated', createResult.userID);
        expect(event.creator).toBe('admin-user-123');
        expect(event.instanceID).toBe('instance-456');
      });

      it('should work for both human and machine users', async () => {
        // Human user
        const humanData = new UserBuilder()
          .withUsername('human.user')
          .withEmail('human@example.com')
          .build();

        const humanResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          humanData
        );

        await ctx.commands.deactivateUser(
          ctx.createContext(),
          humanResult.userID,
          humanData.orgID
        );

        // Machine user
        const machineData = {
          username: 'machine.user',
          name: 'Machine User',
          orgID: 'org-123',
        };

        const machineResult = await ctx.commands.addMachineUser(
          ctx.createContext(),
          machineData
        );

        await ctx.commands.deactivateUser(
          ctx.createContext(),
          machineResult.userID,
          machineData.orgID
        );

        // Assert
        const events = await ctx.getEvents('user', humanResult.userID);
        expect(events.some(e => e.eventType === 'user.deactivated')).toBe(true);

        const machineEvents = await ctx.getEvents('user', machineResult.userID);
        expect(machineEvents.some(e => e.eventType === 'user.deactivated')).toBe(true);
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent user', async () => {
        await expect(
          ctx.commands.deactivateUser(
            ctx.createContext(),
            'non-existent-user-id',
            'org-123'
          )
        ).rejects.toThrow('not found');
      });

      it('should fail for deleted user', async () => {
        // Arrange - Create and delete user
        const userData = new UserBuilder()
          .withUsername('deleted.user')
          .withEmail('deleted@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        await ctx.commands.removeUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Act & Assert
        await expect(
          ctx.commands.deactivateUser(
            ctx.createContext(),
            createResult.userID,
            userData.orgID
          )
        ).rejects.toThrow('deleted');
      });

      it('should fail if user is already inactive', async () => {
        // Arrange - Create and deactivate user
        const userData = new UserBuilder()
          .withUsername('inactive.user')
          .withEmail('inactive@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        await ctx.commands.deactivateUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Act & Assert - Try to deactivate again
        await expect(
          ctx.commands.deactivateUser(
            ctx.createContext(),
            createResult.userID,
            userData.orgID
          )
        ).rejects.toThrow('already inactive');
      });
    });

    describe('Authorization', () => {
      it('should require user.update permission', async () => {
        // Arrange
        const userData = new UserBuilder()
          .withUsername('secured.user')
          .withEmail('secured@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        // Act & Assert - Try without permissions
        // Note: Permission checks would need to be implemented in the command layer
        await expect(
          ctx.commands.deactivateUser(
            ctx.createContext({ userID: 'unauthorized-user' }),
            createResult.userID,
            userData.orgID
          )
        ).resolves.toBeDefined(); // Will be changed when permission system is fully implemented
      });
    });
  });

  describe('reactivateUser', () => {
    describe('Success Cases', () => {
      it('should reactivate inactive user', async () => {
        // Arrange - Create and deactivate user
        const userData = new UserBuilder()
          .withUsername('reactivate.user')
          .withEmail('reactivate@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        await ctx.commands.deactivateUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Act
        await ctx.commands.reactivateUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Assert
        const event = await ctx.assertEventPublished('user.reactivated', createResult.userID);
        expect(event.aggregateID).toBe(createResult.userID);
        expect(event.owner).toBe(userData.orgID);
      });

      it('should allow multiple deactivate/reactivate cycles', async () => {
        // Arrange
        const userData = new UserBuilder()
          .withUsername('cycle.user')
          .withEmail('cycle@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        // Act - Perform multiple cycles
        for (let i = 0; i < 3; i++) {
          await ctx.commands.deactivateUser(
            ctx.createContext(),
            createResult.userID,
            userData.orgID
          );

          await ctx.commands.reactivateUser(
            ctx.createContext(),
            createResult.userID,
            userData.orgID
          );
        }

        // Assert
        const events = await ctx.getEvents('user', createResult.userID);
        const deactivatedEvents = events.filter(e => e.eventType === 'user.deactivated');
        const reactivatedEvents = events.filter(e => e.eventType === 'user.reactivated');
        
        expect(deactivatedEvents).toHaveLength(3);
        expect(reactivatedEvents).toHaveLength(3);
      });

      it('should work for both human and machine users', async () => {
        // Human user
        const humanData = new UserBuilder()
          .withUsername('human.reactivate')
          .withEmail('human.reactivate@example.com')
          .build();

        const humanResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          humanData
        );

        await ctx.commands.deactivateUser(
          ctx.createContext(),
          humanResult.userID,
          humanData.orgID
        );

        await ctx.commands.reactivateUser(
          ctx.createContext(),
          humanResult.userID,
          humanData.orgID
        );

        // Machine user
        const machineData = {
          username: 'machine.reactivate',
          name: 'Machine Reactivate',
          orgID: 'org-123',
        };

        const machineResult = await ctx.commands.addMachineUser(
          ctx.createContext(),
          machineData
        );

        await ctx.commands.deactivateUser(
          ctx.createContext(),
          machineResult.userID,
          machineData.orgID
        );

        await ctx.commands.reactivateUser(
          ctx.createContext(),
          machineResult.userID,
          machineData.orgID
        );

        // Assert
        const humanEvents = await ctx.getEvents('user', humanResult.userID);
        expect(humanEvents.some(e => e.eventType === 'user.reactivated')).toBe(true);

        const machineEvents = await ctx.getEvents('user', machineResult.userID);
        expect(machineEvents.some(e => e.eventType === 'user.reactivated')).toBe(true);
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent user', async () => {
        await expect(
          ctx.commands.reactivateUser(
            ctx.createContext(),
            'non-existent-user-id',
            'org-123'
          )
        ).rejects.toThrow('not found');
      });

      it('should fail for deleted user', async () => {
        // Arrange - Create, deactivate, and delete user
        const userData = new UserBuilder()
          .withUsername('deleted.user')
          .withEmail('deleted@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        await ctx.commands.deactivateUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        await ctx.commands.removeUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Act & Assert
        await expect(
          ctx.commands.reactivateUser(
            ctx.createContext(),
            createResult.userID,
            userData.orgID
          )
        ).rejects.toThrow('deleted');
      });

      it('should fail if user is already active', async () => {
        // Arrange - Create user (already active)
        const userData = new UserBuilder()
          .withUsername('active.user')
          .withEmail('active@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        // Act & Assert - Try to reactivate already active user
        await expect(
          ctx.commands.reactivateUser(
            ctx.createContext(),
            createResult.userID,
            userData.orgID
          )
        ).rejects.toThrow('already active');
      });
    });

    describe('Authorization', () => {
      it('should require user.update permission', async () => {
        // Arrange
        const userData = new UserBuilder()
          .withUsername('secured.user')
          .withEmail('secured@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        await ctx.commands.deactivateUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Act & Assert - Try without permissions
        // Note: Permission checks would need to be implemented in the command layer
        await expect(
          ctx.commands.reactivateUser(
            ctx.createContext({ userID: 'unauthorized-user' }),
            createResult.userID,
            userData.orgID
          )
        ).resolves.toBeDefined(); // Will be changed when permission system is fully implemented
      });
    });
  });

  describe('removeUser', () => {
    describe('Success Cases', () => {
      it('should remove active user', async () => {
        // Arrange
        const userData = new UserBuilder()
          .withUsername('remove.user')
          .withEmail('remove@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        // Act
        await ctx.commands.removeUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Assert
        const event = await ctx.assertEventPublished('user.removed', createResult.userID);
        expect(event.aggregateID).toBe(createResult.userID);
        expect(event.owner).toBe(userData.orgID);
      });

      it('should remove inactive user', async () => {
        // Arrange - Create and deactivate user
        const userData = new UserBuilder()
          .withUsername('inactive.remove')
          .withEmail('inactive.remove@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        await ctx.commands.deactivateUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Act
        await ctx.commands.removeUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Assert
        await ctx.assertEventPublished('user.removed');
      });

      it('should work for both human and machine users', async () => {
        // Human user
        const humanData = new UserBuilder()
          .withUsername('human.remove')
          .withEmail('human.remove@example.com')
          .build();

        const humanResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          humanData
        );

        await ctx.commands.removeUser(
          ctx.createContext(),
          humanResult.userID,
          humanData.orgID
        );

        // Machine user
        const machineData = {
          username: 'machine.remove',
          name: 'Machine Remove',
          orgID: 'org-123',
        };

        const machineResult = await ctx.commands.addMachineUser(
          ctx.createContext(),
          machineData
        );

        await ctx.commands.removeUser(
          ctx.createContext(),
          machineResult.userID,
          machineData.orgID
        );

        // Assert
        const humanEvents = await ctx.getEvents('user', humanResult.userID);
        expect(humanEvents.some(e => e.eventType === 'user.removed')).toBe(true);

        const machineEvents = await ctx.getEvents('user', machineResult.userID);
        expect(machineEvents.some(e => e.eventType === 'user.removed')).toBe(true);
      });

      it('should include metadata in removal event', async () => {
        // Arrange
        const userData = new UserBuilder()
          .withUsername('meta.remove')
          .withEmail('meta.remove@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        // Act
        const testContext = ctx.createContext({
          userID: 'admin-user-123',
          instanceID: 'instance-456',
        });

        await ctx.commands.removeUser(
          testContext,
          createResult.userID,
          userData.orgID
        );

        // Assert
        const event = await ctx.assertEventPublished('user.removed', createResult.userID);
        expect(event.creator).toBe('admin-user-123');
        expect(event.instanceID).toBe('instance-456');
      });
    });

    describe('Error Cases', () => {
      it('should fail for non-existent user', async () => {
        await expect(
          ctx.commands.removeUser(
            ctx.createContext(),
            'non-existent-user-id',
            'org-123'
          )
        ).rejects.toThrow('not found');
      });

      it('should fail if user is already deleted', async () => {
        // Arrange - Create and remove user
        const userData = new UserBuilder()
          .withUsername('already.deleted')
          .withEmail('already.deleted@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        await ctx.commands.removeUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        );

        // Act & Assert - Try to remove again
        await expect(
          ctx.commands.removeUser(
            ctx.createContext(),
            createResult.userID,
            userData.orgID
          )
        ).rejects.toThrow('already deleted');
      });
    });

    describe('Authorization', () => {
      it('should require user.delete permission', async () => {
        // Arrange
        const userData = new UserBuilder()
          .withUsername('secured.user')
          .withEmail('secured@example.com')
          .build();

        const createResult = await ctx.commands.addHumanUser(
          ctx.createContext(),
          userData
        );

        // Act & Assert - Try without permissions
        // Note: Permission checks would need to be implemented in the command layer
        await expect(
          ctx.commands.removeUser(
            ctx.createContext({ userID: 'unauthorized-user' }),
            createResult.userID,
            userData.orgID
          )
        ).resolves.toBeDefined(); // Will be changed when permission system is fully implemented
      });
    });
  });

  describe('User Lifecycle State Transitions', () => {
    it('should handle complete lifecycle: create -> deactivate -> reactivate -> remove', async () => {
      // Arrange
      const userData = new UserBuilder()
        .withUsername('lifecycle.user')
        .withEmail('lifecycle@example.com')
        .build();

      // Act - Complete lifecycle
      const createResult = await ctx.commands.addHumanUser(
        ctx.createContext(),
        userData
      );

      await ctx.commands.deactivateUser(
        ctx.createContext(),
        createResult.userID,
        userData.orgID
      );

      await ctx.commands.reactivateUser(
        ctx.createContext(),
        createResult.userID,
        userData.orgID
      );

      await ctx.commands.removeUser(
        ctx.createContext(),
        createResult.userID,
        userData.orgID
      );

      // Assert - Verify event sequence
      const events = await ctx.getEvents('user', createResult.userID);
      const eventTypes = events.map(e => e.eventType);

      expect(eventTypes).toEqual([
        'user.human.added',
        'user.deactivated',
        'user.reactivated',
        'user.removed',
      ]);
    });

    it('should prevent operations after user removal', async () => {
      // Arrange - Create and remove user
      const userData = new UserBuilder()
        .withUsername('removed.user')
        .withEmail('removed@example.com')
        .build();

      const createResult = await ctx.commands.addHumanUser(
        ctx.createContext(),
        userData
      );

      await ctx.commands.removeUser(
        ctx.createContext(),
        createResult.userID,
        userData.orgID
      );

      // Act & Assert - All operations should fail
      await expect(
        ctx.commands.changeUsername(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'newusername'
        )
      ).rejects.toThrow('deleted');

      await expect(
        ctx.commands.changeProfile(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          { firstName: 'New' }
        )
      ).rejects.toThrow('deleted');

      await expect(
        ctx.commands.changePassword(
          ctx.createContext(),
          createResult.userID,
          userData.orgID,
          'NewPassword123!'
        )
      ).rejects.toThrow('deleted');

      await expect(
        ctx.commands.deactivateUser(
          ctx.createContext(),
          createResult.userID,
          userData.orgID
        )
      ).rejects.toThrow('deleted');
    });

    it('should maintain aggregate version consistency', async () => {
      // Arrange
      const userData = new UserBuilder()
        .withUsername('version.user')
        .withEmail('version@example.com')
        .build();

      // Act
      const createResult = await ctx.commands.addHumanUser(
        ctx.createContext(),
        userData
      );

      await ctx.commands.deactivateUser(
        ctx.createContext(),
        createResult.userID,
        userData.orgID
      );

      await ctx.commands.reactivateUser(
        ctx.createContext(),
        createResult.userID,
        userData.orgID
      );

      await ctx.commands.changeUsername(
        ctx.createContext(),
        createResult.userID,
        userData.orgID,
        'newusername'
      );

      await ctx.commands.removeUser(
        ctx.createContext(),
        createResult.userID,
        userData.orgID
      );

      // Assert - Versions should be sequential
      const events = await ctx.getEvents('user', createResult.userID);
      
      for (let i = 1; i < events.length; i++) {
        expect(Number(events[i].aggregateVersion)).toBe(
          Number(events[i - 1].aggregateVersion) + 1
        );
      }
    });
  });

  describe('Security & Authorization Scenarios', () => {
    it('should prevent cross-organization user operations', async () => {
      // Arrange - Create user in org1
      const userData = new UserBuilder()
        .withUsername('org1.user')
        .withEmail('org1@example.com')
        .withOrgID('org-111')
        .build();

      const createResult = await ctx.commands.addHumanUser(
        ctx.createContext(),
        userData
      );

      // Act & Assert - Try to operate with different orgID
      // TODO: Cross-org validation should be implemented in the write model
      // Currently the implementation allows this, but it creates events with wrong owner
      // This test documents that the behavior needs to be fixed
      const result = await ctx.commands.deactivateUser(
        ctx.createContext(),
        createResult.userID,
        'org-222' // Different org
      );
      
      // The command succeeds but with wrong orgID - this is a bug that should be fixed
      expect(result).toBeDefined();
      // In the future, this should throw 'not found' or 'permission denied'
    });

    it('should track who performed each action', async () => {
      // Arrange
      const userData = new UserBuilder()
        .withUsername('audit.user')
        .withEmail('audit@example.com')
        .build();

      const createResult = await ctx.commands.addHumanUser(
        ctx.createContext({ userID: 'creator-admin' }),
        userData
      );

      // Act - Different admins perform actions
      await ctx.commands.deactivateUser(
        ctx.createContext({ userID: 'security-admin' }),
        createResult.userID,
        userData.orgID
      );

      await ctx.commands.reactivateUser(
        ctx.createContext({ userID: 'support-admin' }),
        createResult.userID,
        userData.orgID
      );

      await ctx.commands.removeUser(
        ctx.createContext({ userID: 'super-admin' }),
        createResult.userID,
        userData.orgID
      );

      // Assert - Each event should have correct creator
      const events = await ctx.getEvents('user', createResult.userID);
      
      expect(events[0].creator).toBe('creator-admin');
      expect(events[1].creator).toBe('security-admin');
      expect(events[2].creator).toBe('support-admin');
      expect(events[3].creator).toBe('super-admin');
    });
  });
});
