import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database/pool';
import { Command } from '../../../src/lib/eventstore';

describe('Integration: InstanceIDs Query', () => {
  let eventstore: PostgresEventstore;
  let db: DatabasePool;

  beforeAll(async () => {
    db = await createTestDatabase();
    eventstore = new PostgresEventstore(db, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  describe('instanceIDs', () => {
    it('should return empty array when no events exist', async () => {
      const instanceIDs = await eventstore.instanceIDs();
      expect(instanceIDs).toEqual([]);
    });

    it('should return single instance ID', async () => {
      const commands: Command[] = [
        {
          instanceID: 'instance-1',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-1',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const instanceIDs = await eventstore.instanceIDs();
      expect(instanceIDs).toEqual(['instance-1']);
    });

    it('should return multiple distinct instance IDs sorted', async () => {
      const commands: Command[] = [
        {
          instanceID: 'instance-3',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-1',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'admin',
          owner: 'org-2',
        },
        {
          instanceID: 'instance-2',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME' },
          creator: 'admin',
          owner: 'system',
        },
        {
          instanceID: 'instance-1',
          aggregateType: 'org',
          aggregateID: 'org-2',
          eventType: 'org.added',
          payload: { name: 'Corp' },
          creator: 'admin',
          owner: 'system',
        },
      ];

      await eventstore.pushMany(commands);

      const instanceIDs = await eventstore.instanceIDs();
      expect(instanceIDs).toEqual(['instance-1', 'instance-2', 'instance-3']);
    });

    it('should filter by aggregate types', async () => {
      const commands: Command[] = [
        {
          instanceID: 'instance-1',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-2',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME' },
          creator: 'admin',
          owner: 'system',
        },
        {
          instanceID: 'instance-3',
          aggregateType: 'project',
          aggregateID: 'project-1',
          eventType: 'project.added',
          payload: { name: 'Project A' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const instanceIDs = await eventstore.instanceIDs({
        aggregateTypes: ['user'],
      });

      expect(instanceIDs).toEqual(['instance-1']);
    });

    it('should filter by multiple aggregate types', async () => {
      const commands: Command[] = [
        {
          instanceID: 'instance-1',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-2',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME' },
          creator: 'admin',
          owner: 'system',
        },
        {
          instanceID: 'instance-3',
          aggregateType: 'project',
          aggregateID: 'project-1',
          eventType: 'project.added',
          payload: { name: 'Project A' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const instanceIDs = await eventstore.instanceIDs({
        aggregateTypes: ['user', 'org'],
      });

      expect(instanceIDs).toEqual(['instance-1', 'instance-2']);
    });

    it('should filter by event types', async () => {
      const commands: Command[] = [
        {
          instanceID: 'instance-1',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-2',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.updated',
          payload: { email: 'john@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-3',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.deleted',
          payload: null,
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const instanceIDs = await eventstore.instanceIDs({
        eventTypes: ['user.added', 'user.deleted'],
      });

      expect(instanceIDs).toEqual(['instance-1', 'instance-3']);
    });

    it('should filter by aggregate IDs', async () => {
      const commands: Command[] = [
        {
          instanceID: 'instance-1',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-2',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.added',
          payload: { username: 'jane' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-3',
          aggregateType: 'user',
          aggregateID: 'user-3',
          eventType: 'user.added',
          payload: { username: 'bob' },
          creator: 'admin',
          owner: 'org-1',
        },
      ];

      await eventstore.pushMany(commands);

      const instanceIDs = await eventstore.instanceIDs({
        aggregateIDs: ['user-1', 'user-3'],
      });

      expect(instanceIDs).toEqual(['instance-1', 'instance-3']);
    });

    it('should combine multiple filters (AND logic)', async () => {
      const commands: Command[] = [
        {
          instanceID: 'instance-1',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.added',
          payload: { username: 'john' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-2',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.updated',
          payload: { email: 'jane@example.com' },
          creator: 'admin',
          owner: 'org-1',
        },
        {
          instanceID: 'instance-3',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.added',
          payload: { name: 'ACME' },
          creator: 'admin',
          owner: 'system',
        },
      ];

      await eventstore.pushMany(commands);

      // Filter: aggregate_type=user AND event_type=user.added
      const instanceIDs = await eventstore.instanceIDs({
        aggregateTypes: ['user'],
        eventTypes: ['user.added'],
      });

      expect(instanceIDs).toEqual(['instance-1']);
    });
  });

  describe('Real-World Use Cases', () => {
    it('should support multi-tenant operations', async () => {
      // Scenario: Find all instances that have user events
      const commands: Command[] = [
        {
          instanceID: 'tenant-acme',
          aggregateType: 'user',
          aggregateID: 'user-1',
          eventType: 'user.registered',
          payload: { email: 'alice@acme.com' },
          creator: 'system',
          owner: 'acme',
        },
        {
          instanceID: 'tenant-corp',
          aggregateType: 'user',
          aggregateID: 'user-2',
          eventType: 'user.registered',
          payload: { email: 'bob@corp.com' },
          creator: 'system',
          owner: 'corp',
        },
        {
          instanceID: 'tenant-startup',
          aggregateType: 'org',
          aggregateID: 'org-1',
          eventType: 'org.created',
          payload: { name: 'Startup Inc' },
          creator: 'system',
          owner: 'startup',
        },
      ];

      await eventstore.pushMany(commands);

      // Get all tenants with user events
      const tenantsWithUsers = await eventstore.instanceIDs({
        aggregateTypes: ['user'],
      });

      expect(tenantsWithUsers).toEqual(['tenant-acme', 'tenant-corp']);
    });

    it('should enable tenant discovery for migrations', async () => {
      // Scenario: Find all tenants to apply a migration across
      const commands: Command[] = Array.from({ length: 10 }, (_, i) => ({
        instanceID: `tenant-${i}`,
        aggregateType: 'migration',
        aggregateID: 'migration-v1',
        eventType: 'migration.applied',
        payload: { version: 1 },
        creator: 'system',
        owner: `tenant-${i}`,
      }));

      await eventstore.pushMany(commands);

      const allTenants = await eventstore.instanceIDs();
      
      expect(allTenants).toHaveLength(10);
      expect(allTenants).toEqual([
        'tenant-0', 'tenant-1', 'tenant-2', 'tenant-3', 'tenant-4',
        'tenant-5', 'tenant-6', 'tenant-7', 'tenant-8', 'tenant-9',
      ]);
    });
  });
});
