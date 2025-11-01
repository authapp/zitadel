/**
 * Device Authorization Projection
 * 
 * Projects device authorization events into read model
 * Handles OAuth 2.0 Device Authorization Grant state
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

/**
 * Device Authorization Projection
 * Maintains device authorization state for OAuth 2.0 Device Flow
 */
export class DeviceAuthProjection extends Projection {
  readonly name = 'device_auth_projection';
  readonly tables = ['device_auth'];

  /**
   * Initialize projection tables
   */
  async init(): Promise<void> {
    // Create device_auth table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.device_auth (
        instance_id TEXT NOT NULL,
        device_code TEXT NOT NULL,
        user_code TEXT NOT NULL,
        client_id TEXT NOT NULL,
        verification_uri TEXT NOT NULL,
        verification_uri_complete TEXT,
        scope TEXT[] DEFAULT '{}',
        expires_in INTEGER NOT NULL DEFAULT 600,
        poll_interval INTEGER NOT NULL DEFAULT 5,
        expires_at TIMESTAMPTZ NOT NULL,
        state TEXT NOT NULL DEFAULT 'requested',
        user_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMPTZ,
        denied_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        PRIMARY KEY (instance_id, device_code)
      )`,
      []
    );

    // Create index for user_code lookup
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_device_auth_user_code
       ON projections.device_auth(instance_id, user_code)
       WHERE state = 'requested'`,
      []
    );

    // Create index for expiration cleanup
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_device_auth_expires_at
       ON projections.device_auth(expires_at)
       WHERE state = 'requested'`,
      []
    );
  }

  /**
   * Reduce event into projection
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'device_auth.added':
        await this.handleDeviceAuthAdded(event);
        break;
      case 'device_auth.approved':
        await this.handleDeviceAuthApproved(event);
        break;
      case 'device_auth.denied':
        await this.handleDeviceAuthDenied(event);
        break;
      case 'device_auth.cancelled':
        await this.handleDeviceAuthCancelled(event);
        break;
      case 'device_auth.expired':
        await this.handleDeviceAuthExpired(event);
        break;
    }
  }

  /**
   * Handle device_auth.added event
   * Creates new device authorization record
   */
  private async handleDeviceAuthAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const {
      clientID,
      deviceCode,
      userCode,
      verificationURI,
      verificationURIComplete,
      scope,
      expiresIn,
      interval,
      expiresAt,
    } = payload;

    await this.query(
      `INSERT INTO projections.device_auth (
        instance_id,
        device_code,
        user_code,
        client_id,
        verification_uri,
        verification_uri_complete,
        scope,
        expires_in,
        poll_interval,
        expires_at,
        state,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (instance_id, device_code) DO UPDATE SET
        user_code = EXCLUDED.user_code,
        client_id = EXCLUDED.client_id`,
      [
        event.instanceID,
        deviceCode || event.aggregateID,
        userCode,
        clientID,
        verificationURI,
        verificationURIComplete || null,
        Array.isArray(scope) ? scope : [],
        expiresIn || 600,
        interval || 5,
        expiresAt ? new Date(expiresAt) : new Date(Date.now() + (expiresIn || 600) * 1000),
        'requested', // Initial state
        event.createdAt,
      ]
    );
  }

  /**
   * Handle device_auth.approved event
   * Marks device as approved by user
   */
  private async handleDeviceAuthApproved(event: Event): Promise<void> {
    const payload = event.payload || {};
    const { userID } = payload;

    await this.query(
      `UPDATE projections.device_auth
       SET state = 'approved',
           user_id = $1,
           approved_at = $2
       WHERE instance_id = $3
         AND device_code = $4`,
      [
        userID,
        event.createdAt,
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  /**
   * Handle device_auth.denied event
   * Marks device as denied by user
   */
  private async handleDeviceAuthDenied(event: Event): Promise<void> {
    await this.query(
      `UPDATE projections.device_auth
       SET state = 'denied',
           denied_at = $1
       WHERE instance_id = $2
         AND device_code = $3`,
      [
        event.createdAt,
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  /**
   * Handle device_auth.cancelled event
   * Marks device authorization as cancelled
   */
  private async handleDeviceAuthCancelled(event: Event): Promise<void> {
    await this.query(
      `UPDATE projections.device_auth
       SET state = 'cancelled',
           cancelled_at = $1
       WHERE instance_id = $2
         AND device_code = $3`,
      [
        event.createdAt,
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  /**
   * Handle device_auth.expired event
   * Marks device authorization as expired
   */
  private async handleDeviceAuthExpired(event: Event): Promise<void> {
    await this.query(
      `UPDATE projections.device_auth
       SET state = 'expired'
       WHERE instance_id = $1
         AND device_code = $2`,
      [
        event.instanceID,
        event.aggregateID,
      ]
    );
  }
}
