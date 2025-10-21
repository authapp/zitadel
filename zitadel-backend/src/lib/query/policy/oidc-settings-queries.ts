/**
 * OIDC Settings Queries
 * Handles OIDC settings queries (instance-level)
 * Based on Zitadel Go internal/query/oidc_settings.go
 */

import { DatabasePool } from '../../database';
import { OIDCSettings } from './oidc-settings-types';

export class OIDCSettingsQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get OIDC settings for instance
   * Note: OIDC settings are instance-level only
   * 
   * @param instanceID - Instance ID
   * @returns OIDC settings (instance or built-in default)
   */
  async getOIDCSettings(instanceID: string): Promise<OIDCSettings> {
    const query = `
      SELECT 
        aggregate_id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        resource_owner,
        access_token_lifetime,
        id_token_lifetime,
        refresh_token_idle_expiration,
        refresh_token_expiration
      FROM projections.oidc_settings
      WHERE instance_id = $1
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID]);

    if (!result) {
      // Return built-in default if no instance settings exist
      return this.getBuiltInDefault(instanceID);
    }

    return this.mapToSettings(result);
  }

  /**
   * Get built-in default OIDC settings
   * Based on OAuth 2.0 best practices
   */
  private getBuiltInDefault(instanceID: string): OIDCSettings {
    return {
      aggregateID: instanceID,
      instanceID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: 0,
      resourceOwner: instanceID,
      accessTokenLifetime: 43200, // 12 hours
      idTokenLifetime: 43200, // 12 hours
      refreshTokenIdleExpiration: 1296000, // 15 days
      refreshTokenExpiration: 2592000, // 30 days
    };
  }

  /**
   * Map database result to OIDCSettings
   */
  private mapToSettings(row: any): OIDCSettings {
    return {
      aggregateID: row.aggregate_id,
      instanceID: row.instance_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      resourceOwner: row.resource_owner,
      accessTokenLifetime: Number(row.access_token_lifetime),
      idTokenLifetime: Number(row.id_token_lifetime),
      refreshTokenIdleExpiration: Number(row.refresh_token_idle_expiration),
      refreshTokenExpiration: Number(row.refresh_token_expiration),
    };
  }
}
