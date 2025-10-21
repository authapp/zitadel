/**
 * Unit tests for Admin Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AdminQueries } from '../../../../src/lib/query/admin/admin-queries';
import { MilestoneType, WebKeyState } from '../../../../src/lib/query/admin/admin-types';
import { DatabasePool } from '../../../../src/lib/database';

describe('AdminQueries', () => {
  let queries: AdminQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';
  const TEST_USER_ID = 'user-456';
  const TEST_PROJECT_ID = 'project-789';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new AdminQueries(mockDatabase);
  });

  describe('Personal Access Tokens', () => {
    describe('searchPersonalAccessTokens', () => {
      it('should return all tokens for instance', async () => {
        const mockTokens = [
          {
            id: 'token-1',
            user_id: TEST_USER_ID,
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 1,
            scopes: ['openid', 'profile'],
            expiration_date: new Date(Date.now() + 86400000),
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockTokens } as any);

        const tokens = await queries.searchPersonalAccessTokens(TEST_INSTANCE_ID);

        expect(tokens).toHaveLength(1);
        expect(tokens[0].userID).toBe(TEST_USER_ID);
        expect(tokens[0].scopes).toContain('openid');
      });

      it('should filter by user ID', async () => {
        const mockTokens = [
          {
            id: 'token-1',
            user_id: TEST_USER_ID,
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 1,
            scopes: ['openid'],
            expiration_date: new Date(),
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockTokens } as any);

        const tokens = await queries.searchPersonalAccessTokens(TEST_INSTANCE_ID, TEST_USER_ID);

        expect(tokens).toHaveLength(1);
        expect(tokens[0].userID).toBe(TEST_USER_ID);
      });
    });

    describe('getPersonalAccessTokenByID', () => {
      it('should return token by ID', async () => {
        const mockToken = {
          id: 'token-1',
          user_id: TEST_USER_ID,
          instance_id: TEST_INSTANCE_ID,
          creation_date: new Date(),
          change_date: new Date(),
          sequence: 1,
          scopes: ['openid', 'email'],
          expiration_date: new Date(),
        };

        mockDatabase.queryOne.mockResolvedValue(mockToken);

        const token = await queries.getPersonalAccessTokenByID(TEST_INSTANCE_ID, 'token-1');

        expect(token).toBeTruthy();
        expect(token!.id).toBe('token-1');
        expect(token!.scopes).toHaveLength(2);
      });

      it('should return null when not found', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const token = await queries.getPersonalAccessTokenByID(TEST_INSTANCE_ID, 'nonexistent');

        expect(token).toBeNull();
      });
    });
  });

  describe('Quotas', () => {
    describe('getQuota', () => {
      it('should return quota by unit', async () => {
        const mockQuota = {
          instance_id: TEST_INSTANCE_ID,
          unit: 'requests',
          from_date: new Date(),
          interval: 3600,
          has_limit: true,
          amount: 10000,
          usage: 5000,
        };

        mockDatabase.queryOne.mockResolvedValue(mockQuota);

        const quota = await queries.getQuota(TEST_INSTANCE_ID, 'requests');

        expect(quota).toBeTruthy();
        expect(quota!.unit).toBe('requests');
        expect(quota!.limit).toBe(true);
        expect(quota!.amount).toBe(10000);
        expect(quota!.usage).toBe(5000);
      });
    });

    describe('getQuotas', () => {
      it('should return all quotas', async () => {
        const mockQuotas = [
          {
            instance_id: TEST_INSTANCE_ID,
            unit: 'requests',
            from_date: new Date(),
            interval: 3600,
            has_limit: true,
            amount: 10000,
            usage: 5000,
          },
          {
            instance_id: TEST_INSTANCE_ID,
            unit: 'actions.all.runs',
            from_date: new Date(),
            interval: 3600,
            has_limit: true,
            amount: 1000,
            usage: 200,
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockQuotas } as any);

        const quotas = await queries.getQuotas(TEST_INSTANCE_ID);

        expect(quotas).toHaveLength(2);
        expect(quotas[0].unit).toBe('requests');
        expect(quotas[1].unit).toBe('actions.all.runs');
      });
    });

    describe('getCurrentQuotaPeriod', () => {
      it('should return current period', async () => {
        const mockPeriod = {
          unit: 'requests',
          period_start: new Date(),
          usage: 1000,
        };

        mockDatabase.queryOne.mockResolvedValue(mockPeriod);

        const period = await queries.getCurrentQuotaPeriod(TEST_INSTANCE_ID, 'requests');

        expect(period).toBeTruthy();
        expect(period!.unit).toBe('requests');
        expect(period!.usage).toBe(1000);
      });
    });
  });

  describe('Restrictions', () => {
    describe('getRestrictions', () => {
      it('should return instance restrictions', async () => {
        const mockRestrictions = {
          disallow_public_org_registration: true,
          allowed_languages: ['en', 'de'],
        };

        mockDatabase.queryOne.mockResolvedValue(mockRestrictions);

        const restrictions = await queries.getRestrictions(TEST_INSTANCE_ID);

        expect(restrictions.disallowPublicOrgRegistration).toBe(true);
        expect(restrictions.allowedLanguages).toContain('en');
        expect(restrictions.allowedLanguages).toContain('de');
      });

      it('should return defaults when not configured', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const restrictions = await queries.getRestrictions(TEST_INSTANCE_ID);

        expect(restrictions.disallowPublicOrgRegistration).toBe(false);
        expect(restrictions.allowedLanguages).toEqual([]);
      });
    });

    describe('getDefaultRestrictions', () => {
      it('should return default restrictions', () => {
        const restrictions = queries.getDefaultRestrictions();

        expect(restrictions.disallowPublicOrgRegistration).toBe(false);
        expect(restrictions.allowedLanguages).toEqual([]);
      });
    });
  });

  describe('Milestones', () => {
    describe('getMilestones', () => {
      it('should return all milestones', async () => {
        const mockMilestones = [
          {
            type: MilestoneType.INSTANCE_CREATED,
            instance_id: TEST_INSTANCE_ID,
            reached: true,
            pushed_date: new Date(),
            reached_date: new Date(),
          },
          {
            type: MilestoneType.PROJECT_CREATED,
            instance_id: TEST_INSTANCE_ID,
            reached: false,
            pushed_date: null,
            reached_date: null,
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockMilestones } as any);

        const milestones = await queries.getMilestones(TEST_INSTANCE_ID);

        expect(milestones).toHaveLength(2);
        expect(milestones[0].reached).toBe(true);
        expect(milestones[1].reached).toBe(false);
      });
    });

    describe('getMilestoneByType', () => {
      it('should return milestone by type', async () => {
        const mockMilestone = {
          type: MilestoneType.INSTANCE_CREATED,
          instance_id: TEST_INSTANCE_ID,
          reached: true,
          pushed_date: new Date(),
          reached_date: new Date(),
        };

        mockDatabase.queryOne.mockResolvedValue(mockMilestone);

        const milestone = await queries.getMilestoneByType(
          TEST_INSTANCE_ID,
          MilestoneType.INSTANCE_CREATED
        );

        expect(milestone).toBeTruthy();
        expect(milestone!.type).toBe(MilestoneType.INSTANCE_CREATED);
        expect(milestone!.reached).toBe(true);
      });
    });
  });

  describe('Web Keys', () => {
    describe('getWebKeyByState', () => {
      it('should return web key by state', async () => {
        const mockKey = {
          id: 'key-1',
          instance_id: TEST_INSTANCE_ID,
          creation_date: new Date(),
          change_date: new Date(),
          sequence: 1,
          state: WebKeyState.ACTIVE,
          key_use: 'sig',
          algorithm: 'RS256',
          public_key: 'public-key-content',
        };

        mockDatabase.queryOne.mockResolvedValue(mockKey);

        const key = await queries.getWebKeyByState(TEST_INSTANCE_ID, WebKeyState.ACTIVE);

        expect(key).toBeTruthy();
        expect(key!.state).toBe(WebKeyState.ACTIVE);
        expect(key!.config.use).toBe('sig');
      });
    });

    describe('searchWebKeys', () => {
      it('should return all web keys', async () => {
        const mockKeys = [
          {
            id: 'key-1',
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 1,
            state: WebKeyState.ACTIVE,
            key_use: 'sig',
            algorithm: 'RS256',
            public_key: 'key1',
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockKeys } as any);

        const keys = await queries.searchWebKeys(TEST_INSTANCE_ID);

        expect(keys).toHaveLength(1);
        expect(keys[0].config.algorithm).toBe('RS256');
      });
    });

    describe('getPublicKeys', () => {
      it('should return only active public keys', async () => {
        const mockKeys = [
          {
            id: 'key-1',
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 1,
            state: WebKeyState.ACTIVE,
            key_use: 'sig',
            algorithm: 'RS256',
            public_key: 'key1',
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockKeys } as any);

        const keys = await queries.getPublicKeys(TEST_INSTANCE_ID);

        expect(keys).toHaveLength(1);
        expect(keys[0].state).toBe(WebKeyState.ACTIVE);
      });
    });
  });

  describe('Failed Events', () => {
    describe('getFailedEvents', () => {
      it('should return failed events', async () => {
        const mockEvents = [
          {
            project_id: TEST_PROJECT_ID,
            event_type: 'user.added',
            aggregate_type: 'user',
            aggregate_id: 'user-123',
            failure_count: 3,
            error: 'Database connection failed',
            last_failed: new Date(),
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockEvents } as any);

        const events = await queries.getFailedEvents(TEST_PROJECT_ID);

        expect(events).toHaveLength(1);
        expect(events[0].eventType).toBe('user.added');
        expect(events[0].failureCount).toBe(3);
        expect(events[0].error).toContain('Database');
      });
    });
  });
});
