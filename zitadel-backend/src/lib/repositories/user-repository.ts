/**
 * User Repository
 * 
 * Handles all database operations for users
 */

import { DatabasePool } from '../database';
import { BaseRepository } from './base-repository';

export interface UserRow {
  id: string;
  instance_id: string;
  resource_owner: string;
  username: string;
  email?: string;
  email_verified?: boolean;
  email_verified_at?: Date;
  phone?: string;
  phone_verified?: boolean;
  phone_verified_at?: Date;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  nickname?: string;
  preferred_language?: string;
  gender?: string;
  avatar_url?: string;
  preferred_login_name?: string;
  login_names?: string[];
  state: string;
  password_hash?: string;
  password_changed_at?: Date;
  password_change_required?: boolean;
  mfa_enabled?: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface CreateUserInput {
  id: string;
  instanceId: string;
  resourceOwner: string;
  username: string;
  email?: string;
  emailVerifiedAt?: Date;
  phone?: string;
  phoneVerifiedAt?: Date;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  nickname?: string;
  preferredLanguage?: string;
  gender?: string;
  avatarUrl?: string;
  preferredLoginName?: string;
  loginNames?: string[];
  state?: string;
  passwordHash?: string;
  passwordChangedAt?: Date;
  passwordChangeRequired?: boolean;
  mfaEnabled?: boolean;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  nickname?: string;
  email?: string;
  emailVerifiedAt?: Date;
  phone?: string;
  phoneVerifiedAt?: Date;
  preferredLanguage?: string;
  gender?: string;
  avatarUrl?: string;
  preferredLoginName?: string;
  loginNames?: string[];
  state?: string;
  passwordHash?: string;
  passwordChangeRequired?: boolean;
}

export class UserRepository extends BaseRepository<UserRow> {
  constructor(pool: DatabasePool) {
    super(pool, 'users_projection');
  }

  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<UserRow> {
    const result = await this.pool.queryOne<UserRow>(
      `INSERT INTO users_projection (
        id, instance_id, resource_owner, username, email, email_verified_at,
        phone, phone_verified_at, first_name, last_name, display_name, nickname,
        preferred_language, gender, avatar_url, preferred_login_name, login_names,
        state, password_hash, password_changed_at, password_change_required, mfa_enabled,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW())
      RETURNING *`,
      [
        input.id,
        input.instanceId,
        input.resourceOwner,
        input.username,
        input.email || null,
        input.emailVerifiedAt || null,
        input.phone || null,
        input.phoneVerifiedAt || null,
        input.firstName || null,
        input.lastName || null,
        input.displayName || null,
        input.nickname || null,
        input.preferredLanguage || null,
        input.gender || null,
        input.avatarUrl || null,
        input.preferredLoginName || null,
        input.loginNames || null,
        input.state || 'active',
        input.passwordHash || null,
        input.passwordChangedAt || null,
        input.passwordChangeRequired || false,
        input.mfaEnabled || false,
      ]
    );

    if (!result) {
      throw new Error('Failed to create user');
    }

    return result;
  }

  /**
   * Find user by ID
   */
  async findById(id: string, instanceId: string = 'test-instance'): Promise<UserRow | null> {
    return this.pool.queryOne<UserRow>(
      `SELECT * FROM users_projection WHERE id = $1 AND instance_id = $2`,
      [id, instanceId]
    );
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string, instanceId: string = 'test-instance'): Promise<UserRow | null> {
    return this.pool.queryOne<UserRow>(
      `SELECT * FROM users_projection WHERE username = $1 AND instance_id = $2`,
      [username, instanceId]
    );
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string, instanceId: string = 'test-instance'): Promise<UserRow | null> {
    return this.pool.queryOne<UserRow>(
      `SELECT * FROM users_projection WHERE email = $1 AND instance_id = $2`,
      [email, instanceId]
    );
  }

  /**
   * Find all users
   */
  async findAll(instanceId: string = 'test-instance'): Promise<UserRow[]> {
    return this.pool.queryMany<UserRow>(
      `SELECT * FROM users_projection WHERE instance_id = $1 ORDER BY created_at DESC`,
      [instanceId]
    );
  }

  /**
   * Update user
   */
  async update(id: string, input: UpdateUserInput): Promise<UserRow | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.firstName !== undefined) {
      setClauses.push(`first_name = $${paramIndex++}`);
      values.push(input.firstName);
    }
    if (input.lastName !== undefined) {
      setClauses.push(`last_name = $${paramIndex++}`);
      values.push(input.lastName);
    }
    if (input.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      values.push(input.displayName);
    }
    if (input.nickname !== undefined) {
      setClauses.push(`nickname = $${paramIndex++}`);
      values.push(input.nickname);
    }
    if (input.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(input.email);
    }
    if (input.emailVerifiedAt !== undefined) {
      setClauses.push(`email_verified_at = $${paramIndex++}`);
      values.push(input.emailVerifiedAt);
    }
    if (input.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(input.phone);
    }
    if (input.phoneVerifiedAt !== undefined) {
      setClauses.push(`phone_verified_at = $${paramIndex++}`);
      values.push(input.phoneVerifiedAt);
    }
    if (input.preferredLanguage !== undefined) {
      setClauses.push(`preferred_language = $${paramIndex++}`);
      values.push(input.preferredLanguage);
    }
    if (input.gender !== undefined) {
      setClauses.push(`gender = $${paramIndex++}`);
      values.push(input.gender);
    }
    if (input.avatarUrl !== undefined) {
      setClauses.push(`avatar_url = $${paramIndex++}`);
      values.push(input.avatarUrl);
    }
    if (input.preferredLoginName !== undefined) {
      setClauses.push(`preferred_login_name = $${paramIndex++}`);
      values.push(input.preferredLoginName);
    }
    if (input.loginNames !== undefined) {
      setClauses.push(`login_names = $${paramIndex++}`);
      values.push(input.loginNames);
    }
    if (input.state !== undefined) {
      setClauses.push(`state = $${paramIndex++}`);
      values.push(input.state);
    }
    if (input.passwordHash !== undefined) {
      setClauses.push(`password_hash = $${paramIndex++}`);
      values.push(input.passwordHash);
    }
    if (input.passwordChangeRequired !== undefined) {
      setClauses.push(`password_change_required = $${paramIndex++}`);
      values.push(input.passwordChangeRequired);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    return this.pool.queryOne<UserRow>(
      `UPDATE users_projection 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
  }

  /**
   * Find users by organization (resource_owner)
   */
  async findByOrganization(orgId: string): Promise<UserRow[]> {
    return this.pool.queryMany<UserRow>(
      `SELECT * FROM users_projection WHERE resource_owner = $1`,
      [orgId]
    );
  }

  /**
   * Find users by state
   */
  async findByState(state: string): Promise<UserRow[]> {
    return this.pool.queryMany<UserRow>(
      `SELECT * FROM users_projection WHERE state = $1`,
      [state]
    );
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivate(id: string): Promise<UserRow | null> {
    return this.update(id, { state: 'inactive' });
  }
}
