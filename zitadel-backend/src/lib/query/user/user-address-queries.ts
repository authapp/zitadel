/**
 * User Address Queries
 * 
 * Query layer for user addresses projection.
 * Provides methods to retrieve user address data.
 */

import { DatabasePool } from '../../database/pool';

export interface UserAddress {
  id: string;
  userId: string;
  instanceId: string;
  country: string | null;
  locality: string | null;
  postalCode: string | null;
  region: string | null;
  streetAddress: string | null;
  formattedAddress: string | null;
  addressType: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserAddressQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get user address by user ID
   * @param userId - User ID
   * @param instanceId - Instance ID for multi-tenant isolation
   * @returns User address or null if not found
   */
  async getUserAddress(userId: string, instanceId: string): Promise<UserAddress | null> {
    const result = await this.database.queryOne<any>(
      `SELECT 
        id, user_id, instance_id, country, locality, postal_code, region,
        street_address, formatted_address, address_type, is_primary,
        created_at, updated_at
       FROM projections.user_addresses
       WHERE user_id = $1 AND instance_id = $2`,
      [userId, instanceId]
    );

    if (!result) {
      return null;
    }

    return this.mapRowToUserAddress(result);
  }

  /**
   * Get primary user address
   * @param userId - User ID
   * @param instanceId - Instance ID for multi-tenant isolation
   * @returns Primary user address or null if not found
   */
  async getPrimaryUserAddress(userId: string, instanceId: string): Promise<UserAddress | null> {
    const result = await this.database.queryOne<any>(
      `SELECT 
        id, user_id, instance_id, country, locality, postal_code, region,
        street_address, formatted_address, address_type, is_primary,
        created_at, updated_at
       FROM projections.user_addresses
       WHERE user_id = $1 AND instance_id = $2 AND is_primary = true`,
      [userId, instanceId]
    );

    if (!result) {
      return null;
    }

    return this.mapRowToUserAddress(result);
  }

  /**
   * Get all addresses for a user
   * @param userId - User ID
   * @param instanceId - Instance ID for multi-tenant isolation
   * @returns Array of user addresses
   */
  async getUserAddresses(userId: string, instanceId: string): Promise<UserAddress[]> {
    const results = await this.database.queryMany<any>(
      `SELECT 
        id, user_id, instance_id, country, locality, postal_code, region,
        street_address, formatted_address, address_type, is_primary,
        created_at, updated_at
       FROM projections.user_addresses
       WHERE user_id = $1 AND instance_id = $2
       ORDER BY is_primary DESC, created_at DESC`,
      [userId, instanceId]
    );

    return results.map(row => this.mapRowToUserAddress(row));
  }

  /**
   * Map database row to UserAddress
   */
  private mapRowToUserAddress(row: any): UserAddress {
    return {
      id: row.id,
      userId: row.user_id,
      instanceId: row.instance_id,
      country: row.country,
      locality: row.locality,
      postalCode: row.postal_code,
      region: row.region,
      streetAddress: row.street_address,
      formattedAddress: row.formatted_address,
      addressType: row.address_type,
      isPrimary: row.is_primary,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
