/**
 * Session queries for Zitadel query layer
 * Handles session lookups and searches
 */

import { DatabasePool } from '../../database';
import {
  Session,
  SessionSearchQuery,
  SessionSearchResult,
  ActiveSessionsCountQuery,
  ActiveSessionsCountResult,
  SessionState,
  SessionSummary,
  SessionToken,
  AuthFactor,
} from './session-types';

export class SessionQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get session by ID
   */
  async getSessionByID(sessionID: string, instanceID?: string): Promise<Session | null> {
    const conditions = ['s.id = $1'];
    const params: any[] = [sessionID];

    if (instanceID) {
      conditions.push('s.instance_id = $2');
      params.push(instanceID);
    }

    const query = `
      SELECT 
        s.id,
        s.instance_id,
        s.state,
        s.user_id,
        s.user_agent,
        s.client_ip,
        s.created_at,
        s.updated_at,
        s.terminated_at,
        s.sequence,
        s.metadata,
        s.tokens,
        s.factors
      FROM sessions_projection s
      WHERE ${conditions.join(' AND ')}
    `;

    const row = await this.database.queryOne(query, params);
    if (!row) return null;

    return this.mapRowToSession(row);
  }

  /**
   * Search sessions with filters
   */
  async searchSessions(query: SessionSearchQuery): Promise<SessionSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`s.instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.userID) {
      conditions.push(`s.user_id = $${paramIndex++}`);
      params.push(query.userID);
    }

    if (query.state) {
      conditions.push(`s.state = $${paramIndex++}`);
      params.push(query.state);
    }

    if (query.active !== undefined) {
      if (query.active) {
        conditions.push(`s.state = $${paramIndex++}`);
        params.push(SessionState.ACTIVE);
      } else {
        conditions.push(`s.state = $${paramIndex++}`);
        params.push(SessionState.TERMINATED);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM sessions_projection s ${whereClause}`;
    const countResult = await this.database.queryOne(countQuery, params);
    const total = parseInt(countResult?.count || '0', 10);

    // Get sessions with pagination
    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'DESC';
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const dataQuery = `
      SELECT 
        s.id,
        s.instance_id,
        s.state,
        s.user_id,
        s.user_agent,
        s.client_ip,
        s.created_at,
        s.updated_at,
        s.terminated_at,
        s.sequence,
        s.metadata,
        s.tokens,
        s.factors
      FROM sessions_projection s
      ${whereClause}
      ORDER BY s.${sortBy} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const rows = await this.database.queryMany(dataQuery, params);
    const sessions = rows.map(row => this.mapRowToSession(row));

    return {
      sessions,
      total,
    };
  }

  /**
   * Get active sessions count
   */
  async getActiveSessionsCount(query: ActiveSessionsCountQuery): Promise<ActiveSessionsCountResult> {
    const conditions: string[] = ['s.state = $1'];
    const params: any[] = [SessionState.ACTIVE];
    let paramIndex = 2;

    if (query.instanceID) {
      conditions.push(`s.instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.userID) {
      conditions.push(`s.user_id = $${paramIndex++}`);
      params.push(query.userID);
    }

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM sessions_projection s 
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.database.queryOne(countQuery, params);
    const count = parseInt(result?.count || '0', 10);

    return { count };
  }

  /**
   * Get session summary (lightweight)
   */
  async getSessionSummary(sessionID: string, instanceID?: string): Promise<SessionSummary | null> {
    const session = await this.getSessionByID(sessionID, instanceID);
    if (!session) return null;

    const now = new Date();
    const validTokenCount = session.tokens.filter(t => t.expiry > now).length;
    const verifiedFactors = session.factors
      .filter(f => f.verified)
      .map(f => f.type);

    return {
      id: session.id,
      instanceID: session.instanceID,
      state: session.state,
      userID: session.userID,
      userAgent: session.userAgent,
      clientIP: session.clientIP,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      terminatedAt: session.terminatedAt,
      verifiedFactors,
      validTokenCount,
    };
  }

  /**
   * Get active sessions for user
   */
  async getUserActiveSessions(userID: string, instanceID?: string): Promise<Session[]> {
    const query: SessionSearchQuery = {
      userID,
      instanceID,
      state: SessionState.ACTIVE,
      sortBy: 'updated_at',
      sortOrder: 'DESC',
    };

    const result = await this.searchSessions(query);
    return result.sessions;
  }

  /**
   * Check if session is active
   */
  async isSessionActive(sessionID: string, instanceID?: string): Promise<boolean> {
    const session = await this.getSessionByID(sessionID, instanceID);
    return session ? session.state === SessionState.ACTIVE : false;
  }

  /**
   * Helper: Map database row to Session object
   */
  private mapRowToSession(row: any): Session {
    return {
      id: row.id,
      instanceID: row.instance_id,
      state: row.state as SessionState,
      userID: row.user_id,
      userAgent: row.user_agent,
      clientIP: row.client_ip,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      terminatedAt: row.terminated_at ? new Date(row.terminated_at) : undefined,
      sequence: BigInt(row.sequence || 0),
      metadata: this.parseMetadata(row.metadata),
      tokens: this.parseTokens(row.tokens),
      factors: this.parseFactors(row.factors),
    };
  }

  /**
   * Helper: Parse metadata JSON
   */
  private parseMetadata(metadata: any): Record<string, string> {
    if (!metadata) return {};
    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch {
        return {};
      }
    }
    return metadata;
  }

  /**
   * Helper: Parse tokens JSON
   */
  private parseTokens(tokens: any): SessionToken[] {
    if (!tokens) return [];
    if (typeof tokens === 'string') {
      try {
        const parsed = JSON.parse(tokens);
        return Array.isArray(parsed) ? parsed.map(t => ({
          ...t,
          expiry: new Date(t.expiry),
        })) : [];
      } catch {
        return [];
      }
    }
    if (Array.isArray(tokens)) {
      return tokens.map(t => ({
        ...t,
        expiry: new Date(t.expiry),
      }));
    }
    return [];
  }

  /**
   * Helper: Parse factors JSON
   */
  private parseFactors(factors: any): AuthFactor[] {
    if (!factors) return [];
    if (typeof factors === 'string') {
      try {
        const parsed = JSON.parse(factors);
        return Array.isArray(parsed) ? parsed.map(f => ({
          ...f,
          verifiedAt: f.verifiedAt ? new Date(f.verifiedAt) : undefined,
        })) : [];
      } catch {
        return [];
      }
    }
    if (Array.isArray(factors)) {
      return factors.map(f => ({
        ...f,
        verifiedAt: f.verifiedAt ? new Date(f.verifiedAt) : undefined,
      }));
    }
    return [];
  }
}
