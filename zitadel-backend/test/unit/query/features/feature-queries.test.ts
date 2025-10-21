/**
 * Unit tests for Feature Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FeatureQueries } from '../../../../src/lib/query/features/feature-queries';
import { DatabasePool } from '../../../../src/lib/database';

describe('FeatureQueries', () => {
  let queries: FeatureQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new FeatureQueries(mockDatabase);
  });

  describe('getInstanceFeatures', () => {
    it('should return default features when none configured', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const features = await queries.getInstanceFeatures(TEST_INSTANCE_ID);

      expect(features.instanceID).toBe(TEST_INSTANCE_ID);
      expect(features.actions).toBe(false);
      expect(features.tokenExchange).toBe(false);
      expect(features.userSchema).toBe(false);
    });

    it('should return configured instance features', async () => {
      const mockFeatures = {
        instance_id: TEST_INSTANCE_ID,
        login_default_org: true,
        trigger_introspection_projections: false,
        legacy_introspection: false,
        user_schema: true,
        token_exchange: true,
        actions: true,
        improved_performance: false,
        web_key: false,
        debug_oidc_parent_error: false,
        oidc_legacy_introspection: false,
        oidc_trigger_introspection_projections: false,
        disable_user_token_event: false,
      };

      mockDatabase.queryOne.mockResolvedValue(mockFeatures);

      const features = await queries.getInstanceFeatures(TEST_INSTANCE_ID);

      expect(features.instanceID).toBe(TEST_INSTANCE_ID);
      expect(features.loginDefaultOrg).toBe(true);
      expect(features.userSchema).toBe(true);
      expect(features.tokenExchange).toBe(true);
      expect(features.actions).toBe(true);
    });
  });

  describe('getSystemFeatures', () => {
    it('should return default features when none configured', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const features = await queries.getSystemFeatures();

      expect(features.actions).toBe(false);
      expect(features.tokenExchange).toBe(false);
    });

    it('should return configured system features', async () => {
      const mockFeatures = {
        login_default_org: false,
        trigger_introspection_projections: true,
        legacy_introspection: false,
        user_schema: false,
        token_exchange: false,
        actions: true,
        improved_performance: true,
        web_key: false,
        debug_oidc_parent_error: true,
        oidc_legacy_introspection: false,
        oidc_trigger_introspection_projections: false,
        disable_user_token_event: false,
      };

      mockDatabase.queryOne.mockResolvedValue(mockFeatures);

      const features = await queries.getSystemFeatures();

      expect(features.triggerIntrospectionProjections).toBe(true);
      expect(features.actions).toBe(true);
      expect(features.improveredPerformance).toBe(true);
      expect(features.debugOIDCParentError).toBe(true);
    });
  });

  describe('isInstanceFeatureEnabled', () => {
    it('should check if specific feature is enabled', async () => {
      const mockFeatures = {
        instance_id: TEST_INSTANCE_ID,
        login_default_org: false,
        trigger_introspection_projections: false,
        legacy_introspection: false,
        user_schema: false,
        token_exchange: true,
        actions: false,
        improved_performance: false,
        web_key: false,
        debug_oidc_parent_error: false,
        oidc_legacy_introspection: false,
        oidc_trigger_introspection_projections: false,
        disable_user_token_event: false,
      };

      mockDatabase.queryOne.mockResolvedValue(mockFeatures);

      const isEnabled = await queries.isInstanceFeatureEnabled(TEST_INSTANCE_ID, 'tokenExchange');
      const isDisabled = await queries.isInstanceFeatureEnabled(TEST_INSTANCE_ID, 'actions');

      expect(isEnabled).toBe(true);
      expect(isDisabled).toBe(false);
    });
  });
});
