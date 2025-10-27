/**
 * User Authentication Method Projection
 * Tracks OTP, U2F, passwordless, TOTP authentication methods
 */

import { Event } from '../../eventstore/types';
import { Projection } from '../projection/projection';

export class UserAuthMethodProjection extends Projection {
  readonly name = 'user_auth_method_projection';
  readonly tables = ['user_auth_methods_projection'];

  async init(): Promise<void> {
    // Table created by migration 002_43
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'user.human.otp.added':
        await this.handleOTPAdded(event);
        break;
      case 'user.human.otp.removed':
        await this.handleOTPRemoved(event);
        break;
      case 'user.human.u2f.token.added':
        await this.handleU2FAdded(event);
        break;
      case 'user.human.u2f.token.removed':
        await this.handleU2FRemoved(event);
        break;
      case 'user.human.passwordless.added':
        await this.handlePasswordlessAdded(event);
        break;
      case 'user.human.passwordless.removed':
        await this.handlePasswordlessRemoved(event);
        break;
    }
  }

  private async handleOTPAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    await this.database.query(
      `INSERT INTO projections.user_auth_methods (
        id, instance_id, user_id, method_type, state, token_id, name,
        created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (instance_id, id) DO NOTHING`,
      [
        data.id || `${event.aggregateID}_otp`,
        event.instanceID || 'default',
        event.aggregateID,
        'otp',
        'active',
        data.tokenId,
        data.name || 'OTP',
        event.createdAt,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  private async handleOTPRemoved(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.user_auth_methods 
       SET state = 'inactive', updated_at = $1, change_date = $2
       WHERE instance_id = $3 AND user_id = $4 AND method_type = 'otp'`,
      [event.createdAt, event.createdAt, event.instanceID || 'default', event.aggregateID]
    );
  }

  private async handleU2FAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    await this.database.query(
      `INSERT INTO projections.user_auth_methods (
        id, instance_id, user_id, method_type, state, token_id, public_key, name,
        created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (instance_id, id) DO NOTHING`,
      [
        data.id || data.tokenId || `${event.aggregateID}_u2f_${Date.now()}`,
        event.instanceID || 'default',
        event.aggregateID,
        'u2f',
        'active',
        data.tokenId,
        data.publicKey,
        data.name || 'U2F Token',
        event.createdAt,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  private async handleU2FRemoved(event: Event): Promise<void> {
    const data = event.payload as any;
    await this.database.query(
      `UPDATE projections.user_auth_methods 
       SET state = 'inactive', updated_at = $1, change_date = $2
       WHERE instance_id = $3 AND user_id = $4 AND token_id = $5`,
      [event.createdAt, event.createdAt, event.instanceID || 'default', event.aggregateID, data.tokenId]
    );
  }

  private async handlePasswordlessAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    await this.database.query(
      `INSERT INTO projections.user_auth_methods (
        id, instance_id, user_id, method_type, state, token_id, public_key, name,
        created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (instance_id, id) DO NOTHING`,
      [
        data.id || data.tokenId || `${event.aggregateID}_pwdless_${Date.now()}`,
        event.instanceID || 'default',
        event.aggregateID,
        'passwordless',
        'active',
        data.tokenId,
        data.publicKey,
        data.name || 'Passwordless',
        event.createdAt,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion,
      ]
    );
  }

  private async handlePasswordlessRemoved(event: Event): Promise<void> {
    const data = event.payload as any;
    await this.database.query(
      `UPDATE projections.user_auth_methods 
       SET state = 'inactive', updated_at = $1, change_date = $2
       WHERE instance_id = $3 AND user_id = $4 AND token_id = $5`,
      [event.createdAt, event.createdAt, event.instanceID || 'default', event.aggregateID, data.tokenId]
    );
  }
}
