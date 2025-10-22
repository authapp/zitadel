/**
 * Session Queries Unit Tests
 * 
 * Comprehensive tests for all session query methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SessionQueries } from '../../../../src/lib/query/session/session-queries';
import { DatabasePool } from '../../../../src/lib/database/pool';
import { SessionState } from '../../../../src/lib/query/session/session-types';

describe('SessionQueries', () => {
  let sessionQueries: SessionQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    } as any;

    sessionQueries = new SessionQueries(mockDatabase);
  });

  describe('getSessionByID', () => {
    it('should return session when found', async () => {
      const mockSession = {
        id: 'session-123',
        user_id: 'user-1',
        instance_id: 'inst-1',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        sequence: 1,
        state: SessionState.ACTIVE,
        user_agent: 'Mozilla/5.0',
        metadata: {},
        tokens: [],
        factors: [],
      };

      mockDatabase.queryOne.mockResolvedValue(mockSession);

      const result = await sessionQueries.getSessionByID('session-123', 'inst-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('session-123');
      expect(result?.userID).toBe('user-1');
      expect(result?.state).toBe(SessionState.ACTIVE);
      expect(mockDatabase.queryOne).toHaveBeenCalled();
    });

    it('should return null when session not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await sessionQueries.getSessionByID('nonexistent', 'inst-1');

      expect(result).toBeNull();
    });

    it('should work without instance ID', async () => {
      const mockSession = {
        id: 'session-123',
        user_id: 'user-1',
        state: SessionState.ACTIVE,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        sequence: 1,
        metadata: {},
        tokens: [],
        factors: [],
      };

      mockDatabase.queryOne.mockResolvedValue(mockSession);

      const result = await sessionQueries.getSessionByID('session-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('session-123');
    });
  });

  describe('searchSessions', () => {
    it('should return all sessions when no filters', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-1',
          instance_id: 'inst-1',
          state: SessionState.ACTIVE,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          sequence: 1,
          metadata: {},
          tokens: [],
          factors: [],
        },
      ];

      mockDatabase.queryOne.mockResolvedValue({ count: '1' });
      mockDatabase.queryMany.mockResolvedValue(mockSessions as any);

      const result = await sessionQueries.searchSessions({});

      expect(result.total).toBe(1);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].id).toBe('session-1');
    });

    it('should filter by user ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.queryMany.mockResolvedValue([]);

      await sessionQueries.searchSessions({ userID: 'user-1' });

      expect(mockDatabase.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('s.user_id = $'),
        expect.arrayContaining(['user-1'])
      );
    });

    it('should filter by instance ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.queryMany.mockResolvedValue([]);

      await sessionQueries.searchSessions({ instanceID: 'inst-1' });

      expect(mockDatabase.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('s.instance_id = $'),
        expect.arrayContaining(['inst-1'])
      );
    });

    it('should filter by state', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.queryMany.mockResolvedValue([]);

      await sessionQueries.searchSessions({ state: SessionState.ACTIVE });

      expect(mockDatabase.queryMany).toHaveBeenCalled();
    });

    it('should apply sorting', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.queryMany.mockResolvedValue([]);

      await sessionQueries.searchSessions({ sortBy: 'created_at', sortOrder: 'DESC' });

      expect(mockDatabase.queryMany).toHaveBeenCalled();
    });

    it('should apply pagination', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '100' });
      mockDatabase.queryMany.mockResolvedValue([]);

      await sessionQueries.searchSessions({ limit: 10, offset: 20 });

      expect(mockDatabase.queryMany).toHaveBeenCalled();
    });
  });

  describe('getActiveSessionsCount', () => {
    it('should return count of active sessions', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '42' });

      const result = await sessionQueries.getActiveSessionsCount({});

      expect(result.count).toBe(42);
      expect(mockDatabase.queryOne).toHaveBeenCalled();
    });

    it('should filter count by user ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '5' });

      const result = await sessionQueries.getActiveSessionsCount({ userID: 'user-1' });

      expect(result.count).toBe(5);
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('s.user_id = $'),
        expect.arrayContaining(['user-1'])
      );
    });

    it('should filter count by instance ID', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '10' });

      const result = await sessionQueries.getActiveSessionsCount({ instanceID: 'inst-1' });

      expect(result.count).toBe(10);
      expect(mockDatabase.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('s.instance_id = $'),
        expect.arrayContaining(['inst-1'])
      );
    });
  });

  describe('getSessionSummary', () => {
    it('should return session summary', async () => {
      const mockSession = {
        id: 'session-123',
        user_id: 'user-1',
        state: SessionState.ACTIVE,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        sequence: 1,
        metadata: {},
        tokens: [],
        factors: [],
      };

      mockDatabase.queryOne.mockResolvedValue(mockSession);

      const result = await sessionQueries.getSessionSummary('session-123', 'inst-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('session-123');
      expect(result?.userID).toBe('user-1');
      expect(result?.state).toBe(SessionState.ACTIVE);
    });

    it('should return null when session not found', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const result = await sessionQueries.getSessionSummary('nonexistent', 'inst-1');

      expect(result).toBeNull();
    });
  });

  describe('getUserActiveSessions', () => {
    it('should return active sessions for user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-1',
          state: SessionState.ACTIVE,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
          sequence: 1,
          metadata: {},
          tokens: [],
          factors: [],
        },
        {
          id: 'session-2',
          user_id: 'user-1',
          state: SessionState.ACTIVE,
          created_at: new Date('2024-01-02'),
          updated_at: new Date('2024-01-02'),
          sequence: 1,
          metadata: {},
          tokens: [],
          factors: [],
        },
      ];

      mockDatabase.queryOne.mockResolvedValue({ count: '2' });
      mockDatabase.queryMany.mockResolvedValue(mockSessions as any);

      const result = await sessionQueries.getUserActiveSessions('user-1', 'inst-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session-1');
      expect(result[1].id).toBe('session-2');
    });

    it('should return empty array when no active sessions', async () => {
      mockDatabase.queryOne.mockResolvedValue({ count: '0' });
      mockDatabase.queryMany.mockResolvedValue([]);

      const result = await sessionQueries.getUserActiveSessions('user-1', 'inst-1');

      expect(result).toHaveLength(0);
    });
  });
});
