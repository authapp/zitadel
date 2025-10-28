/**
 * User Address Projection
 * Handles user address events (physical addresses)
 * Based on Zitadel Go human address management
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class UserAddressProjection extends Projection {
  readonly name = 'user_address_projection';
  readonly tables = ['projections.user_addresses'];

  async init(): Promise<void> {
    // Table created by migration 002_14
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // User address events
      case 'user.human.address.changed':
      case 'user.v1.address.changed':
        await this.handleAddressChanged(event);
        break;

      // Cleanup events
      case 'user.removed':
      case 'user.v1.removed':
        await this.handleUserRemoved(event);
        break;
      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;
      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;
    }
  }

  private async handleAddressChanged(event: Event): Promise<void> {
    const payload = event.payload as any;
    const addressId = `${event.aggregateID}_address`;

    await this.query(
      `INSERT INTO projections.user_addresses (
        id, user_id, instance_id, country, locality, postal_code,
        region, street_address, formatted_address, address_type,
        is_primary, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        country = EXCLUDED.country,
        locality = EXCLUDED.locality,
        postal_code = EXCLUDED.postal_code,
        region = EXCLUDED.region,
        street_address = EXCLUDED.street_address,
        formatted_address = EXCLUDED.formatted_address,
        address_type = EXCLUDED.address_type,
        is_primary = EXCLUDED.is_primary,
        updated_at = EXCLUDED.updated_at`,
      [
        addressId,
        event.aggregateID,
        event.instanceID,
        payload.country || null,
        payload.locality || payload.city || null,
        payload.postalCode || payload.postal_code || null,
        payload.region || payload.state || null,
        payload.streetAddress || payload.street_address || null,
        this.formatAddress(payload),
        payload.addressType || payload.address_type || 'primary',
        payload.isPrimary !== false, // Default to true
        event.createdAt,
        event.createdAt,
      ]
    );
  }

  private formatAddress(payload: any): string {
    const parts = [
      payload.streetAddress || payload.street_address,
      payload.locality || payload.city,
      payload.region || payload.state,
      payload.postalCode || payload.postal_code,
      payload.country,
    ].filter(Boolean);

    return parts.join(', ');
  }

  private async handleUserRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.user_addresses 
       WHERE instance_id = $1 AND user_id = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    // Remove addresses for all users in this organization
    await this.query(
      `DELETE FROM projections.user_addresses 
       WHERE instance_id = $1 AND user_id IN (
         SELECT id FROM projections.users 
         WHERE instance_id = $1 AND resource_owner = $2
       )`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    // Remove all addresses for this instance
    await this.query(
      `DELETE FROM projections.user_addresses WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create projection config
 */
export function createUserAddressProjectionConfig() {
  return {
    name: 'user_address_projection',
    tables: ['projections.user_addresses'],
    eventTypes: [
      'user.human.address.changed',
      'user.v1.address.changed',
      'user.removed',
      'user.v1.removed',
      'org.removed',
      'instance.removed',
    ],
    aggregateTypes: ['user', 'org', 'instance'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false,
  };
}
