/**
 * Unit tests for OIDC Settings Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OIDCSettingsQueries } from '../../../../src/lib/query/policy/oidc-settings-queries';
import { DatabasePool } from '../../../../src/lib/database';

describe('OIDCSettingsQueries', () => {
  let queries: OIDCSettingsQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new OIDCSettingsQueries(mockDatabase);
  });

  describe('getBuiltInDefault', () => {
    it('should return built-in default when no settings exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const settings = await queries.getOIDCSettings(TEST_INSTANCE_ID);

      expect(settings.aggregateID).toBe(TEST_INSTANCE_ID);
      expect(settings.accessTokenLifetime).toBe(43200); // 12 hours
      expect(settings.idTokenLifetime).toBe(43200); // 12 hours
      expect(settings.refreshTokenIdleExpiration).toBe(1296000); // 15 days
      expect(settings.refreshTokenExpiration).toBe(2592000); // 30 days
    });
  });

  describe('getOIDCSettings', () => {
    it('should return instance settings', async () => {
      const mockSettings = {
        aggregate_id: TEST_INSTANCE_ID,
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        resource_owner: TEST_INSTANCE_ID,
        access_token_lifetime: 3600, // 1 hour
        id_token_lifetime: 3600, // 1 hour
        refresh_token_idle_expiration: 604800, // 7 days
        refresh_token_expiration: 1209600, // 14 days
      };

      mockDatabase.queryOne.mockResolvedValue(mockSettings);

      const settings = await queries.getOIDCSettings(TEST_INSTANCE_ID);

      expect(settings.aggregateID).toBe(TEST_INSTANCE_ID);
      expect(settings.accessTokenLifetime).toBe(3600);
      expect(settings.idTokenLifetime).toBe(3600);
      expect(settings.refreshTokenIdleExpiration).toBe(604800);
      expect(settings.refreshTokenExpiration).toBe(1209600);
    });
  });

  describe('field mapping', () => {
    it('should correctly map all fields from database', async () => {
      const now = new Date();
      const mockSettings = {
        aggregate_id: TEST_INSTANCE_ID,
        instance_id: TEST_INSTANCE_ID,
        creation_date: now,
        change_date: now,
        sequence: 42,
        resource_owner: TEST_INSTANCE_ID,
        access_token_lifetime: 7200,
        id_token_lifetime: 7200,
        refresh_token_idle_expiration: 864000,
        refresh_token_expiration: 1728000,
      };

      mockDatabase.queryOne.mockResolvedValue(mockSettings);

      const settings = await queries.getOIDCSettings(TEST_INSTANCE_ID);

      expect(settings.aggregateID).toBe(TEST_INSTANCE_ID);
      expect(settings.instanceID).toBe(TEST_INSTANCE_ID);
      expect(settings.creationDate).toBe(now);
      expect(settings.changeDate).toBe(now);
      expect(settings.sequence).toBe(42);
      expect(settings.resourceOwner).toBe(TEST_INSTANCE_ID);
      expect(settings.accessTokenLifetime).toBe(7200);
      expect(settings.idTokenLifetime).toBe(7200);
      expect(settings.refreshTokenIdleExpiration).toBe(864000);
      expect(settings.refreshTokenExpiration).toBe(1728000);
    });
  });

  describe('token lifetime defaults', () => {
    it('should provide OAuth 2.0 recommended defaults', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const settings = await queries.getOIDCSettings(TEST_INSTANCE_ID);

      // Verify defaults are reasonable
      expect(settings.accessTokenLifetime).toBeGreaterThan(0);
      expect(settings.idTokenLifetime).toBeGreaterThan(0);
      expect(settings.refreshTokenIdleExpiration).toBeGreaterThan(settings.accessTokenLifetime);
      expect(settings.refreshTokenExpiration).toBeGreaterThan(settings.refreshTokenIdleExpiration);
    });
  });
});
