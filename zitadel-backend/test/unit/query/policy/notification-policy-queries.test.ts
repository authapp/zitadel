/**
 * Unit tests for Notification Policy Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotificationPolicyQueries } from '../../../../src/lib/query/policy/notification-policy-queries';
import { DatabasePool } from '../../../../src/lib/database';

describe('NotificationPolicyQueries', () => {
  let queries: NotificationPolicyQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';
  const TEST_ORG_ID = 'test-org-456';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new NotificationPolicyQueries(mockDatabase);
  });

  describe('getBuiltInDefault', () => {
    it('should return built-in default when no policies exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const policy = await queries.getDefaultNotificationPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.passwordChange).toBe(true);
      expect(policy.isDefault).toBe(true);
    });
  });

  describe('getDefaultNotificationPolicy', () => {
    it('should return instance-level policy', async () => {
      const mockPolicy = {
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        password_change: false,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockPolicy);

      const policy = await queries.getDefaultNotificationPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('policy-1');
      expect(policy.passwordChange).toBe(false);
      expect(policy.isDefault).toBe(true);
    });
  });

  describe('getNotificationPolicy (3-level inheritance)', () => {
    it('should return org-specific policy when it exists', async () => {
      const mockOrgPolicy = {
        id: 'org-policy-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        password_change: false,
        is_default: false,
        resource_owner: TEST_ORG_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockOrgPolicy);

      const policy = await queries.getNotificationPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.id).toBe('org-policy-1');
      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.passwordChange).toBe(false);
      expect(policy.isDefault).toBe(false);
    });

    it('should fall back to instance policy when no org policy exists', async () => {
      const mockInstancePolicy = {
        id: 'instance-policy-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        password_change: true,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      };

      mockDatabase.queryOne
        .mockResolvedValueOnce(null) // No org policy
        .mockResolvedValueOnce(mockInstancePolicy); // Instance policy

      const policy = await queries.getNotificationPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.id).toBe('instance-policy-1');
      expect(policy.organizationID).toBeUndefined();
      expect(policy.passwordChange).toBe(true);
      expect(policy.isDefault).toBe(true);
    });

    it('should fall back to built-in default when no policies exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const policy = await queries.getNotificationPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.passwordChange).toBe(true);
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
        password_change: false,
        is_default: false,
        resource_owner: TEST_ORG_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockPolicy);

      const policy = await queries.getNotificationPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.id).toBe('policy-123');
      expect(policy.instanceID).toBe(TEST_INSTANCE_ID);
      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.creationDate).toBe(now);
      expect(policy.changeDate).toBe(now);
      expect(policy.sequence).toBe(42);
      expect(policy.passwordChange).toBe(false);
      expect(policy.isDefault).toBe(false);
      expect(policy.resourceOwner).toBe(TEST_ORG_ID);
    });
  });
});
