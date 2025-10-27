/**
 * Personal Access Token Projection
 * Tracks PATs for API authentication
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class PersonalAccessTokenProjection extends Projection {
  readonly name = 'personal_access_token_projection';
  readonly tables = ['personal_access_tokens_projection'];

  async init(): Promise<void> {
    // Table created by migration 002_44
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'user.personal.access.token.added':
      case 'user.token.added':
        await this.handlePATAdded(event);
        break;
      case 'user.personal.access.token.removed':
      case 'user.token.removed':
        await this.handlePATRemoved(event);
        break;
      case 'user.personal.access.token.used':
        await this.handlePATUsed(event);
        break;
    }
  }

  private async handlePATAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    await this.database.query(
      `INSERT INTO projections.personal_access_tokens (
        id, instance_id, user_id, token_hash, scopes, expiration_date,
        created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (instance_id, id) DO NOTHING`,
      [
        data.id || data.tokenId || `pat_${Date.now()}`,
        event.instanceID || 'default',
        event.aggregateID,
        data.tokenHash || data.token,
        data.scopes || [],
        data.expirationDate || null,
        event.createdAt,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  private async handlePATRemoved(event: Event): Promise<void> {
    const data = event.payload as any;
    await this.database.query(
      `DELETE FROM projections.personal_access_tokens 
       WHERE instance_id = $1 AND id = $2`,
      [event.instanceID || 'default', data.id || data.tokenId]
    );
  }

  private async handlePATUsed(event: Event): Promise<void> {
    const data = event.payload as any;
    await this.database.query(
      `UPDATE projections.personal_access_tokens 
       SET last_used = $1, updated_at = $2
       WHERE instance_id = $3 AND id = $4`,
      [event.createdAt, event.createdAt, event.instanceID || 'default', data.id || data.tokenId]
    );
  }
}
