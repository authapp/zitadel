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
  phone?: string;
  phone_verified?: boolean;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  state: string;
  password_hash?: string;
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
  phone?: string;
  firstName?: string;
  lastName?: string;
  state?: string;
  passwordHash?: string;
  mfaEnabled?: boolean;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  state?: string;
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
        id, instance_id, resource_owner, username, email, phone,
        first_name, last_name, state, password_hash, mfa_enabled,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        input.id,
        input.instanceId,
        input.resourceOwner,
        input.username,
        input.email || null,
        input.phone || null,
        input.firstName || null,
        input.lastName || null,
        input.state || 'active',
        input.passwordHash || null,
        input.mfaEnabled || false,
      ]
    );

    if (!result) {
      throw new Error('Failed to create user');
    }

    return result;
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
    if (input.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(input.email);
    }
    if (input.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(input.phone);
    }
    if (input.state !== undefined) {
      setClauses.push(`state = $${paramIndex++}`);
      values.push(input.state);
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
