/**
 * Unit tests for IDPQueries
 * Tests identity provider lookups for external authentication
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IDPQueries } from '../../../../src/lib/query/idp/idp-queries';
import { IDPType, IDPState } from '../../../../src/lib/query/idp/idp-types';

describe('IDPQueries', () => {
  let queries: IDPQueries;
  let mockDatabase: any;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
    queries = new IDPQueries(mockDatabase);
  });

  describe('getIDPByID', () => {
    it('should return IDP by ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        id: 'idp-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        name: 'My OIDC Provider',
        type: IDPType.OIDC,
        state: IDPState.ACTIVE,
        styling_type: 0,
        is_creation_allowed: true,
        is_linking_allowed: true,
        is_auto_creation: false,
        is_auto_update: false,
        config_data: {},
      });

      const result = await queries.getIDPByID('idp-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('idp-123');
      expect(result?.name).toBe('My OIDC Provider');
      expect(result?.type).toBe(IDPType.OIDC);
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['idp-123']
      );
    });

    it('should return null when IDP not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getIDPByID('non-existent');

      expect(result).toBeNull();
    });

    it('should filter by instance ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        id: 'idp-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        name: 'Test IDP',
        type: IDPType.OAUTH,
        state: IDPState.ACTIVE,
        styling_type: 0,
        is_creation_allowed: true,
        is_linking_allowed: true,
        is_auto_creation: false,
        is_auto_update: false,
      });

      await queries.getIDPByID('idp-123', 'inst-123');

      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('instance_id = $2'),
        ['idp-123', 'inst-123']
      );
    });
  });

  describe('searchIDPs', () => {
    it('should search IDPs without filters', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'idp-1',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            name: 'Google',
            type: IDPType.GOOGLE,
            state: IDPState.ACTIVE,
            styling_type: 0,
            is_creation_allowed: true,
            is_linking_allowed: true,
            is_auto_creation: false,
            is_auto_update: false,
          },
          {
            id: 'idp-2',
            creation_date: new Date('2024-01-02'),
            change_date: new Date('2024-01-02'),
            sequence: 2,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            name: 'Azure AD',
            type: IDPType.AZURE,
            state: IDPState.ACTIVE,
            styling_type: 0,
            is_creation_allowed: true,
            is_linking_allowed: true,
            is_auto_creation: false,
            is_auto_update: false,
          },
        ],
      });

      const result = await queries.searchIDPs({});

      expect(result.total).toBe(2);
      expect(result.idps).toHaveLength(2);
      expect(result.idps[0].type).toBe(IDPType.GOOGLE);
      expect(result.idps[1].type).toBe(IDPType.AZURE);
    });

    it('should search IDPs by type', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchIDPs({
        type: IDPType.OIDC,
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE type = $1'),
        expect.arrayContaining([IDPType.OIDC])
      );
    });

    it('should search IDPs by name', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchIDPs({
        name: 'Google',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $1'),
        expect.arrayContaining(['%Google%'])
      );
    });

    it('should support pagination', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '100' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await queries.searchIDPs({
        limit: 20,
        offset: 40,
      });

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(40);
    });
  });

  describe('getIDPTemplate', () => {
    it('should return IDP template by ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        id: 'template-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        name: 'OIDC Template',
        type: IDPType.OIDC,
        owner_type: 'org',
        is_creation_allowed: true,
        is_linking_allowed: true,
        is_auto_creation: false,
        is_auto_update: false,
      });

      const result = await queries.getIDPTemplate('template-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('template-123');
      expect(result?.ownerType).toBe('org');
    });

    it('should return null when template not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getIDPTemplate('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('searchIDPTemplates', () => {
    it('should search templates by owner type', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            id: 'template-1',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            name: 'Org Template',
            type: IDPType.OIDC,
            owner_type: 'org',
            is_creation_allowed: true,
            is_linking_allowed: true,
            is_auto_creation: false,
            is_auto_update: false,
          },
          {
            id: 'template-2',
            creation_date: new Date('2024-01-02'),
            change_date: new Date('2024-01-02'),
            sequence: 2,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            name: 'Another Org Template',
            type: IDPType.OAUTH,
            owner_type: 'org',
            is_creation_allowed: true,
            is_linking_allowed: true,
            is_auto_creation: false,
            is_auto_update: false,
          },
        ],
      });

      const result = await queries.searchIDPTemplates({
        ownerType: 'org',
      });

      expect(result.total).toBe(2);
      expect(result.templates).toHaveLength(2);
      expect(result.templates.every(t => t.ownerType === 'org')).toBe(true);
    });
  });

  describe('getUserIDPLink', () => {
    it('should return user-IDP link', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        idp_id: 'idp-123',
        user_id: 'user-456',
        idp_name: 'Google',
        provided_user_id: 'google-user-123',
        provided_user_name: 'john.doe@example.com',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
      });

      const result = await queries.getUserIDPLink('user-456', 'idp-123');

      expect(result).toBeDefined();
      expect(result?.userID).toBe('user-456');
      expect(result?.idpID).toBe('idp-123');
      expect(result?.providedUserID).toBe('google-user-123');
    });

    it('should return null when link not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getUserIDPLink('user-1', 'idp-1');

      expect(result).toBeNull();
    });
  });

  describe('searchUserIDPLinks', () => {
    it('should search links by user ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            idp_id: 'idp-1',
            user_id: 'user-123',
            idp_name: 'Google',
            provided_user_id: 'google-123',
            provided_user_name: 'user@example.com',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
          },
          {
            idp_id: 'idp-2',
            user_id: 'user-123',
            idp_name: 'Azure',
            provided_user_id: 'azure-456',
            provided_user_name: 'user@company.com',
            creation_date: new Date('2024-01-02'),
            change_date: new Date('2024-01-02'),
            sequence: 2,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
          },
        ],
      });

      const result = await queries.searchUserIDPLinks({
        userID: 'user-123',
      });

      expect(result.total).toBe(2);
      expect(result.links).toHaveLength(2);
      expect(result.links.every(link => link.userID === 'user-123')).toBe(true);
    });

    it('should search links by IDP ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchUserIDPLinks({
        idpID: 'idp-123',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE idp_id = $1'),
        expect.arrayContaining(['idp-123'])
      );
    });
  });

  describe('getLoginPolicyIDPLink', () => {
    it('should return login policy IDP link', async () => {
      mockDatabase.queryOne.mockResolvedValue({
        idp_id: 'idp-123',
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: 1,
        resource_owner: 'org-123',
        instance_id: 'inst-123',
        owner_type: 'org',
      });

      const result = await queries.getLoginPolicyIDPLink('idp-123', 'org-123');

      expect(result).toBeDefined();
      expect(result?.idpID).toBe('idp-123');
      expect(result?.resourceOwner).toBe('org-123');
      expect(result?.ownerType).toBe('org');
    });

    it('should return null when link not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await queries.getLoginPolicyIDPLink('idp-1', 'org-1');

      expect(result).toBeNull();
    });
  });

  describe('searchLoginPolicyIDPLinks', () => {
    it('should search policy links by resource owner', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.query.mockResolvedValue({
        rows: [
          {
            idp_id: 'idp-1',
            creation_date: new Date('2024-01-01'),
            change_date: new Date('2024-01-01'),
            sequence: 1,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            owner_type: 'org',
          },
          {
            idp_id: 'idp-2',
            creation_date: new Date('2024-01-02'),
            change_date: new Date('2024-01-02'),
            sequence: 2,
            resource_owner: 'org-123',
            instance_id: 'inst-123',
            owner_type: 'org',
          },
        ],
      });

      const result = await queries.searchLoginPolicyIDPLinks({
        resourceOwner: 'org-123',
      });

      expect(result.total).toBe(2);
      expect(result.links).toHaveLength(2);
      expect(result.links.every(link => link.resourceOwner === 'org-123')).toBe(true);
    });

    it('should filter by owner type', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await queries.searchLoginPolicyIDPLinks({
        ownerType: 'instance',
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE owner_type = $1'),
        expect.arrayContaining(['instance'])
      );
    });
  });
});
