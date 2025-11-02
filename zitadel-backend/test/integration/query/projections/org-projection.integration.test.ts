/**
 * Organization Projection Integration Tests
 * 
 * Tests the full flow: events -> projection -> queries
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { PostgresEventstore } from '../../../../src/lib/eventstore';
import { ProjectionRegistry } from '../../../../src/lib/query/projection/projection-registry';
import { 
  createOrgProjection,
  createOrgProjectionConfig,
} from '../../../../src/lib/query/projections/org-projection';
import {
  createOrgDomainProjection,
  createOrgDomainProjectionConfig,
} from '../../../../src/lib/query/projections/org-domain-projection';
import { OrgQueries } from '../../../../src/lib/query/org/org-queries';
import { OrgState } from '../../../../src/lib/query/org/org-types';
import { generateId as generateSnowflakeId } from '../../../../src/lib/id/snowflake';
import { waitForProjectionsCatchUp, delay } from '../../../helpers/projection-test-helpers';

describe('Organization Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let orgQueries: OrgQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
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
    orgConfig.interval = 50; // Fast polling for tests
    const orgProjection = createOrgProjection(eventstore, pool);
    registry.register(orgConfig, orgProjection);
    
    // Register org domain projection
    const domainConfig = createOrgDomainProjectionConfig();
    domainConfig.interval = 50; // Fast polling for tests
    const domainProjection = createOrgDomainProjection(eventstore, pool);
    registry.register(domainConfig, domainProjection);
    
    // Start projections once for all tests
    await Promise.all([
      registry.start('org_projection'),
      registry.start('org_domain_projection'),
    ]);
    
    orgQueries = new OrgQueries(pool);
    
    // Give projections time to start and establish subscriptions
    await delay(100);
  });

  afterAll(async () => {
    // Stop all projections
    const names = registry.getNames();
    for (const name of names) {
      try {
        await registry.stop(name);
      } catch (e) {
        // Ignore if already stopped
      }
    }
    
    await closeTestDatabase();
  });

  // Helper to wait for projections to process events
  const waitForOrgEvents = async () => {
    // Only wait for org_projection since these events don't affect domain projection
    await waitForProjectionsCatchUp(registry, eventstore, ['org_projection'], 2000);
  };
  
  const waitForDomainEvents = async () => {
    // Wait for domain projection only since org projection is already caught up
    await waitForProjectionsCatchUp(registry, eventstore, ['org_domain_projection'], 2000);
  };

  describe('Organization Events', () => {
    it('should process org.added event', async () => {
      const orgID = generateSnowflakeId();
      const orgName = `Test-Org-${orgID}`;
      
      await eventstore.push({
        eventType: 'org.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: {
          name: orgName,
        },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForOrgEvents();
      
      const org = await orgQueries.getOrgByID(orgID);
      expect(org).toBeDefined();
      expect(org!.name).toBe(orgName);
      expect(org!.state).toBe(OrgState.ACTIVE);
    }, 5000);

    it('should process org.changed event', async () => {
      const orgID = generateSnowflakeId();
      const originalName = `Original-${orgID}`;
      const updatedName = `Updated-${orgID}`;
      
      await eventstore.push({
        eventType: 'org.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { name: originalName },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await eventstore.push({
        eventType: 'org.changed',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { name: updatedName },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForOrgEvents();
      
      const org = await orgQueries.getOrgByID(orgID);
      expect(org).toBeDefined();
      expect(org!.name).toBe(updatedName);
    }, 5000);

    it('should process org.deactivated event', async () => {
      const orgID = generateSnowflakeId();
      const orgName = `Deactivate-Org-${orgID}`;
      
      await eventstore.push({
        eventType: 'org.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { name: orgName },
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
      
      await waitForOrgEvents();
      
      const org = await orgQueries.getOrgByID(orgID);
      expect(org).toBeDefined();
      expect(org!.state).toBe(OrgState.INACTIVE);
    }, 5000);

    it('should process org.reactivated event', async () => {
      const orgID = generateSnowflakeId();
      const orgName = `Reactivate-Org-${orgID}`;
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { name: orgName },
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
      
      await waitForOrgEvents();
      
      const org = await orgQueries.getOrgByID(orgID);
      expect(org).toBeDefined();
      expect(org!.state).toBe(OrgState.ACTIVE);
    }, 5000);
  });

  describe('Organization Domain Events', () => {
    it('should process org.domain.added event', async () => {
      const orgID = generateSnowflakeId();
      const uniqueDomain = `test-${orgID}.com`;
      const orgName = `Domain-Added-Org-${orgID}`;
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { name: orgName },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: {
            domain: uniqueDomain,
            validationType: 'dns',
            validationCode: 'abc123',
          },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      // Wait for projections to process (both org and org_domain)
      await waitForDomainEvents();
      
      const domains = await orgQueries.getOrgDomainsByID(orgID);
      expect(domains).toHaveLength(1);
      expect(domains[0].domain).toBe(uniqueDomain);
      expect(domains[0].isVerified).toBe(false);
      expect(domains[0].isPrimary).toBe(false);
    }, 6000);

    it('should process org.domain.verified event', async () => {
      const orgID = generateSnowflakeId();
      const uniqueDomain = `test-${orgID}.com`;
      const orgName = `Domain-Verified-Org-${orgID}`;
      
      // Step 1: Push org.added event and verify org projection
      await eventstore.push({
        eventType: 'org.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { name: orgName },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForOrgEvents();
      
      // Verify org exists
      const org = await orgQueries.getOrgByID(orgID, 'test-instance');
      expect(org).toBeDefined();
      console.log('✓ Step 1: Org created:', org?.id);
      
      // Step 2: Push org.domain.added event and verify domain projection
      await eventstore.push({
        eventType: 'org.domain.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { domain: uniqueDomain },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForDomainEvents();
      
      // Verify domain was added
      let domains = await orgQueries.getOrgDomainsByID(orgID, 'test-instance');
      expect(domains).toHaveLength(1);
      expect(domains[0].isVerified).toBe(false);
      console.log('✓ Step 2: Domain added (unverified):', domains[0].domain);
      
      // Step 3: Push org.domain.verified event
      await eventstore.push({
        eventType: 'org.domain.verified',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { domain: uniqueDomain },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForDomainEvents();
      
      // Verify domain is now verified
      domains = await orgQueries.getOrgDomainsByID(orgID, 'test-instance');
      expect(domains).toHaveLength(1);
      expect(domains[0].isVerified).toBe(true);
      console.log('✓ Step 3: Domain verified:', domains[0].domain);
    }, 10000);

    it('should process org.domain.primary.set event', async () => {
      const orgID = generateSnowflakeId();
      const uniqueDomain = `test-${orgID}.com`;
      const orgName = `Primary-Domain-Org-${orgID}`;
      
      // Step 1: Create org
      await eventstore.push({
        eventType: 'org.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { name: orgName },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForOrgEvents();
      
      // Verify org exists
      let org = await orgQueries.getOrgByID(orgID, 'test-instance');
      expect(org).toBeDefined();
      console.log('✓ Step 1: Org created:', org?.id);
      
      // Step 2: Add domain
      await eventstore.push({
        eventType: 'org.domain.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { domain: uniqueDomain },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForDomainEvents();
      
      // Verify domain added
      let domains = await orgQueries.getOrgDomainsByID(orgID, 'test-instance');
      expect(domains).toHaveLength(1);
      expect(domains[0].isPrimary).toBe(false);
      console.log('✓ Step 2: Domain added (not primary):', domains[0].domain);
      
      // Step 3: Verify domain
      await eventstore.push({
        eventType: 'org.domain.verified',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { domain: uniqueDomain },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForDomainEvents();
      
      // Verify domain is verified
      domains = await orgQueries.getOrgDomainsByID(orgID, 'test-instance');
      expect(domains[0].isVerified).toBe(true);
      console.log('✓ Step 3: Domain verified');
      
      // Step 4: Set as primary
      await eventstore.push({
        eventType: 'org.domain.primary.set',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { domain: uniqueDomain },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForDomainEvents();
      
      // Verify domain is primary
      domains = await orgQueries.getOrgDomainsByID(orgID, 'test-instance');
      expect(domains).toHaveLength(1);
      expect(domains[0].isPrimary).toBe(true);
      console.log('✓ Step 4: Domain set as primary');
      
      // Verify org.primaryDomain is updated
      org = await orgQueries.getOrgByID(orgID, 'test-instance');
      expect(org!.primaryDomain).toBe(uniqueDomain);
      console.log('✓ Step 5: Org primary_domain updated');
    }, 10000);

    it('should process org.domain.removed event', async () => {
      const orgID = generateSnowflakeId();
      const uniqueDomain = `test-${orgID}.com`;
      const orgName = `Domain-Removed-Org-${orgID}`;
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { name: orgName },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.added',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: uniqueDomain },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.domain.removed',
          aggregateType: 'org',
          aggregateID: orgID,
          payload: { domain: uniqueDomain },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await waitForDomainEvents();
      
      const domains = await orgQueries.getOrgDomainsByID(orgID);
      expect(domains).toHaveLength(0);
    }, 6000);
  });

  describe('Query Methods', () => {
    it('should find org by domain', async () => {
      const orgID = generateSnowflakeId();
      const uniqueDomain = `unique-${orgID}.com`;
      const orgName = `Find-By-Domain-Org-${orgID}`;
      
      // Step 1: Create org
      await eventstore.push({
        eventType: 'org.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { name: orgName },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForOrgEvents();
      
      // Verify org exists in orgs_projection
      const orgDirect = await orgQueries.getOrgByID(orgID, 'test-instance');
      expect(orgDirect).toBeDefined();
      console.log('✓ Step 1: Org exists in orgs_projection:', orgDirect?.id);
      
      // Step 2: Add domain
      await eventstore.push({
        eventType: 'org.domain.added',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { domain: uniqueDomain },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForDomainEvents();
      
      // Verify domain exists in org_domains_projection
      const domains = await orgQueries.getOrgDomainsByID(orgID, 'test-instance');
      expect(domains).toHaveLength(1);
      console.log('✓ Step 2: Domain exists in org_domains_projection:', domains[0].domain);
      
      // Step 3: Verify domain
      await eventstore.push({
        eventType: 'org.domain.verified',
        aggregateType: 'org',
        aggregateID: orgID,
        payload: { domain: uniqueDomain },
        creator: 'system',
        owner: 'test-instance',
        instanceID: 'test-instance',
      });
      
      await waitForDomainEvents();
      
      // Verify domain is verified
      const verifiedDomains = await orgQueries.getOrgDomainsByID(orgID, 'test-instance');
      expect(verifiedDomains[0].isVerified).toBe(true);
      console.log('✓ Step 3: Domain verified');
      
      // Step 4: Test JOIN query (getOrgByDomainGlobal)
      const org = await orgQueries.getOrgByDomainGlobal(uniqueDomain, 'test-instance');
      expect(org).toBeDefined();
      expect(org!.id).toBe(orgID);
      expect(org!.name).toBe(orgName);
      console.log('✓ Step 4: Found org via domain JOIN query');
    }, 10000);

    it('should search organizations', async () => {
      const org1ID = generateSnowflakeId();
      const org2ID = generateSnowflakeId();
      const org1Name = `Alpha-Search-${org1ID}`;
      const org2Name = `Beta-Search-${org2ID}`;
      
      await eventstore.pushMany([
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: org1ID,
          payload: { name: org1Name },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
        {
          eventType: 'org.added',
          aggregateType: 'org',
          aggregateID: org2ID,
          payload: { name: org2Name },
          creator: 'system',
          owner: 'test-instance',
          instanceID: 'test-instance',
        },
      ]);
      
      await waitForOrgEvents();
      
      const result = await orgQueries.searchOrgs({ name: 'Alpha-Search' });
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.orgs.some(o => o.name === org1Name)).toBe(true);
    }, 5000);
  });
});
