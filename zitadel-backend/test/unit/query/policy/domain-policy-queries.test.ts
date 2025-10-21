/**
 * Unit tests for Domain Policy Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DomainPolicyQueries } from '../../../../src/lib/query/policy/domain-policy-queries';
import { DatabasePool } from '../../../../src/lib/database';
import { DEFAULT_DOMAIN_POLICY } from '../../../../src/lib/query/policy/domain-policy-types';

describe('DomainPolicyQueries', () => {
  let queries: DomainPolicyQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'inst-123';
  const TEST_ORG_ID = 'org-456';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new DomainPolicyQueries(mockDatabase);
  });

  describe('getDomainPolicy', () => {
    it('should return org policy when it exists', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        user_login_must_be_domain: true,
        validate_org_domains: true,
        smtp_sender_address_matches_instance_domain: true,
        is_default: false,
        resource_owner: TEST_ORG_ID,
      });

      const policy = await queries.getDomainPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.userLoginMustBeDomain).toBe(true);
      expect(policy.validateOrgDomains).toBe(true);
    });

    it('should fall back to instance default when org policy does not exist', async () => {
      // First call for org policy returns null
      mockDatabase.queryOne.mockResolvedValueOnce(null);
      
      // Second call for instance default
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        user_login_must_be_domain: false,
        validate_org_domains: false,
        smtp_sender_address_matches_instance_domain: false,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getDomainPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.isDefault).toBe(true);
      expect(policy.userLoginMustBeDomain).toBe(false);
    });

    it('should return instance default when no org ID provided', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        user_login_must_be_domain: false,
        validate_org_domains: false,
        smtp_sender_address_matches_instance_domain: false,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getDomainPolicy(TEST_INSTANCE_ID);

      expect(policy.isDefault).toBe(true);
      expect(mockDatabase.queryOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDefaultDomainPolicy', () => {
    it('should return instance default policy', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        user_login_must_be_domain: true,
        validate_org_domains: true,
        smtp_sender_address_matches_instance_domain: false,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getDefaultDomainPolicy(TEST_INSTANCE_ID);

      expect(policy.isDefault).toBe(true);
      expect(policy.instanceID).toBe(TEST_INSTANCE_ID);
      expect(policy.userLoginMustBeDomain).toBe(true);
    });

    it('should return built-in default when no instance policy exists', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce(null);

      const policy = await queries.getDefaultDomainPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.userLoginMustBeDomain).toBe(DEFAULT_DOMAIN_POLICY.userLoginMustBeDomain);
      expect(policy.validateOrgDomains).toBe(DEFAULT_DOMAIN_POLICY.validateOrgDomains);
    });
  });

  describe('Policy Settings', () => {
    it('should handle all domain policy settings', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        user_login_must_be_domain: true,
        validate_org_domains: true,
        smtp_sender_address_matches_instance_domain: true,
        is_default: false,
        resource_owner: TEST_ORG_ID,
      });

      const policy = await queries.getDomainPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.userLoginMustBeDomain).toBe(true);
      expect(policy.validateOrgDomains).toBe(true);
      expect(policy.smtpSenderAddressMatchesInstanceDomain).toBe(true);
    });

    it('should handle disabled settings', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        user_login_must_be_domain: false,
        validate_org_domains: false,
        smtp_sender_address_matches_instance_domain: false,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getDefaultDomainPolicy(TEST_INSTANCE_ID);

      expect(policy.userLoginMustBeDomain).toBe(false);
      expect(policy.validateOrgDomains).toBe(false);
      expect(policy.smtpSenderAddressMatchesInstanceDomain).toBe(false);
    });
  });
});
