/**
 * Session manager implementation
 */

import { Cache } from '../cache/types';
import { Session, SessionManager, SessionExpiredError } from './types';
import { generateId } from '../id/snowflake';

/**
 * Cache-based session manager
 */
export class CacheSessionManager implements SessionManager {
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(
    private cache: Cache,
    private sessionTtl: number = CacheSessionManager.prototype.DEFAULT_TTL
  ) {}

  /**
   * Create new session
   */
  async create(
    userId: string,
    instanceId: string,
    metadata?: Record<string, any>
  ): Promise<Session> {
    const sessionId = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtl * 1000);

    const session: Session = {
      id: sessionId,
      userId,
      instanceId,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      metadata,
    };

    // Store session
    await this.cache.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      this.sessionTtl
    );

    // Track user sessions
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const existingSessions = await this.cache.get(userSessionsKey);
    const sessions = existingSessions ? JSON.parse(existingSessions) : [];
    sessions.push(sessionId);
    await this.cache.set(userSessionsKey, JSON.stringify(sessions), this.sessionTtl);

    return session;
  }

  /**
   * Get session by ID
   */
  async get(sessionId: string): Promise<Session | null> {
    const data = await this.cache.get(`${this.SESSION_PREFIX}${sessionId}`);
    if (!data) {
      return null;
    }

    try {
      const session = JSON.parse(data) as Session;
      // Restore Date objects
      session.createdAt = new Date(session.createdAt);
      session.expiresAt = new Date(session.expiresAt);
      session.lastActivityAt = new Date(session.lastActivityAt);
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Update session activity
   */
  async updateActivity(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionExpiredError();
    }

    session.lastActivityAt = new Date();

    // Update session with renewed TTL
    await this.cache.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      this.sessionTtl
    );
  }

  /**
   * Delete session
   */
  async delete(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (session) {
      // Remove from cache
      await this.cache.mdel([`${this.SESSION_PREFIX}${sessionId}`]);

      // Remove from user sessions
      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${session.userId}`;
      const data = await this.cache.get(userSessionsKey);
      if (data) {
        const sessions = JSON.parse(data) as string[];
        const updated = sessions.filter(id => id !== sessionId);
        await this.cache.set(userSessionsKey, JSON.stringify(updated), this.sessionTtl);
      }
    }
  }

  /**
   * Delete all sessions for user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
    const data = await this.cache.get(userSessionsKey);
    
    if (data) {
      const sessions = JSON.parse(data) as string[];
      
      // Delete all session keys
      const keys = sessions.map(id => `${this.SESSION_PREFIX}${id}`);
      await this.cache.mdel(keys);
      
      // Delete user sessions index
      await this.cache.mdel([userSessionsKey]);
    }
  }

  /**
   * Check if session is valid
   */
  async isValid(sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId);
    if (!session) {
      return false;
    }

    const now = new Date();
    return now < session.expiresAt;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpired(): Promise<number> {
    // With cache-based sessions, expiration is handled automatically by TTL
    // This method is mainly for compatibility with other implementations
    return 0;
  }
}

/**
 * In-memory session manager for testing
 */
export class InMemorySessionManager implements SessionManager {
  private sessions = new Map<string, Session>();
  private userSessions = new Map<string, Set<string>>();
  private readonly sessionTtl: number;

  constructor(sessionTtl: number = 24 * 60 * 60 * 1000) {
    this.sessionTtl = sessionTtl;
  }

  async create(
    userId: string,
    instanceId: string,
    metadata?: Record<string, any>
  ): Promise<Session> {
    const sessionId = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtl);

    const session: Session = {
      id: sessionId,
      userId,
      instanceId,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      metadata,
    };

    this.sessions.set(sessionId, session);

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    return session;
  }

  async get(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionExpiredError();
    }

    session.lastActivityAt = new Date();
  }

  async delete(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.userSessions.get(session.userId)?.delete(sessionId);
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const sessionIds = this.userSessions.get(userId);
    if (sessionIds) {
      sessionIds.forEach(id => this.sessions.delete(id));
      this.userSessions.delete(userId);
    }
  }

  async isValid(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const now = new Date();
    return now < session.expiresAt;
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now >= session.expiresAt) {
        this.sessions.delete(sessionId);
        this.userSessions.get(session.userId)?.delete(sessionId);
        count++;
      }
    }

    return count;
  }

  /**
   * Get all sessions (for testing)
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
}

/**
 * Create session manager
 */
export function createSessionManager(cache: Cache, sessionTtl?: number): SessionManager {
  return new CacheSessionManager(cache, sessionTtl);
}

/**
 * Create in-memory session manager for testing
 */
export function createInMemorySessionManager(sessionTtl?: number): InMemorySessionManager {
  return new InMemorySessionManager(sessionTtl);
}
