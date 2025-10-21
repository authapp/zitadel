/**
 * Integration tests for Domain and Label Policy Projection
 * Tests domain and label policies with real database and projections
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DomainPolicyQueries } from '../../../src/lib/query/policy/domain-policy-queries';
import { LabelPolicyQueries } from '../../../src/lib/query/policy/label-policy-queries';
import { ThemeMode } from '../../../src/lib/query/policy/label-policy-types';
import { createTestDatabase, closeTestDatabase } from '../setup';
import { DatabasePool } from '../../../src/lib/database';
import { PostgresEventstore } from '../../../src/lib/eventstore/postgres/eventstore';
import { ProjectionRegistry } from '../../../src/lib/query/projection/projection-registry';
import { DomainLabelPolicyProjection, createDomainLabelPolicyProjectionConfig } from '../../../src/lib/query/projections/domain-label-policy-projection';
import { generateId } from '../../../src/lib/id';

describe('Domain and Label Policy Projection Integration Tests', () => {
  let pool: DatabasePool;
  let eventstore: PostgresEventstore;
  let registry: ProjectionRegistry;
  let domainQueries: DomainPolicyQueries;
  let labelQueries: LabelPolicyQueries;

  const TEST_INSTANCE_ID = 'test-instance';

  beforeAll(async () => {
    pool = await createTestDatabase();
    
    eventstore = new PostgresEventstore(pool, {
      instanceID: TEST_INSTANCE_ID,
      maxPushBatchSize: 100,
      enableSubscriptions: false,
    });

    registry = new ProjectionRegistry({
      eventstore,
      database: pool,
    });
    
    await registry.init();
    
    // Register domain/label policy projection
    const config = createDomainLabelPolicyProjectionConfig();
    config.interval = 100;
    registry.register(config, new DomainLabelPolicyProjection(eventstore, pool));
    
    await registry.start('domain_label_policy_projection');

    domainQueries = new DomainPolicyQueries(pool);
    labelQueries = new LabelPolicyQueries(pool);
  });

  afterAll(async () => {
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

  const waitForProjection = (ms: number = 1500) => 
    new Promise(resolve => setTimeout(resolve, ms));

  describe('Domain Policy', () => {
    it('should return built-in default when no policies exist', async () => {
      const policy = await domainQueries.getDefaultDomainPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.userLoginMustBeDomain).toBe(false);
      expect(policy.validateOrgDomains).toBe(false);
      expect(policy.smtpSenderAddressMatchesInstanceDomain).toBe(false);
    });

    it('should process instance.domain.policy.added event', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.domain.policy.added',
        payload: {
          userLoginMustBeDomain: true,
          validateOrgDomains: true,
          smtpSenderAddressMatchesInstanceDomain: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await domainQueries.getDefaultDomainPolicy(instanceID);

      expect(policy.instanceID).toBe(instanceID);
      expect(policy.userLoginMustBeDomain).toBe(true);
      expect(policy.validateOrgDomains).toBe(true);
      expect(policy.isDefault).toBe(true);
    });

    it('should retrieve org-specific policy over instance default', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      
      // Add instance default
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.domain.policy.added',
        payload: {
          userLoginMustBeDomain: false,
          validateOrgDomains: false,
          smtpSenderAddressMatchesInstanceDomain: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Add org-specific policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.domain.policy.added',
        payload: {
          userLoginMustBeDomain: true,
          validateOrgDomains: true,
          smtpSenderAddressMatchesInstanceDomain: true,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await domainQueries.getDomainPolicy(instanceID, orgID);

      expect(policy.organizationID).toBe(orgID);
      expect(policy.userLoginMustBeDomain).toBe(true);
      expect(policy.validateOrgDomains).toBe(true);
      expect(policy.smtpSenderAddressMatchesInstanceDomain).toBe(true);
    });

    it('should fall back to instance when org policy does not exist', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.domain.policy.added',
        payload: {
          userLoginMustBeDomain: true,
          validateOrgDomains: false,
          smtpSenderAddressMatchesInstanceDomain: true,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await domainQueries.getDomainPolicy(instanceID, 'non-existent-org');

      expect(policy.isDefault).toBe(true);
      expect(policy.userLoginMustBeDomain).toBe(true);
    });
  });

  describe('Label Policy', () => {
    it('should return built-in default when no policies exist', async () => {
      const policy = await labelQueries.getDefaultLabelPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.primaryColor).toBe('#5469d4');
      expect(policy.backgroundColor).toBe('#ffffff');
      expect(policy.themeMode).toBe(ThemeMode.AUTO);
      expect(policy.disableWatermark).toBe(false);
    });

    it('should process instance.label.policy.added event', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.label.policy.added',
        payload: {
          primaryColor: '#ff0000',
          backgroundColor: '#ffffff',
          warnColor: '#ff3b5b',
          fontColor: '#000000',
          primaryColorDark: '#cc0000',
          backgroundColorDark: '#111827',
          warnColorDark: '#ff3b5b',
          fontColorDark: '#ffffff',
          logoURL: 'https://example.com/logo.png',
          iconURL: 'https://example.com/icon.png',
          hideLoginNameSuffix: false,
          errorMsgPopup: false,
          disableWatermark: true,
          themeMode: 'light',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await labelQueries.getDefaultLabelPolicy(instanceID);

      expect(policy.primaryColor).toBe('#ff0000');
      expect(policy.logoURL).toBe('https://example.com/logo.png');
      expect(policy.iconURL).toBe('https://example.com/icon.png');
      expect(policy.disableWatermark).toBe(true);
      expect(policy.themeMode).toBe(ThemeMode.LIGHT);
    });

    it('should retrieve org-specific label policy over instance default', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      
      // Add instance default
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.label.policy.added',
        payload: {
          primaryColor: '#5469d4',
          backgroundColor: '#ffffff',
          warnColor: '#ff3b5b',
          fontColor: '#000000',
          primaryColorDark: '#2073c4',
          backgroundColorDark: '#111827',
          warnColorDark: '#ff3b5b',
          fontColorDark: '#ffffff',
          hideLoginNameSuffix: false,
          errorMsgPopup: false,
          disableWatermark: false,
          themeMode: 'auto',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      // Add org-specific policy
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.label.policy.added',
        payload: {
          primaryColor: '#custom',
          backgroundColor: '#ffffff',
          warnColor: '#ff3b5b',
          fontColor: '#000000',
          primaryColorDark: '#custom-dark',
          backgroundColorDark: '#111827',
          warnColorDark: '#ff3b5b',
          fontColorDark: '#ffffff',
          logoURL: 'https://org.example.com/logo.png',
          iconURL: 'https://org.example.com/icon.png',
          logoURLDark: 'https://org.example.com/logo-dark.png',
          iconURLDark: 'https://org.example.com/icon-dark.png',
          fontURL: 'https://fonts.googleapis.com/css?family=Roboto',
          hideLoginNameSuffix: true,
          errorMsgPopup: true,
          disableWatermark: true,
          themeMode: 'dark',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await labelQueries.getLabelPolicy(instanceID, orgID);

      expect(policy.organizationID).toBe(orgID);
      expect(policy.primaryColor).toBe('#custom');
      expect(policy.logoURL).toBe('https://org.example.com/logo.png');
      expect(policy.logoURLDark).toBe('https://org.example.com/logo-dark.png');
      expect(policy.fontURL).toBe('https://fonts.googleapis.com/css?family=Roboto');
      expect(policy.hideLoginNameSuffix).toBe(true);
      expect(policy.errorMsgPopup).toBe(true);
      expect(policy.disableWatermark).toBe(true);
      expect(policy.themeMode).toBe(ThemeMode.DARK);
    });

    it('should get label policy by org using getLabelPolicyByOrg', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.label.policy.added',
        payload: {
          primaryColor: '#brandcolor',
          backgroundColor: '#ffffff',
          warnColor: '#ff3b5b',
          fontColor: '#000000',
          primaryColorDark: '#brandcolor-dark',
          backgroundColorDark: '#111827',
          warnColorDark: '#ff3b5b',
          fontColorDark: '#ffffff',
          hideLoginNameSuffix: false,
          errorMsgPopup: false,
          disableWatermark: false,
          themeMode: 'auto',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      const policy = await labelQueries.getLabelPolicyByOrg(instanceID, orgID);

      expect(policy.primaryColor).toBe('#brandcolor');
    });

    it('should get active label policy with activateUsers setting', async () => {
      const instanceID = generateId();
      
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.label.policy.added',
        payload: {
          primaryColor: '#active',
          backgroundColor: '#ffffff',
          warnColor: '#ff3b5b',
          fontColor: '#000000',
          primaryColorDark: '#active-dark',
          backgroundColorDark: '#111827',
          warnColorDark: '#ff3b5b',
          fontColorDark: '#ffffff',
          hideLoginNameSuffix: false,
          errorMsgPopup: false,
          disableWatermark: false,
          themeMode: 'auto',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      const policy = await labelQueries.getActiveLabelPolicy(instanceID);

      expect(policy.primaryColor).toBe('#active');
      expect(policy.activateUsers).toBe(true); // Added by getActiveLabelPolicy
    });

    it('should handle all theme modes', async () => {
      const themeModes = ['auto', 'light', 'dark'];

      for (const mode of themeModes) {
        const instanceID = generateId();
        
        await eventstore.push({
          instanceID,
          aggregateType: 'instance',
          aggregateID: instanceID,
          eventType: 'instance.label.policy.added',
          payload: {
            primaryColor: '#5469d4',
            backgroundColor: '#ffffff',
            warnColor: '#ff3b5b',
            fontColor: '#000000',
            primaryColorDark: '#2073c4',
            backgroundColorDark: '#111827',
            warnColorDark: '#ff3b5b',
            fontColorDark: '#ffffff',
            hideLoginNameSuffix: false,
            errorMsgPopup: false,
            disableWatermark: false,
            themeMode: mode,
          },
          creator: 'admin',
          owner: instanceID,
        });

        await waitForProjection();

        const policy = await labelQueries.getDefaultLabelPolicy(instanceID);
        expect(policy.themeMode).toBe(mode);
      }
    });
  });

  describe('Policy Inheritance Across Both Types', () => {
    it('should demonstrate 3-level inheritance for both domain and label policies', async () => {
      const instanceID = generateId();
      const orgID = generateId();
      
      // Domain Policy Inheritance
      // Level 1: Built-in (no domain requirements)
      let domainPolicy = await domainQueries.getDomainPolicy(instanceID);
      expect(domainPolicy.userLoginMustBeDomain).toBe(false);

      // Level 2: Instance (require domain login)
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.domain.policy.added',
        payload: {
          userLoginMustBeDomain: true,
          validateOrgDomains: false,
          smtpSenderAddressMatchesInstanceDomain: false,
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      domainPolicy = await domainQueries.getDomainPolicy(instanceID);
      expect(domainPolicy.userLoginMustBeDomain).toBe(true);

      // Level 3: Org (require domain login + validate domains)
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.domain.policy.added',
        payload: {
          userLoginMustBeDomain: true,
          validateOrgDomains: true,
          smtpSenderAddressMatchesInstanceDomain: false,
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      domainPolicy = await domainQueries.getDomainPolicy(instanceID, orgID);
      expect(domainPolicy.validateOrgDomains).toBe(true);

      // Label Policy Inheritance
      // Level 1: Built-in (default colors)
      let labelPolicy = await labelQueries.getLabelPolicy(instanceID);
      expect(labelPolicy.primaryColor).toBe('#5469d4');

      // Level 2: Instance (custom colors)
      await eventstore.push({
        instanceID,
        aggregateType: 'instance',
        aggregateID: instanceID,
        eventType: 'instance.label.policy.added',
        payload: {
          primaryColor: '#instancecolor',
          backgroundColor: '#ffffff',
          warnColor: '#ff3b5b',
          fontColor: '#000000',
          primaryColorDark: '#2073c4',
          backgroundColorDark: '#111827',
          warnColorDark: '#ff3b5b',
          fontColorDark: '#ffffff',
          hideLoginNameSuffix: false,
          errorMsgPopup: false,
          disableWatermark: false,
          themeMode: 'auto',
        },
        creator: 'admin',
        owner: instanceID,
      });

      await waitForProjection();

      labelPolicy = await labelQueries.getLabelPolicy(instanceID);
      expect(labelPolicy.primaryColor).toBe('#instancecolor');

      // Level 3: Org (full branding)
      await eventstore.push({
        instanceID,
        aggregateType: 'org',
        aggregateID: orgID,
        eventType: 'org.label.policy.added',
        payload: {
          primaryColor: '#orgcolor',
          backgroundColor: '#ffffff',
          warnColor: '#ff3b5b',
          fontColor: '#000000',
          primaryColorDark: '#orgcolor-dark',
          backgroundColorDark: '#111827',
          warnColorDark: '#ff3b5b',
          fontColorDark: '#ffffff',
          logoURL: 'https://org.com/logo.png',
          hideLoginNameSuffix: true,
          errorMsgPopup: false,
          disableWatermark: true,
          themeMode: 'light',
        },
        creator: 'admin',
        owner: orgID,
      });

      await waitForProjection();

      labelPolicy = await labelQueries.getLabelPolicy(instanceID, orgID);
      expect(labelPolicy.primaryColor).toBe('#orgcolor');
      expect(labelPolicy.logoURL).toBe('https://org.com/logo.png');
      expect(labelPolicy.disableWatermark).toBe(true);
    }, 20000); // 20 second timeout for complex test with 6 events
  });
});
