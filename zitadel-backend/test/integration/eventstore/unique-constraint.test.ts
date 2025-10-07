import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import {
  Command,
  newAddEventUniqueConstraint,
  newRemoveUniqueConstraint,
  newAddGlobalUniqueConstraint,
  UniqueConstraintViolationError,
} from '../../../src/lib/eventstore';

describe('Integration: Unique Constraints', () => {
  let eventstore: PostgresEventstore;
  let db: DatabasePool;

  beforeAll(async () => {
    db = await createTestDatabase();
    eventstore = new PostgresEventstore(db, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false, // Disable to prevent cross-test contamination
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    // Wait for any pending notifications to complete
    await new Promise(resolve => setImmediate(resolve));
  });

  afterEach(async () => {
    // Import and cleanup global subscription manager
    const { globalSubscriptionManager } = await import('../../../src/lib/eventstore/subscription');
    globalSubscriptionManager.closeAll();
    // Wait for cleanup
    await new Promise(resolve => setImmediate(resolve));
  });

  describe('Add Unique Constraint', () => {
    it('should add a unique constraint', async () => {
      const command: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.added',
        payload: { username: 'john' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', 'john', 'Username already exists'),
        ],
      };

      const events = await eventstore.pushMany([command]);
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('user.added');
    });

    it('should prevent duplicate unique constraints', async () => {
      const command1: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.added',
        payload: { username: 'john' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', 'john', 'Username already exists'),
        ],
      };

      const command2: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-2',
        eventType: 'user.added',
        payload: { username: 'john' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', 'john', 'Username already exists'),
        ],
      };

      // First command should succeed
      await eventstore.pushMany([command1]);

      // Second command should fail with constraint violation
      await expect(eventstore.pushMany([command2])).rejects.toThrow(
        UniqueConstraintViolationError
      );
    });

    it('should allow same value in different instances', async () => {
      const command1: Command = {
        instanceID: 'instance-1',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.added',
        payload: { username: 'john' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', 'john', 'Username already exists'),
        ],
      };

      const command2: Command = {
        instanceID: 'instance-2',
        aggregateType: 'user',
        aggregateID: 'user-2',
        eventType: 'user.added',
        payload: { username: 'john' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', 'john', 'Username already exists'),
        ],
      };

      // Both should succeed as they're in different instances
      await eventstore.pushMany([command1]);
      await eventstore.pushMany([command2]);
    });
  });

  describe('Global Unique Constraint', () => {
    it('should prevent duplicate global constraints across instances', async () => {
      const command1: Command = {
        instanceID: 'instance-1',
        aggregateType: 'system',
        aggregateID: 'config-1',
        eventType: 'config.set',
        payload: { key: 'api_key' },
        creator: 'admin',
        owner: 'system',
        uniqueConstraints: [
          newAddGlobalUniqueConstraint('system_config', 'api_key', 'Config already exists'),
        ],
      };

      const command2: Command = {
        instanceID: 'instance-2',
        aggregateType: 'system',
        aggregateID: 'config-2',
        eventType: 'config.set',
        payload: { key: 'api_key' },
        creator: 'admin',
        owner: 'system',
        uniqueConstraints: [
          newAddGlobalUniqueConstraint('system_config', 'api_key', 'Config already exists'),
        ],
      };

      // First command should succeed
      await eventstore.pushMany([command1]);

      // Second command should fail even though different instance
      await expect(eventstore.pushMany([command2])).rejects.toThrow(
        UniqueConstraintViolationError
      );
    });
  });

  describe('Remove Unique Constraint', () => {
    it('should remove a unique constraint and allow reuse', async () => {
      const addCommand: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.added',
        payload: { username: 'john' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', 'john', 'Username already exists'),
        ],
      };

      const removeCommand: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.removed',
        payload: null,
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [newRemoveUniqueConstraint('user_username', 'john')],
      };

      const reuseCommand: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-2',
        eventType: 'user.added',
        payload: { username: 'john' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', 'john', 'Username already exists'),
        ],
      };

      // Add constraint
      await eventstore.pushMany([addCommand]);

      // Remove constraint
      await eventstore.pushMany([removeCommand]);

      // Should now be able to reuse the value
      const events = await eventstore.pushMany([reuseCommand]);
      expect(events).toHaveLength(1);
    });
  });

  describe('Multiple Constraints', () => {
    it('should handle multiple constraints in single command', async () => {
      const command: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.added',
        payload: { username: 'john', email: 'john@example.com' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', 'john', 'Username already exists'),
          newAddEventUniqueConstraint(
            'user_email',
            'john@example.com',
            'Email already exists'
          ),
        ],
      };

      const events = await eventstore.pushMany([command]);
      expect(events).toHaveLength(1);

      // Try to violate username constraint
      const command2: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-2',
        eventType: 'user.added',
        payload: { username: 'john', email: 'jane@example.com' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', 'john', 'Username already exists'),
        ],
      };

      await expect(eventstore.pushMany([command2])).rejects.toThrow(
        UniqueConstraintViolationError
      );
    });
  });

  describe('Custom Error Messages', () => {
    it('should use custom error message on violation', async () => {
      const command1: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.added',
        payload: { username: 'john' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint(
            'user_username',
            'john',
            'Errors.User.Username.AlreadyExists'
          ),
        ],
      };

      const command2: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-2',
        eventType: 'user.added',
        payload: { username: 'john' },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint(
            'user_username',
            'john',
            'Errors.User.Username.AlreadyExists'
          ),
        ],
      };

      await eventstore.pushMany([command1]);

      await expect(eventstore.pushMany([command2])).rejects.toThrow(
        'Errors.User.Username.AlreadyExists'
      );
    });
  });

  describe('Priority 1 Edge Cases', () => {
    describe('Empty and Null Values', () => {
      it('should handle empty string as unique field', async () => {
        const command1: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: '' },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', '', 'Empty username exists'),
          ],
        };

        const command2: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: '' },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', '', 'Empty username exists'),
          ],
        };

        await eventstore.pushMany([command1]);
        await expect(eventstore.pushMany([command2])).rejects.toThrow(
          UniqueConstraintViolationError
        );
      });

      it('should handle whitespace-only values', async () => {
        const command1: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: '   ' },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', '   ', 'Whitespace username exists'),
          ],
        };

        const command2: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: '   ' },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', '   ', 'Whitespace username exists'),
          ],
        };

        await eventstore.pushMany([command1]);
        await expect(eventstore.pushMany([command2])).rejects.toThrow(
          UniqueConstraintViolationError
        );
      });
    });

    describe('Case Sensitivity', () => {
      it('should treat different cases as different values (case-sensitive)', async () => {
        const commands: Command[] = [
          {
            instanceID: 'test-instance',
            aggregateType: 'user',
            aggregateID: 'user-1',
            eventType: 'user.added',
            payload: { username: 'John' },
            creator: 'admin',
            owner: 'org-1',
            uniqueConstraints: [
              newAddEventUniqueConstraint('user_username', 'John', 'Username exists'),
            ],
          },
          {
            instanceID: 'test-instance',
            aggregateType: 'user',
            aggregateID: 'user-2',
            eventType: 'user.added',
            payload: { username: 'john' },
            creator: 'admin',
            owner: 'org-1',
            uniqueConstraints: [
              newAddEventUniqueConstraint('user_username', 'john', 'Username exists'),
            ],
          },
          {
            instanceID: 'test-instance',
            aggregateType: 'user',
            aggregateID: 'user-3',
            eventType: 'user.added',
            payload: { username: 'JOHN' },
            creator: 'admin',
            owner: 'org-1',
            uniqueConstraints: [
              newAddEventUniqueConstraint('user_username', 'JOHN', 'Username exists'),
            ],
          },
        ];

        // All should succeed (case-sensitive)
        for (const command of commands) {
          await eventstore.pushMany([command]);
        }

        // But exact match should fail
        const duplicate: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-4',
          eventType: 'user.added',
          payload: { username: 'John' },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', 'John', 'Username exists'),
          ],
        };

        await expect(eventstore.pushMany([duplicate])).rejects.toThrow(
          UniqueConstraintViolationError
        );
      });
    });

    describe('Transaction Rollback', () => {
      it('should rollback constraint if event insert fails', async () => {
        const command: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', 'john', 'Username exists'),
          ],
        };

        // First insert should succeed
        await eventstore.pushMany([command]);

        // Try to insert duplicate - should fail due to aggregate version conflict
        await expect(
          eventstore.pushWithConcurrencyCheck([command], 0)
        ).rejects.toThrow();

        // Constraint should still exist (was not rolled back)
        const duplicate: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', 'john', 'Username exists'),
          ],
        };

        await expect(eventstore.pushMany([duplicate])).rejects.toThrow(
          UniqueConstraintViolationError
        );
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle concurrent constraint additions gracefully', async () => {
        const command1: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'concurrent' },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', 'concurrent', 'Username exists'),
          ],
        };

        const command2: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'concurrent' },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', 'concurrent', 'Username exists'),
          ],
        };

        // Try to add both concurrently - one should succeed, one should fail
        const results = await Promise.allSettled([
          eventstore.pushMany([command1]),
          eventstore.pushMany([command2]),
        ]);

        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);

        // Check that the failure is due to constraint violation
        const failedResult = failures[0] as PromiseRejectedResult;
        expect(failedResult.reason).toBeInstanceOf(UniqueConstraintViolationError);
      });
    });
  });
});
