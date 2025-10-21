/**
 * Unit tests for Password Age Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PasswordAgeQueries } from '../../../../src/lib/query/policy/password-age-queries';
import { DatabasePool } from '../../../../src/lib/database';
import { DEFAULT_PASSWORD_AGE } from '../../../../src/lib/query/policy/password-age-types';

describe('PasswordAgeQueries', () => {
  let queries: PasswordAgeQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'inst-123';
  const TEST_ORG_ID = 'org-456';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new PasswordAgeQueries(mockDatabase);
  });

  describe('getPasswordAgePolicy', () => {
    it('should return org policy when it exists', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        max_age_days: 90,
        expire_warn_days: 7,
        is_default: false,
        resource_owner: TEST_ORG_ID,
      });

      const policy = await queries.getPasswordAgePolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.maxAgeDays).toBe(90);
      expect(policy.expireWarnDays).toBe(7);
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
        max_age_days: 0,
        expire_warn_days: 0,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getPasswordAgePolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.isDefault).toBe(true);
      expect(policy.maxAgeDays).toBe(0);
    });

    it('should return instance default when no org ID provided', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        max_age_days: 0,
        expire_warn_days: 0,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getPasswordAgePolicy(TEST_INSTANCE_ID);

      expect(policy.isDefault).toBe(true);
      expect(mockDatabase.queryOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDefaultPasswordAgePolicy', () => {
    it('should return instance default policy', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        max_age_days: 90,
        expire_warn_days: 7,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getDefaultPasswordAgePolicy(TEST_INSTANCE_ID);

      expect(policy.isDefault).toBe(true);
      expect(policy.instanceID).toBe(TEST_INSTANCE_ID);
      expect(policy.maxAgeDays).toBe(90);
    });

    it('should return built-in default when no instance policy exists', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce(null);

      const policy = await queries.getDefaultPasswordAgePolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.maxAgeDays).toBe(DEFAULT_PASSWORD_AGE.maxAgeDays);
      expect(policy.expireWarnDays).toBe(DEFAULT_PASSWORD_AGE.expireWarnDays);
    });
  });

  describe('checkPasswordAge', () => {
    const mockPolicy = {
      id: 'policy-1',
      instanceID: TEST_INSTANCE_ID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: BigInt(1),
      maxAgeDays: 90,
      expireWarnDays: 7,
      isDefault: false,
      resourceOwner: TEST_INSTANCE_ID,
    };

    it('should not expire when maxAgeDays is 0', () => {
      const neverExpirePolicy = { ...mockPolicy, maxAgeDays: 0 };
      const oldDate = new Date('2020-01-01');

      const result = queries.checkPasswordAge(oldDate, neverExpirePolicy);

      expect(result.expired).toBe(false);
      expect(result.shouldWarn).toBe(false);
    });

    it('should be expired when password is older than maxAgeDays', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91); // 91 days ago

      const result = queries.checkPasswordAge(oldDate, mockPolicy);

      expect(result.expired).toBe(true);
      expect(result.expiresIn).toBeUndefined();
    });

    it('should not be expired when password is newer than maxAgeDays', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago

      const result = queries.checkPasswordAge(recentDate, mockPolicy);

      expect(result.expired).toBe(false);
      expect(result.expiresIn).toBeGreaterThan(0);
    });

    it('should warn when password is within warning period', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 85); // 85 days ago (5 days until expiration)

      const result = queries.checkPasswordAge(recentDate, mockPolicy);

      expect(result.expired).toBe(false);
      expect(result.shouldWarn).toBe(true);
      expect(result.expiresIn).toBeLessThanOrEqual(7);
    });

    it('should not warn when password has plenty of time left', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago (60 days until expiration)

      const result = queries.checkPasswordAge(recentDate, mockPolicy);

      expect(result.expired).toBe(false);
      expect(result.shouldWarn).toBe(false);
      expect(result.expiresIn).toBeGreaterThan(7);
    });

    it('should calculate correct days until expiration', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 80); // 80 days ago

      const result = queries.checkPasswordAge(recentDate, mockPolicy);

      expect(result.expiresIn).toBe(10); // 90 - 80 = 10
    });

    it('should handle password changed today', () => {
      const today = new Date();

      const result = queries.checkPasswordAge(today, mockPolicy);

      expect(result.expired).toBe(false);
      expect(result.shouldWarn).toBe(false);
      expect(result.expiresIn).toBe(90);
    });
  });
});
