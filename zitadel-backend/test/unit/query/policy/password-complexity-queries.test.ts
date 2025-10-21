/**
 * Unit tests for Password Complexity Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PasswordComplexityQueries } from '../../../../src/lib/query/policy/password-complexity-queries';
import { DatabasePool } from '../../../../src/lib/database';
import { DEFAULT_PASSWORD_COMPLEXITY } from '../../../../src/lib/query/policy/password-complexity-types';

describe('PasswordComplexityQueries', () => {
  let queries: PasswordComplexityQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'inst-123';
  const TEST_ORG_ID = 'org-456';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new PasswordComplexityQueries(mockDatabase);
  });

  describe('getPasswordComplexityPolicy', () => {
    it('should return org policy when it exists', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        min_length: 10,
        has_uppercase: true,
        has_lowercase: true,
        has_number: true,
        has_symbol: true,
        is_default: false,
        resource_owner: TEST_ORG_ID,
      });

      const policy = await queries.getPasswordComplexityPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.minLength).toBe(10);
      expect(policy.hasSymbol).toBe(true);
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
        min_length: 8,
        has_uppercase: true,
        has_lowercase: true,
        has_number: true,
        has_symbol: false,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getPasswordComplexityPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.isDefault).toBe(true);
      expect(policy.minLength).toBe(8);
    });

    it('should return instance default when no org ID provided', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        min_length: 8,
        has_uppercase: true,
        has_lowercase: true,
        has_number: true,
        has_symbol: false,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getPasswordComplexityPolicy(TEST_INSTANCE_ID);

      expect(policy.isDefault).toBe(true);
      expect(mockDatabase.queryOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDefaultPasswordComplexityPolicy', () => {
    it('should return instance default policy', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        min_length: 8,
        has_uppercase: true,
        has_lowercase: true,
        has_number: true,
        has_symbol: false,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getDefaultPasswordComplexityPolicy(TEST_INSTANCE_ID);

      expect(policy.isDefault).toBe(true);
      expect(policy.instanceID).toBe(TEST_INSTANCE_ID);
    });

    it('should return built-in default when no instance policy exists', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce(null);

      const policy = await queries.getDefaultPasswordComplexityPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.minLength).toBe(DEFAULT_PASSWORD_COMPLEXITY.minLength);
      expect(policy.hasUppercase).toBe(DEFAULT_PASSWORD_COMPLEXITY.hasUppercase);
    });
  });

  describe('validatePassword', () => {
    const mockPolicy = {
      id: 'policy-1',
      instanceID: TEST_INSTANCE_ID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: BigInt(1),
      minLength: 8,
      hasUppercase: true,
      hasLowercase: true,
      hasNumber: true,
      hasSymbol: false,
      isDefault: false,
      resourceOwner: TEST_INSTANCE_ID,
    };

    it('should validate correct password', () => {
      const result = queries.validatePassword('Password123', mockPolicy);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when password is too short', () => {
      const result = queries.validatePassword('Pass1', mockPolicy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should fail when missing uppercase', () => {
      const result = queries.validatePassword('password123', mockPolicy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should fail when missing lowercase', () => {
      const result = queries.validatePassword('PASSWORD123', mockPolicy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should fail when missing number', () => {
      const result = queries.validatePassword('Password', mockPolicy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should fail when missing symbol if required', () => {
      const policyWithSymbol = { ...mockPolicy, hasSymbol: true };
      const result = queries.validatePassword('Password123', policyWithSymbol);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should pass with symbol when required', () => {
      const policyWithSymbol = { ...mockPolicy, hasSymbol: true };
      const result = queries.validatePassword('Password123!', policyWithSymbol);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return multiple errors when multiple requirements not met', () => {
      const result = queries.validatePassword('pass', mockPolicy);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });

  describe('getPasswordComplexityRequirements', () => {
    it('should return requirements object', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        min_length: 10,
        has_uppercase: true,
        has_lowercase: true,
        has_number: true,
        has_symbol: true,
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const requirements = await queries.getPasswordComplexityRequirements(TEST_INSTANCE_ID);

      expect(requirements.minLength).toBe(10);
      expect(requirements.requireUppercase).toBe(true);
      expect(requirements.requireLowercase).toBe(true);
      expect(requirements.requireNumber).toBe(true);
      expect(requirements.requireSymbol).toBe(true);
    });
  });
});
