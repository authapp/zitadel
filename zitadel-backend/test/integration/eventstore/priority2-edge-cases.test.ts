import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import {
  Command,
  Reducer,
  Event,
  newAddEventUniqueConstraint,
  UniqueConstraintViolationError,
} from '../../../src/lib/eventstore';

describe('Integration: Priority 2 Edge Cases', () => {
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

  describe('Large Payload Handling', () => {
    it('should handle events with large payloads (1MB)', async () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB string

      const command: Command = {
        instanceID: 'test-instance',
        aggregateType: 'document',
        aggregateID: 'doc-1',
        eventType: 'document.created',
        payload: { content: largeData, size: largeData.length },
        creator: 'admin',
        owner: 'org-1',
      };

      const events = await eventstore.pushMany([command]);
      expect(events).toHaveLength(1);
      expect(events[0].payload?.content).toHaveLength(1024 * 1024);
    });

    it('should handle reducer with large payloads efficiently', async () => {
      const commands: Command[] = Array.from({ length: 10 }, (_, i) => ({
        instanceID: 'test-instance',
        aggregateType: 'document',
        aggregateID: `doc-${i}`,
        eventType: 'document.created',
        payload: { content: 'x'.repeat(100 * 1024), index: i }, // 100KB each
        creator: 'admin',
        owner: 'org-1',
      }));

      await eventstore.pushMany(commands);

      class CountingReducer implements Reducer {
        public count = 0;
        appendEvents(...events: Event[]): void {
          this.count += events.length;
        }
        async reduce(): Promise<void> {}
      }

      const reducer = new CountingReducer();
      await eventstore.filterToReducer(
        { instanceID: 'test-instance', aggregateTypes: ['document'] },
        reducer
      );

      expect(reducer.count).toBe(10);
    });
  });

  describe('Special Characters and SQL Injection', () => {
    it('should handle SQL injection attempts in unique constraints', async () => {
      const maliciousUsername = `'; DROP TABLE users--`;

      const command: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-1',
        eventType: 'user.added',
        payload: { username: maliciousUsername },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', maliciousUsername, 'Username exists'),
        ],
      };

      const events = await eventstore.pushMany([command]);
      expect(events).toHaveLength(1);

      // Try to add duplicate - should be prevented by constraint
      const duplicate: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-2',
        eventType: 'user.added',
        payload: { username: maliciousUsername },
        creator: 'admin',
        owner: 'org-1',
        uniqueConstraints: [
          newAddEventUniqueConstraint('user_username', maliciousUsername, 'Username exists'),
        ],
      };

      await expect(eventstore.pushMany([duplicate])).rejects.toThrow(
        UniqueConstraintViolationError
      );

      // Verify table still exists (wasn't dropped)
      const allEvents = await eventstore.query({ instanceID: 'test-instance' });
      expect(allEvents).toHaveLength(1);
    });

    it('should handle special characters in event payloads', async () => {
      const specialChars = [
        { name: 'single-quote', value: "O'Brien" },
        { name: 'double-quote', value: 'He said "hello"' },
        { name: 'backslash', value: 'C:\\Users\\test' },
        { name: 'newline', value: 'Line 1\nLine 2' },
        { name: 'tab', value: 'Col1\tCol2' },
        { name: 'semicolon', value: 'cmd1; cmd2' },
        { name: 'percent', value: '100% complete' },
        { name: 'ampersand', value: 'Tom & Jerry' },
      ];

      for (const test of specialChars) {
        const command: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${test.name}`,
          eventType: 'user.added',
          payload: { username: test.value },
          creator: 'admin',
          owner: 'org-1',
        };

        const events = await eventstore.pushMany([command]);
        expect(events[0].payload?.username).toBe(test.value);
      }
    });

    it('should reject null bytes in payloads (PostgreSQL limitation)', async () => {
      // PostgreSQL doesn't support null bytes in strings
      const command: Command = {
        instanceID: 'test-instance',
        aggregateType: 'user',
        aggregateID: 'user-nullbyte',
        eventType: 'user.added',
        payload: { username: 'test\x00data' },
        creator: 'admin',
        owner: 'org-1',
      };

      // Should throw error (PostgreSQL limitation)
      await expect(eventstore.pushMany([command])).rejects.toThrow();
    });
  });

  describe('Unicode and Emoji Support', () => {
    it('should handle Unicode characters in unique constraints', async () => {
      const unicodeUsernames = [
        '用户名', // Chinese
        'ユーザー', // Japanese
        '사용자', // Korean
        'Пользователь', // Russian
        'مستخدم', // Arabic
      ];

      for (const username of unicodeUsernames) {
        const command: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: `user-${username}`,
          eventType: 'user.added',
          payload: { username },
          creator: 'admin',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_username', username, 'Username exists'),
          ],
        };

        const events = await eventstore.pushMany([command]);
        expect(events[0].payload?.username).toBe(username);
      }
    });

    it('should handle emoji in event payloads', async () => {
      const emojiData = [
        { name: 'User', emoji: '👤' },
        { name: 'Success', emoji: '✅' },
        { name: 'Error', emoji: '❌' },
        { name: 'Heart', emoji: '❤️' },
        { name: 'Complex', emoji: '👨‍👩‍👧‍👦' }, // Family emoji (multi-codepoint)
      ];

      for (const test of emojiData) {
        const command: Command = {
          instanceID: 'test-instance',
          aggregateType: 'reaction',
          aggregateID: `reaction-${test.name}`,
          eventType: 'reaction.added',
          payload: { emoji: test.emoji, name: test.name },
          creator: 'admin',
          owner: 'org-1',
        };

        const events = await eventstore.pushMany([command]);
        expect(events[0].payload?.emoji).toBe(test.emoji);
      }

      // Verify all can be queried
      const allReactions = await eventstore.query({
        instanceID: 'test-instance',
        aggregateTypes: ['reaction'],
      });
      expect(allReactions).toHaveLength(emojiData.length);
    });
  });

  describe('Full Integration: All Features Together', () => {
    it('should work with unique constraints + reducer + latest position', async () => {
      // Scenario: User registration system with unique emails
      
      // 1. Add users with unique email constraints
      const users = [
        { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
        { id: 'user-2', email: 'bob@example.com', name: 'Bob' },
        { id: 'user-3', email: 'charlie@example.com', name: 'Charlie' },
      ];

      for (const user of users) {
        const command: Command = {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: user.id,
          eventType: 'user.registered',
          payload: { email: user.email, name: user.name },
          creator: 'system',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_email', user.email, 'Email already registered'),
          ],
        };

        await eventstore.pushMany([command]);
      }

      // 2. Get checkpoint for projection
      const checkpoint1 = await eventstore.latestPosition({
        instanceID: 'test-instance',
        aggregateTypes: ['user'],
      });

      expect(checkpoint1.position).toBeGreaterThan(0);

      // 3. Build projection with reducer
      class UserProjection implements Reducer {
        public users: Map<string, any> = new Map();
        private buffer: Event[] = [];

        appendEvents(...events: Event[]): void {
          this.buffer.push(...events);
        }

        async reduce(): Promise<void> {
          for (const event of this.buffer) {
            if (event.eventType === 'user.registered') {
              this.users.set(event.aggregateID, event.payload);
            }
          }
          this.buffer = [];
        }
      }

      const projection = new UserProjection();
      await eventstore.filterToReducer(
        { instanceID: 'test-instance', aggregateTypes: ['user'] },
        projection
      );

      expect(projection.users.size).toBe(3);
      expect(projection.users.get('user-1')?.email).toBe('alice@example.com');

      // 4. Try to register with duplicate email (should fail)
      await expect(
        eventstore.pushMany([
          {
            instanceID: 'test-instance',
            aggregateType: 'user',
            aggregateID: 'user-4',
            eventType: 'user.registered',
            payload: { email: 'alice@example.com', name: 'Alice Clone' },
            creator: 'system',
            owner: 'org-1',
            uniqueConstraints: [
              newAddEventUniqueConstraint(
                'user_email',
                'alice@example.com',
                'Email already registered'
              ),
            ],
          },
        ])
      ).rejects.toThrow(UniqueConstraintViolationError);

      // 5. Add more users after checkpoint
      await eventstore.pushMany([
        {
          instanceID: 'test-instance',
          aggregateType: 'user',
          aggregateID: 'user-5',
          eventType: 'user.registered',
          payload: { email: 'dave@example.com', name: 'Dave' },
          creator: 'system',
          owner: 'org-1',
          uniqueConstraints: [
            newAddEventUniqueConstraint('user_email', 'dave@example.com', 'Email already registered'),
          ],
        },
      ]);

      // 6. Catch up from checkpoint
      const newEvents = await eventstore.eventsAfterPosition(checkpoint1);
      expect(newEvents).toHaveLength(1);
      expect(newEvents[0].payload?.email).toBe('dave@example.com');

      // 7. Update projection with new events
      projection.appendEvents(...newEvents);
      await projection.reduce();

      expect(projection.users.size).toBe(4);
      expect(projection.users.get('user-5')?.email).toBe('dave@example.com');
    });

    it('should handle complex multi-tenant scenario', async () => {
      // Scenario: Two organizations with separate user namespaces
      
      const org1Users = [
        { id: 'org1-user-1', username: 'john', org: 'org-1' },
        { id: 'org1-user-2', username: 'jane', org: 'org-1' },
      ];

      const org2Users = [
        { id: 'org2-user-1', username: 'john', org: 'org-2' }, // Same username, different org
        { id: 'org2-user-2', username: 'jane', org: 'org-2' },
      ];

      // Add org1 users
      for (const user of org1Users) {
        await eventstore.pushMany([
          {
            instanceID: 'test-instance',
            aggregateType: 'user',
            aggregateID: user.id,
            eventType: 'user.added',
            payload: { username: user.username },
            creator: 'admin',
            owner: user.org,
            uniqueConstraints: [
              newAddEventUniqueConstraint(
                `user_username_${user.org}`,
                user.username,
                'Username exists in org'
              ),
            ],
          },
        ]);
      }

      // Add org2 users (same usernames, different org)
      for (const user of org2Users) {
        await eventstore.pushMany([
          {
            instanceID: 'test-instance',
            aggregateType: 'user',
            aggregateID: user.id,
            eventType: 'user.added',
            payload: { username: user.username },
            creator: 'admin',
            owner: user.org,
            uniqueConstraints: [
              newAddEventUniqueConstraint(
                `user_username_${user.org}`,
                user.username,
                'Username exists in org'
              ),
            ],
          },
        ]);
      }

      // Verify: Can query by owner
      const org1Events = await eventstore.query({
        instanceID: 'test-instance',
        owner: 'org-1',
      });
      expect(org1Events).toHaveLength(2);

      const org2Events = await eventstore.query({
        instanceID: 'test-instance',
        owner: 'org-2',
      });
      expect(org2Events).toHaveLength(2);

      // Verify: Latest position per org
      const org1Position = await eventstore.latestPosition({
        instanceID: 'test-instance',
        owner: 'org-1',
      });
      const org2Position = await eventstore.latestPosition({
        instanceID: 'test-instance',
        owner: 'org-2',
      });

      expect(org1Position.position).toBeGreaterThan(0);
      expect(org2Position.position).toBeGreaterThan(0);
    });
  });
});
