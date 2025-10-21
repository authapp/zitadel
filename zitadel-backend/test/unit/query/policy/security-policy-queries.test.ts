/**
 * Unit tests for Security Policy Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SecurityPolicyQueries } from '../../../../src/lib/query/policy/security-policy-queries';
import { DatabasePool } from '../../../../src/lib/database';

describe('SecurityPolicyQueries', () => {
  let queries: SecurityPolicyQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new SecurityPolicyQueries(mockDatabase);
  });

  describe('getBuiltInDefault', () => {
    it('should return built-in default when no policy exists', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const policy = await queries.getSecurityPolicy(TEST_INSTANCE_ID);

      expect(policy.aggregateID).toBe(TEST_INSTANCE_ID);
      expect(policy.enableIframeEmbedding).toBe(false);
      expect(policy.allowedOrigins).toEqual([]);
      expect(policy.enableImpersonation).toBe(false);
    });
  });

  describe('getSecurityPolicy', () => {
    it('should return instance policy', async () => {
      const mockPolicy = {
        aggregate_id: TEST_INSTANCE_ID,
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        enable_iframe_embedding: true,
        allowed_origins: ['https://example.com', 'https://app.example.com'],
        enable_impersonation: true,
        resource_owner: TEST_INSTANCE_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockPolicy);

      const policy = await queries.getSecurityPolicy(TEST_INSTANCE_ID);

      expect(policy.aggregateID).toBe(TEST_INSTANCE_ID);
      expect(policy.enableIframeEmbedding).toBe(true);
      expect(policy.allowedOrigins).toEqual(['https://example.com', 'https://app.example.com']);
      expect(policy.enableImpersonation).toBe(true);
    });

    it('should handle empty allowed origins', async () => {
      const mockPolicy = {
        aggregate_id: TEST_INSTANCE_ID,
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        enable_iframe_embedding: false,
        allowed_origins: null,
        enable_impersonation: false,
        resource_owner: TEST_INSTANCE_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockPolicy);

      const policy = await queries.getSecurityPolicy(TEST_INSTANCE_ID);

      expect(policy.allowedOrigins).toEqual([]);
    });
  });

  describe('field mapping', () => {
    it('should correctly map all fields from database', async () => {
      const now = new Date();
      const mockPolicy = {
        aggregate_id: TEST_INSTANCE_ID,
        instance_id: TEST_INSTANCE_ID,
        creation_date: now,
        change_date: now,
        sequence: 42,
        enable_iframe_embedding: true,
        allowed_origins: ['https://trusted.com'],
        enable_impersonation: true,
        resource_owner: TEST_INSTANCE_ID,
      };

      mockDatabase.queryOne.mockResolvedValue(mockPolicy);

      const policy = await queries.getSecurityPolicy(TEST_INSTANCE_ID);

      expect(policy.aggregateID).toBe(TEST_INSTANCE_ID);
      expect(policy.instanceID).toBe(TEST_INSTANCE_ID);
      expect(policy.creationDate).toBe(now);
      expect(policy.changeDate).toBe(now);
      expect(policy.sequence).toBe(42);
      expect(policy.enableIframeEmbedding).toBe(true);
      expect(policy.allowedOrigins).toEqual(['https://trusted.com']);
      expect(policy.enableImpersonation).toBe(true);
      expect(policy.resourceOwner).toBe(TEST_INSTANCE_ID);
    });
  });

  describe('security defaults', () => {
    it('should have secure defaults (everything disabled)', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const policy = await queries.getSecurityPolicy(TEST_INSTANCE_ID);

      // Secure by default
      expect(policy.enableIframeEmbedding).toBe(false);
      expect(policy.allowedOrigins).toHaveLength(0);
      expect(policy.enableImpersonation).toBe(false);
    });
  });
});
