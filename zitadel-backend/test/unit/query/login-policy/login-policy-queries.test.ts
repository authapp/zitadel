/**
 * Unit tests for LoginPolicyQueries
 * Tests authentication policy lookups including MFA and password policies
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LoginPolicyQueries } from '../../../../src/lib/query/login-policy/login-policy-queries';
import { SecondFactorType, MultiFactorType } from '../../../../src/lib/query/login-policy/login-policy-types';

describe('LoginPolicyQueries', () => {
  let queries: LoginPolicyQueries;
  let mockDatabase: any;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
    queries = new LoginPolicyQueries(mockDatabase);
  });

  describe('getActiveLoginPolicy', () => {
    it('should return org-specific policy when available', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        allow_username_password: true,
        allow_register: true,
        allow_external_idp: true,
        force_mfa: true,
        force_mfa_local_only: false,
        password_check_lifetime: 3600,
        external_login_check_lifetime: 3600,
        mfa_init_skip_lifetime: 0,
        second_factor_check_lifetime: 3600,
        multi_factor_check_lifetime: 3600,
        is_default: false,
      });

      // Mock factors query
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          { factor_type: SecondFactorType.OTP, is_multi_factor: false },
          { factor_type: MultiFactorType.U2F, is_multi_factor: true },
        ],
      });

      // Mock IDPs query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const result = await queries.getActiveLoginPolicy('org-123', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.isOrgPolicy).toBe(true);
      expect(result!.orgID).toBe('org-123');
      expect(result!.forceMFA).toBe(true);
      expect(result!.secondFactors).toContain(SecondFactorType.OTP);
      expect(result!.multiFactors).toContain(MultiFactorType.U2F);
    });

    it('should fall back to instance default policy', async () => {
      // First query for org policy returns null
      mockDatabase.queryOne.mockResolvedValueOnce(null);

      // Second query for instance default policy
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'inst-123',
        instance_id: 'inst-123',
        allow_username_password: true,
        allow_register: true,
        allow_external_idp: true,
        force_mfa: false,
        is_default: true,
      });

      // Mock factors query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      // Mock IDPs query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const result = await queries.getActiveLoginPolicy('org-123', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.isOrgPolicy).toBe(false);
      expect(result!.isDefault).toBe(true);
    });

    it('should return null when no policy found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getActiveLoginPolicy('org-123', 'inst-123');

      expect(result).toBeNull();
    });
  });

  describe('getLoginPolicy', () => {
    it('should return login policy by resource owner', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        allow_username_password: true,
        allow_register: false,
        allow_external_idp: true,
        force_mfa: true,
        is_default: false,
      });

      // Mock factors query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      // Mock IDPs query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const result = await queries.getLoginPolicy('org-123', 'inst-123');

      expect(result).toBeDefined();
      expect(result!.resourceOwner).toBe('org-123');
      expect(result!.allowRegister).toBe(false);
    });

    it('should return null when policy not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getLoginPolicy('org-123', 'inst-123');

      expect(result).toBeNull();
    });
  });

  describe('getLoginPolicyByID', () => {
    it('should return policy by ID', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        allow_username_password: true,
        allow_register: true,
        allow_external_idp: false,
        force_mfa: false,
        is_default: false,
      });

      // Mock factors query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      // Mock IDPs query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const result = await queries.getLoginPolicyByID('policy-123');

      expect(result).toBeDefined();
      expect(result!.id).toBe('policy-123');
      expect(result!.allowExternalIDP).toBe(false);
    });

    it('should filter by instance ID', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        allow_username_password: true,
        is_default: false,
      });

      // Mock factors query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      // Mock IDPs query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      await queries.getLoginPolicyByID('policy-123', 'inst-123');

      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('instance_id = $2'),
        ['policy-123', 'inst-123']
      );
    });
  });

  describe('getDefaultLoginPolicy', () => {
    it('should return default policy for instance', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'inst-123',
        instance_id: 'inst-123',
        allow_username_password: true,
        allow_register: true,
        allow_external_idp: true,
        force_mfa: false,
        is_default: true,
      });

      // Mock factors query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      // Mock IDPs query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const result = await queries.getDefaultLoginPolicy('inst-123');

      expect(result).toBeDefined();
      expect(result!.isDefault).toBe(true);
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('is_default = true'),
        ['inst-123']
      );
    });

    it('should return null when no default policy', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getDefaultLoginPolicy('inst-123');

      expect(result).toBeNull();
    });
  });

  describe('searchLoginPolicies', () => {
    it('should search policies without filters', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'policy-1',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            allow_username_password: true,
            is_default: false,
          },
          {
            id: 'policy-2',
            creation_date: new Date('2024-01-02'),
            change_date: new Date('2024-01-02'),
            sequence: 2,
            resource_owner: 'org-456',
            instance_id: 'inst-123',
            allow_username_password: true,
            is_default: false,
          },
        ],
      });

      // Mock factors queries (called for each policy)
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchLoginPolicies({});

      expect(result.total).toBe(2);
      expect(result.policies).toHaveLength(2);
    });

    it('should filter by instance ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchLoginPolicies({
        instanceID: 'inst-123',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE instance_id = $1'),
        expect.arrayContaining(['inst-123'])
      );
    });

    it('should support pagination', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '100' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchLoginPolicies({
        limit: 20,
        offset: 40,
      });

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(40);
    });
  });

  describe('getActiveIDPs', () => {
    it('should return active IDPs for policy', async () => {
      // Mock getActiveLoginPolicy
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        allow_external_idp: true,
        is_default: false,
      });

      // Mock factors query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      // Mock IDPs query for getActiveLoginPolicy
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      // Mock IDPs query for getActiveIDPs
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          { idp_id: 'idp-1', name: 'Google', type: 7 },
          { idp_id: 'idp-2', name: 'Azure', type: 6 },
        ],
      });

      const result = await queries.getActiveIDPs('org-123', 'inst-123');

      expect(result.idps).toHaveLength(2);
      expect(result.idps[0].name).toBe('Google');
      expect(result.idps[1].name).toBe('Azure');
    });

    it('should return empty array when no policy found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getActiveIDPs('org-123', 'inst-123');

      expect(result.idps).toHaveLength(0);
    });
  });

  describe('getSecondFactorsPolicy', () => {
    it('should return second factors policy', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        force_mfa: true,
        is_default: false,
      });

      // Mock factors query
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          { factor_type: SecondFactorType.OTP, is_multi_factor: false },
          { factor_type: SecondFactorType.U2F, is_multi_factor: false },
          { factor_type: MultiFactorType.OTP, is_multi_factor: true },
        ],
      });

      // Mock IDPs query
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const result = await queries.getSecondFactorsPolicy('org-123', 'inst-123');

      expect(result.secondFactors).toHaveLength(2);
      expect(result.multiFactors).toHaveLength(1);
      expect(result.secondFactors).toContain(SecondFactorType.OTP);
      expect(result.secondFactors).toContain(SecondFactorType.U2F);
      expect(result.multiFactors).toContain(MultiFactorType.OTP);
    });

    it('should return empty factors when no policy found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getSecondFactorsPolicy('org-123', 'inst-123');

      expect(result.secondFactors).toHaveLength(0);
      expect(result.multiFactors).toHaveLength(0);
    });
  });
});
