/**
 * Device Authorization Queries
 * 
 * Query layer for OAuth 2.0 Device Authorization Grant
 * Provides read operations for device authorization state
 */

import { DatabasePool } from '../../database';

/**
 * Device Authorization State
 */
export interface DeviceAuth {
  instanceID: string;
  deviceCode: string;
  userCode: string;
  clientID: string;
  verificationURI: string;
  verificationURIComplete?: string;
  scope: string[];
  expiresIn: number;
  pollInterval: number;
  expiresAt: Date;
  state: 'requested' | 'approved' | 'denied' | 'cancelled' | 'expired';
  userID?: string;
  createdAt: Date;
  approvedAt?: Date;
  deniedAt?: Date;
  cancelledAt?: Date;
}

/**
 * Device Authorization Queries
 */
export class DeviceAuthQueries {
  constructor(private pool: DatabasePool) {}

  /**
   * Get device authorization by device code
   */
  async getByDeviceCode(
    deviceCode: string,
    instanceID: string
  ): Promise<DeviceAuth | null> {
    const result = await this.pool.queryOne(
      `SELECT
        instance_id as "instanceID",
        device_code as "deviceCode",
        user_code as "userCode",
        client_id as "clientID",
        verification_uri as "verificationURI",
        verification_uri_complete as "verificationURIComplete",
        scope,
        expires_in as "expiresIn",
        poll_interval as "pollInterval",
        expires_at as "expiresAt",
        state,
        user_id as "userID",
        created_at as "createdAt",
        approved_at as "approvedAt",
        denied_at as "deniedAt",
        cancelled_at as "cancelledAt"
      FROM projections.device_auth
      WHERE instance_id = $1
        AND device_code = $2`,
      [instanceID, deviceCode]
    );

    return result as DeviceAuth | null;
  }

  /**
   * Get device authorization by user code
   * Used when user visits verification URI and enters code
   */
  async getByUserCode(
    userCode: string,
    instanceID: string
  ): Promise<DeviceAuth | null> {
    const result = await this.pool.queryOne(
      `SELECT
        instance_id as "instanceID",
        device_code as "deviceCode",
        user_code as "userCode",
        client_id as "clientID",
        verification_uri as "verificationURI",
        verification_uri_complete as "verificationURIComplete",
        scope,
        expires_in as "expiresIn",
        poll_interval as "pollInterval",
        expires_at as "expiresAt",
        state,
        user_id as "userID",
        created_at as "createdAt",
        approved_at as "approvedAt",
        denied_at as "deniedAt",
        cancelled_at as "cancelledAt"
      FROM projections.device_auth
      WHERE instance_id = $1
        AND user_code = $2`,
      [instanceID, userCode]
    );

    return result as DeviceAuth | null;
  }

  /**
   * Check if device authorization is still active (requested state and not expired)
   */
  async isActive(deviceCode: string, instanceID: string): Promise<boolean> {
    const result = await this.pool.queryOne(
      `SELECT COUNT(*) as count
       FROM projections.device_auth
       WHERE instance_id = $1
         AND device_code = $2
         AND state = 'requested'
         AND expires_at > NOW()`,
      [instanceID, deviceCode]
    );

    return result ? Number(result.count) > 0 : false;
  }

  /**
   * Get all expired device authorizations
   * For cleanup/maintenance tasks
   */
  async getExpired(instanceID: string, limit: number = 100): Promise<DeviceAuth[]> {
    const results = await this.pool.query(
      `SELECT
        instance_id as "instanceID",
        device_code as "deviceCode",
        user_code as "userCode",
        client_id as "clientID",
        verification_uri as "verificationURI",
        verification_uri_complete as "verificationURIComplete",
        scope,
        expires_in as "expiresIn",
        poll_interval as "pollInterval",
        expires_at as "expiresAt",
        state,
        user_id as "userID",
        created_at as "createdAt",
        approved_at as "approvedAt",
        denied_at as "deniedAt",
        cancelled_at as "cancelledAt"
      FROM projections.device_auth
      WHERE instance_id = $1
        AND state = 'requested'
        AND expires_at < NOW()
      ORDER BY expires_at ASC
      LIMIT $2`,
      [instanceID, limit]
    );

    return (results.rows || []) as DeviceAuth[];
  }
}
