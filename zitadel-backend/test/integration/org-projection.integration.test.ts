/**
 * Organization Projection Integration Tests
 * 
 * Tests the full flow: events -> projection -> queries
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { DatabasePool } from '../../src/lib/database';
import { createTestDatabase, closeTestDatabase, cleanDatabase } from './setup';
import { DatabaseMigrator } from '../../src/lib/database/migrator';
import { PostgresEventstore } from '../../src/lib/eventstore';
import { ProjectionRegistry } from '../../src/lib/query/projection/projection-registry';
import { 
  createOrgProjection,
  createOrgProjectionConfig,
} from '../../src/lib/query/projections/org-projection';
import {
  createOrgDomainProjection,
  createOrgDomainProjectionConfig,
} from '../../src/lib/query/projections/org-domain-projection';
import { OrgQueries } from '../../src/lib/query/org/org-queries';
import { OrgState } from '../../src/lib/query/org/org-types';
import { generateId as generateSnowflakeId } from '../../src/lib/id/snowflake';

describe('Organization Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let orgQueries: OrgQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: 'test-instance',
      maxPushBatchSize: 100,
    });
    
    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register org projection
    const orgConfig = createOrgProjectionConfig();
    const orgProjection = createOrgProjection(eventstore, pool);
    registry.register(orgConfig, orgProjection);
    
    // Register org domain projection
    const domainConfig = createOrgDomainProjectionConfig();
    const domainProjection = createOrgDomainProjection(eventstore, pool);
    registry.register(domainConfig, domainProjection);
    
    orgQueries = new OrgQueries(pool);
  });

  afterEach(async () => {
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore
      }
    }
  });

  describe('Organization Events', () => {
    it('should process org.added event', async () => {
      const orgID = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'org.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          name: 'Test Organization',
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await registry.start('org_projection');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const org = await orgQueries.getOrgByID(orgID);
      expect(org).toBeDefined();
      expect(org!.name).toBe('Test Organization');
      expect(org!.state).toBe(OrgState.ACTIVE);
    }, 10000);

    it('should process org.changed event', async () => {
      const orgID = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'org.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { name: 'Original Name' },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await eventstore.push({
        eventType: 'org.changed',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { name: 'Updated Name' },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await registry.start('org_projection');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const org = await orgQueries.getOrgByID(orgID);
      expect(org).toBeDefined();
      expect(org!.name).toBe('Updated Name');
    }, 10000);

    it('should process org.deactivated event', async () => {
      const orgID = generateSnowflakeId();
      
      await eventstore.push({
        eventType: 'org.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { name: 'Test Org' },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await eventstore.push({
        eventType: 'org.deactivated',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {},
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await registry.start('org_projection');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const org = await orgQueries.getOrgByID(orgID);
      expect(org).toBeDefined();
      expect(org!.state).toBe(OrgState.INACTIVE);
    }, 10000);

    it('should process org.reactivated event', async () => {
      const orgID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { name: 'Test Org' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.deactivated',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: {},
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.reactivated',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: {},
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await registry.start('org_projection');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const org = await orgQueries.getOrgByID(orgID);
      expect(org).toBeDefined();
      expect(org!.state).toBe(OrgState.ACTIVE);
    }, 10000);
  });

  describe('Organization Domain Events', () => {
    it('should process org.domain.added event', async () => {
      const orgID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { name: 'Test Org' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: {
            domain: 'test.com',
            validationType: 'dns',
            validationCode: 'abc123',
          },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      // Start both projections at the same time
      await Promise.all([
        registry.start('org_projection'),
        registry.start('org_domain_projection'),
      ]);
      
      // Wait longer for both to process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const domains = await orgQueries.getOrgDomainsByID(orgID);
      expect(domains).toHaveLength(1);
      expect(domains[0].domain).toBe('test.com');
      expect(domains[0].isVerified).toBe(false);
      expect(domains[0].isPrimary).toBe(false);
    }, 12000);

    it('should process org.domain.verified event', async () => {
      const orgID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { name: 'Test Org' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: 'test.com' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.verified',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: 'test.com' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('org_projection'),
        registry.start('org_domain_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const domains = await orgQueries.getOrgDomainsByID(orgID);
      expect(domains).toHaveLength(1);
      expect(domains[0].isVerified).toBe(true);
    }, 12000);

    it('should process org.domain.primary.set event', async () => {
      const orgID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { name: 'Test Org' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: 'test.com' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.verified',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: 'test.com' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.primary.set',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: 'test.com' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('org_projection'),
        registry.start('org_domain_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const domains = await orgQueries.getOrgDomainsByID(orgID);
      expect(domains).toHaveLength(1);
      expect(domains[0].isPrimary).toBe(true);
      
      const org = await orgQueries.getOrgByID(orgID);
      expect(org!.primaryDomain).toBe('test.com');
    }, 12000);

    it('should process org.domain.removed event', async () => {
      const orgID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { name: 'Test Org' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: 'test.com' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.removed',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: 'test.com' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('org_projection'),
        registry.start('org_domain_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const domains = await orgQueries.getOrgDomainsByID(orgID);
      expect(domains).toHaveLength(0);
    }, 12000);
  });

  describe('Query Methods', () => {
    it('should find org by domain', async () => {
      const orgID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { name: 'Test Org' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: 'unique.com' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.verified',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: 'unique.com' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await Promise.all([
        registry.start('org_projection'),
        registry.start('org_domain_projection'),
      ]);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const org = await orgQueries.getOrgByDomainGlobal('unique.com');
      expect(org).toBeDefined();
      expect(org!.id).toBe(orgID);
      expect(org!.name).toBe('Test Org');
    }, 12000);

    it('should search organizations', async () => {
      const org1ID = generateSnowflakeId();
      const org2ID = generateSnowflakeId();
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: org1ID,
          payload: { name: 'Alpha Org' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: org2ID,
          payload: { name: 'Beta Org' },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await registry.start('org_projection');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const result = await orgQueries.searchOrgs({ name: 'Alpha' });
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.orgs.some(o => o.name === 'Alpha Org')).toBe(true);
    }, 10000);
  });
});
