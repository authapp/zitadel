import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { PostgresEventstore } from '../../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { InstanceProjection, createInstanceProjectionConfig } from '../../../../src/lib/query/projections/instance-projection';
import { InstanceDomainProjection, createInstanceDomainProjectionConfig } from '../../../../src/lib/query/projections/instance-domain-projection';
import { InstanceQueries } from '../../../../src/lib/query/instance/instance-queries';
import { Command } from '../../../../src/lib/eventstore';
import { generateId } from '../../../../src/lib/id';
import { waitForProjectionsCatchUp, delay } from '../../../helpers/projection-test-helpers';

describe('Instance Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let instanceQueries: InstanceQueries;

  beforeAll(async () => {
    // Setup database and run migrations (automatically provides clean state)
    pool = await createTestDatabase();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
      enableSubscriptions: true,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register instance projection with fast polling
    const instanceConfig = createInstanceProjectionConfig();
    instanceConfig.interval = 50; // Fast polling for tests
    const instanceProjection = new InstanceProjection(eventstore, pool);
    registry.register(instanceConfig, instanceProjection);

    // Register instance domain projection with fast polling
    const domainConfig = createInstanceDomainProjectionConfig();
    domainConfig.interval = 50; // Fast polling for tests
    const domainProjection = new InstanceDomainProjection(eventstore, pool);
    registry.register(domainConfig, domainProjection);
    
    // Start both projections once for all tests
    await Promise.all([
      registry.start('instance_projection'),
      registry.start('instance_domain_projection'),
    ]);

    instanceQueries = new InstanceQueries(pool);
    
    // Give projections time to start and establish subscriptions
    await delay(100);
  });

  afterAll(async () => {
    // Stop projections
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore
      }
    }
    
    await closeTestDatabase();
  });

  // Helper to wait for projections to process events
  const waitForEvents = async () => {
    await waitForProjectionsCatchUp(registry, eventstore, ['instance_projection', 'instance_domain_projection'], 8000);
  };

  describe('Instance Events', () => {
    it('should process instance.added event', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [{
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.added',
        payload: {
          instanceId: instanceID,
          name: 'Test Instance',
          defaultLanguage: 'en',
          features: {
            loginDefaultOrg: true,
            actions: true,
          },
        },
        creator: 'system',
        owner: instanceID,
      }];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const instance = await instanceQueries.getInstanceByID(instanceID);
      
      expect(instance).toBeTruthy();
      expect(instance!.id).toBe(instanceID);
      expect(instance!.name).toBe('Test Instance');
      expect(instance!.defaultLanguage).toBe('en');
      expect(instance!.state).toBe('active');
      expect(instance!.features).toEqual({
        loginDefaultOrg: true,
        actions: true,
      });
    }, 10000);

    it('should process instance.changed event', async () => {
      const instanceID = generateId();
      const defaultOrgID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'Original Name',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.changed',
          payload: {
            instanceId: instanceID,
            name: 'Updated Name',
            defaultOrgId: defaultOrgID,
            defaultLanguage: 'de',
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const instance = await instanceQueries.getInstanceByID(instanceID);
      
      expect(instance).toBeTruthy();
      expect(instance!.name).toBe('Updated Name');
      expect(instance!.defaultOrgID).toBe(defaultOrgID);
      expect(instance!.defaultLanguage).toBe('de');
    }, 10000);

    it('should process instance.removed event', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'To Be Removed',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.removed',
          payload: {
            instanceId: instanceID,
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const instance = await instanceQueries.getInstanceByID(instanceID);
      
      expect(instance).toBeTruthy();
      expect(instance!.state).toBe('removed');
    }, 10000);

    it('should process instance.features.set event', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'Feature Test',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.features.set',
          payload: {
            instanceId: instanceID,
            features: {
              loginDefaultOrg: true,
              tokenExchange: true,
              improvedPerformance: ['caching', 'indexing'],
            },
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const features = await instanceQueries.getInstanceFeatures(instanceID);
      
      expect(features).toBeTruthy();
      expect(features!.loginDefaultOrg).toBe(true);
      expect(features!.tokenExchange).toBe(true);
      expect(features!.improvedPerformance).toEqual(['caching', 'indexing']);
    }, 10000);
  });

  describe('Instance Domain Events', () => {
    it('should process instance.domain.added event', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'Domain Test',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.domain.added',
          payload: {
            domain: 'example.com',
            isPrimary: true,
            isGenerated: false,
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const instance = await instanceQueries.getInstanceByID(instanceID);
      
      expect(instance).toBeTruthy();
      expect(instance!.domains).toHaveLength(1);
      expect(instance!.domains[0].domain).toBe('example.com');
      expect(instance!.domains[0].isPrimary).toBe(true);
      expect(instance!.primaryDomain).toBe('example.com');
    }, 10000);

    it('should resolve instance by host', async () => {
      const instanceID = generateId();
      const domain = `test-${Date.now()}.example.com`;
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'Host Resolution Test',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.domain.added',
          payload: {
            domain,
            isPrimary: true,
            isGenerated: false,
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const instance = await instanceQueries.getInstanceByHost(domain);
      
      expect(instance).toBeTruthy();
      expect(instance!.id).toBe(instanceID);
      expect(instance!.name).toBe('Host Resolution Test');
    }, 10000);

    it('should process instance.domain.primary.set event', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'Primary Domain Test',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.domain.added',
          payload: {
            domain: 'first.com',
            isPrimary: true,
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.domain.added',
          payload: {
            domain: 'second.com',
            isPrimary: false,
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.domain.primary.set',
          payload: {
            domain: 'second.com',
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const instance = await instanceQueries.getInstanceByID(instanceID);
      
      expect(instance).toBeTruthy();
      expect(instance!.domains).toHaveLength(2);
      expect(instance!.primaryDomain).toBe('second.com');
      
      // Verify only one primary
      const primaryDomains = instance!.domains.filter(d => d.isPrimary);
      expect(primaryDomains).toHaveLength(1);
      expect(primaryDomains[0].domain).toBe('second.com');
    }, 10000);

    it('should process instance.domain.removed event', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'Domain Removal Test',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.domain.added',
          payload: {
            domain: 'remove-me.com',
            isPrimary: false,
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.domain.removed',
          payload: {
            domain: 'remove-me.com',
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const instance = await instanceQueries.getInstanceByID(instanceID);
      
      expect(instance).toBeTruthy();
      expect(instance!.domains).toHaveLength(0);
    }, 10000);
  });

  describe('Instance Trusted Domain Events', () => {
    it('should process instance.trusted_domain.added event', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'Trusted Domain Test',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.trusted_domain.added',
          payload: {
            domain: 'trusted.com',
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const result = await instanceQueries.searchInstanceTrustedDomains({
        instanceID,
      });
      
      expect(result.total).toBe(1);
      expect(result.domains[0].domain).toBe('trusted.com');
    }, 10000);

    it('should process instance.trusted_domain.removed event', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'Trusted Domain Removal',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.trusted_domain.added',
          payload: {
            domain: 'remove-trusted.com',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.trusted_domain.removed',
          payload: {
            domain: 'remove-trusted.com',
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const result = await instanceQueries.searchInstanceTrustedDomains({
        instanceID,
      });
      
      expect(result.total).toBe(0);
    }, 10000);
  });

  describe('Query Methods', () => {
    it('should get default instance', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [{
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.added',
        payload: {
          instanceId: instanceID,
          name: 'Default Instance',
        },
        creator: 'system',
        owner: instanceID,
      }];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      const instance = await instanceQueries.getDefaultInstance();
      
      expect(instance).toBeTruthy();
      // Should get the first active instance
    }, 10000);

    it('should search instance domains', async () => {
      const instanceID = generateId();
      
      const commands: Command[] = [
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.added',
          payload: {
            instanceId: instanceID,
            name: 'Domain Search Test',
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.domain.added',
          payload: {
            domain: 'search1.com',
            isPrimary: true,
          },
          creator: 'system',
          owner: instanceID,
        },
        {
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.domain.added',
          payload: {
            domain: 'search2.com',
            isPrimary: false,
            isGenerated: true,
          },
          creator: 'system',
          owner: instanceID,
        },
      ];

      // Push all commands in one transaction to get proper in_tx_order
      await eventstore.pushMany(commands);

      await waitForEvents();

      // Search all domains for instance
      const allResult = await instanceQueries.searchInstanceDomains({
        instanceID,
      });
      expect(allResult.total).toBe(2);

      // Search for primary only
      const primaryResult = await instanceQueries.searchInstanceDomains({
        instanceID,
        isPrimary: true,
      });
      expect(primaryResult.total).toBe(1);
      expect(primaryResult.domains[0].domain).toBe('search1.com');

      // Search for generated only
      const generatedResult = await instanceQueries.searchInstanceDomains({
        instanceID,
        isGenerated: true,
      });
      expect(generatedResult.total).toBe(1);
      expect(generatedResult.domains[0].domain).toBe('search2.com');
    }, 10000);
  });
});
