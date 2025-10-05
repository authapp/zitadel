/**
 * User Address Repository
 * 
 * Handles all database operations for user addresses
 */

import { DatabasePool } from '../database';
import { BaseRepository } from './base-repository';
import { generateId as generateSnowflakeId } from '../id/snowflake';

export interface UserAddressRow {
  id: string;
  user_id: string;
  instance_id: string;
  country?: string;
  locality?: string;
  postal_code?: string;
  region?: string;
  street_address?: string;
  formatted_address?: string;
  address_type: string;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAddressInput {
  userId: string;
  instanceId: string;
  country?: string;
  locality?: string;
  postalCode?: string;
  region?: string;
  streetAddress?: string;
  formattedAddress?: string;
  addressType?: 'primary' | 'billing' | 'shipping' | 'other';
  isPrimary?: boolean;
}

export interface UpdateAddressInput {
  country?: string;
  locality?: string;
  postalCode?: string;
  region?: string;
  streetAddress?: string;
  formattedAddress?: string;
  addressType?: string;
  isPrimary?: boolean;
}

export class UserAddressRepository extends BaseRepository<UserAddressRow> {
  constructor(pool: DatabasePool) {
    super(pool, 'user_addresses');
  }

  /**
   * Create a new address for a user
   */
  async create(input: CreateAddressInput): Promise<UserAddressRow> {
    const id = generateSnowflakeId();
    
    // If this is the primary address, unset any existing primary
    if (input.isPrimary) {
      await this.unsetPrimaryAddress(input.userId, input.instanceId);
    }

    const result = await this.pool.queryOne<UserAddressRow>(
      `INSERT INTO user_addresses (
        id, user_id, instance_id, country, locality, postal_code, region,
        street_address, formatted_address, address_type, is_primary,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        id,
        input.userId,
        input.instanceId,
        input.country || null,
        input.locality || null,
        input.postalCode || null,
        input.region || null,
        input.streetAddress || null,
        input.formattedAddress || null,
        input.addressType || 'primary',
        input.isPrimary || false,
      ]
    );

    if (!result) {
      throw new Error('Failed to create address');
    }

    return result;
  }

  /**
   * Find all addresses for a user
   */
  async findByUserId(userId: string, instanceId?: string): Promise<UserAddressRow[]> {
    if (instanceId) {
      return this.pool.queryMany<UserAddressRow>(
        `SELECT * FROM user_addresses WHERE user_id = $1 AND instance_id = $2 ORDER BY is_primary DESC, created_at DESC`,
        [userId, instanceId]
      );
    }
    
    return this.pool.queryMany<UserAddressRow>(
      `SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_primary DESC, created_at DESC`,
      [userId]
    );
  }

  /**
   * Find primary address for a user
   */
  async findPrimaryAddress(userId: string, instanceId: string): Promise<UserAddressRow | null> {
    return this.pool.queryOne<UserAddressRow>(
      `SELECT * FROM user_addresses WHERE user_id = $1 AND instance_id = $2 AND is_primary = true`,
      [userId, instanceId]
    );
  }

  /**
   * Update an address
   */
  async update(id: string, input: UpdateAddressInput): Promise<UserAddressRow | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // If setting as primary, get userId and instanceId first
    if (input.isPrimary) {
      const existing = await this.findById(id);
      if (existing) {
        await this.unsetPrimaryAddress(existing.user_id, existing.instance_id);
      }
    }

    if (input.country !== undefined) {
      setClauses.push(`country = $${paramIndex++}`);
      values.push(input.country);
    }
    if (input.locality !== undefined) {
      setClauses.push(`locality = $${paramIndex++}`);
      values.push(input.locality);
    }
    if (input.postalCode !== undefined) {
      setClauses.push(`postal_code = $${paramIndex++}`);
      values.push(input.postalCode);
    }
    if (input.region !== undefined) {
      setClauses.push(`region = $${paramIndex++}`);
      values.push(input.region);
    }
    if (input.streetAddress !== undefined) {
      setClauses.push(`street_address = $${paramIndex++}`);
      values.push(input.streetAddress);
    }
    if (input.formattedAddress !== undefined) {
      setClauses.push(`formatted_address = $${paramIndex++}`);
      values.push(input.formattedAddress);
    }
    if (input.addressType !== undefined) {
      setClauses.push(`address_type = $${paramIndex++}`);
      values.push(input.addressType);
    }
    if (input.isPrimary !== undefined) {
      setClauses.push(`is_primary = $${paramIndex++}`);
      values.push(input.isPrimary);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    return this.pool.queryOne<UserAddressRow>(
      `UPDATE user_addresses 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
  }

  /**
   * Delete an address
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM user_addresses WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete all addresses for a user
   */
  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM user_addresses WHERE user_id = $1`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Unset primary address for a user
   * (Helper method to ensure only one primary address)
   */
  private async unsetPrimaryAddress(userId: string, instanceId: string): Promise<void> {
    await this.pool.query(
      `UPDATE user_addresses SET is_primary = false 
       WHERE user_id = $1 AND instance_id = $2 AND is_primary = true`,
      [userId, instanceId]
    );
  }

  /**
   * Set an address as primary
   */
  async setPrimary(id: string): Promise<UserAddressRow | null> {
    const address = await this.findById(id);
    if (!address) {
      return null;
    }

    await this.unsetPrimaryAddress(address.user_id, address.instance_id);
    
    return this.pool.queryOne<UserAddressRow>(
      `UPDATE user_addresses SET is_primary = true, updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [id]
    );
  }
}
