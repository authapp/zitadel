/**
 * Unit tests for Privacy Policy Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrivacyPolicyQueries } from '../../../../src/lib/query/policy/privacy-policy-queries';
import { DatabasePool } from '../../../../src/lib/database';

describe('PrivacyPolicyQueries', () => {
  let queries: PrivacyPolicyQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';
  const TEST_ORG_ID = 'test-org-456';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new PrivacyPolicyQueries(mockDatabase);
  });

  describe('getBuiltInDefault', () => {
    it('should return built-in default when no policies exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const policy = await queries.getDefaultPrivacyPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.docsLink).toBe('https://zitadel.com/docs');
      expect(policy.tosLink).toBe('');
      expect(policy.privacyLink).toBe('');
      expect(policy.isDefault).toBe(true);
    });
  });

  describe('getDefaultPrivacyPolicy', () => {
    it('should return instance-level policy', async () => {
      const mockPolicy = {
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        tos_link: 'https://example.com/tos',
        privacy_link: 'https://example.com/privacy',
        help_link: 'https://example.com/help',
        support_email: 'support@example.com',
        docs_link: 'https://example.com/docs',
        custom_link: 'https://example.com/custom',
        custom_link_text: 'Custom',
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockPolicy);

      const policy = await queries.getDefaultPrivacyPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('policy-1');
      expect(policy.tosLink).toBe('https://example.com/tos');
      expect(policy.privacyLink).toBe('https://example.com/privacy');
      expect(policy.supportEmail).toBe('support@example.com');
      expect(policy.isDefault).toBe(true);
    });
  });

  describe('getPrivacyPolicy (3-level inheritance)', () => {
    it('should return org-specific policy when it exists', async () => {
      const mockOrgPolicy = {
        id: 'org-policy-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        tos_link: 'https://org.com/tos',
        privacy_link: 'https://org.com/privacy',
        help_link: 'https://org.com/help',
        support_email: 'support@org.com',
        docs_link: 'https://org.com/docs',
        custom_link: 'https://org.com/custom',
        custom_link_text: 'Org Custom',
        is_default: false,
        resource_owner: TEST_ORG_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockOrgPolicy);

      const policy = await queries.getPrivacyPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.id).toBe('org-policy-1');
      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.tosLink).toBe('https://org.com/tos');
      expect(policy.supportEmail).toBe('support@org.com');
      expect(policy.isDefault).toBe(false);
    });

    it('should fall back to instance policy when no org policy exists', async () => {
      const mockInstancePolicy = {
        id: 'instance-policy-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        tos_link: 'https://instance.com/tos',
        privacy_link: 'https://instance.com/privacy',
        help_link: '',
        support_email: 'support@instance.com',
        docs_link: '',
        custom_link: '',
        custom_link_text: '',
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      };

      mockDatabase.queryOne
        .mockResolvedValueOnce(null) // No org policy
        .mockResolvedValueOnce(mockInstancePolicy); // Instance policy

      const policy = await queries.getPrivacyPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.id).toBe('instance-policy-1');
      expect(policy.organizationID).toBeUndefined();
      expect(policy.tosLink).toBe('https://instance.com/tos');
      expect(policy.isDefault).toBe(true);
    });

    it('should fall back to built-in default when no policies exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const policy = await queries.getPrivacyPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.docsLink).toBe('https://zitadel.com/docs');
      expect(policy.isDefault).toBe(true);
    });
  });

  describe('field mapping', () => {
    it('should correctly map all fields from database', async () => {
      const now = new Date();
      const mockPolicy = {
        id: 'policy-123',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: now,
        change_date: now,
        sequence: 42,
        tos_link: 'https://test.com/tos',
        privacy_link: 'https://test.com/privacy',
        help_link: 'https://test.com/help',
        support_email: 'help@test.com',
        docs_link: 'https://test.com/docs',
        custom_link: 'https://test.com/custom',
        custom_link_text: 'Custom Link',
        is_default: false,
        resource_owner: TEST_ORG_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockPolicy);

      const policy = await queries.getPrivacyPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.id).toBe('policy-123');
      expect(policy.instanceID).toBe(TEST_INSTANCE_ID);
      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.creationDate).toBe(now);
      expect(policy.changeDate).toBe(now);
      expect(policy.sequence).toBe(42);
      expect(policy.tosLink).toBe('https://test.com/tos');
      expect(policy.privacyLink).toBe('https://test.com/privacy');
      expect(policy.helpLink).toBe('https://test.com/help');
      expect(policy.supportEmail).toBe('help@test.com');
      expect(policy.docsLink).toBe('https://test.com/docs');
      expect(policy.customLink).toBe('https://test.com/custom');
      expect(policy.customLinkText).toBe('Custom Link');
      expect(policy.isDefault).toBe(false);
      expect(policy.resourceOwner).toBe(TEST_ORG_ID);
    });

    it('should handle null/empty string fields', async () => {
      const mockPolicy = {
        id: 'policy-empty',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        tos_link: null,
        privacy_link: null,
        help_link: null,
        support_email: null,
        docs_link: null,
        custom_link: null,
        custom_link_text: null,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockPolicy);

      const policy = await queries.getDefaultPrivacyPolicy(TEST_INSTANCE_ID);

      expect(policy.tosLink).toBe('');
      expect(policy.privacyLink).toBe('');
      expect(policy.helpLink).toBe('');
      expect(policy.supportEmail).toBe('');
      expect(policy.docsLink).toBe('');
      expect(policy.customLink).toBe('');
      expect(policy.customLinkText).toBe('');
    });
  });
});
