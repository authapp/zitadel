/**
 * User Projection
 * 
 * Materializes user events into the projections.users table.
 * Uses the new ProjectionRegistry/ProjectionHandler system.
 */

import { Event } from '../../eventstore/types';
import { Eventstore } from '../../eventstore/types';
import { DatabasePool } from '../../database/pool';
import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';

/**
 * User read model in the projection
 */
export interface UserReadModel {
  id: string;
  instanceId: string;
  resourceOwner: string;
  username: string;
  email: string;
  emailVerified?: boolean;
  emailVerifiedAt?: Date;
  phone?: string;
  phoneVerified?: boolean;
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
  passwordHash?: string;
  passwordChangedAt?: Date;
  passwordChangeRequired?: boolean;
  mfaEnabled?: boolean;
  state: 'active' | 'inactive' | 'locked';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Projection - materializes user events into read model
 * Configuration is provided separately via createUserProjectionConfig()
 */
export class UserProjection extends Projection {
  readonly name = 'user_projection';
  readonly tables = ['projections.users'];

  /**
   * Initialize the projection
   * Tables are already created by migrations, so this is a no-op
   */
  async init(): Promise<void> {
    // Table already exists from migrations
    // No additional setup needed
  }

  /**
   * Reduce a single event into the projection
   * This is the core method that processes events
   * 
   * Note: Supports both old and new event type names for backward compatibility
   */
  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // User creation events (new and old names)
      case 'user.added':
      case 'user.registered':
      case 'user.created':  // Old event type
      case 'user.human.added':  // Human user specific event
      case 'user.machine.added':  // Machine user specific event
        await this.handleUserAdded(event);
        break;
      
      // User update events (new and old names)
      case 'user.changed':
      case 'user.profile.changed':
      case 'user.updated':  // Old event type
      case 'user.username.changed':  // Username change event
        await this.handleUserChanged(event);
        break;
      
      case 'user.email.changed':
      case 'user.v2.email.changed':
        await this.handleEmailChanged(event);
        break;
      
      case 'user.email.verified':
      case 'user.v2.email.verified':
        await this.handleEmailVerified(event);
        break;
      
      case 'user.phone.changed':
      case 'user.v2.phone.changed':
      case 'user.human.phone.changed':
        await this.handlePhoneChanged(event);
        break;
      
      case 'user.phone.verified':
      case 'user.v2.phone.verified':
      case 'user.human.phone.verified':
        await this.handlePhoneVerified(event);
        break;
      
      case 'user.phone.removed':
      case 'user.v2.phone.removed':
      case 'user.human.phone.removed':
        await this.handlePhoneRemoved(event);
        break;
      
      case 'user.password.changed':
        await this.handlePasswordChanged(event);
        break;
      
      case 'user.deactivated':
        await this.handleUserDeactivated(event);
        break;
      
      case 'user.reactivated':
      case 'user.unlocked':
        await this.handleUserReactivated(event);
        break;
      
      case 'user.locked':
        await this.handleUserLocked(event);
        break;
      
      // User deletion events (new and old names)
      case 'user.removed':
      case 'user.deleted':  // Old event type
        await this.handleUserRemoved(event);
        break;
      
      default:
        // Unknown event type, ignore
        break;
    }
  }

  /**
   * Handle user.added / user.registered event
   */
  private async handleUserAdded(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `INSERT INTO projections.users (
        id, instance_id, resource_owner, username, email, email_verified, email_verified_at,
        phone, phone_verified, phone_verified_at, first_name, last_name, display_name, nickname,
        preferred_language, gender, avatar_url, preferred_login_name, login_names,
        state, user_type, password_hash, password_changed_at, password_change_required, mfa_enabled,
        created_at, updated_at, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        updated_at = EXCLUDED.updated_at,
        sequence = EXCLUDED.sequence`,
      [
        event.aggregateID,
        event.instanceID || 'default',
        event.owner,
        data.username || data.userName,
        data.email,
        data.emailVerified || false,
        data.emailVerified ? event.createdAt : null,
        data.phone,
        data.phoneVerified || false,
        data.phoneVerified ? event.createdAt : null,
        data.firstName || data.profile?.firstName,
        data.lastName || data.profile?.lastName,
        data.displayName || data.profile?.displayName,
        data.nickname || data.profile?.nickName,
        data.preferredLanguage || data.profile?.preferredLanguage,
        data.gender || data.profile?.gender,
        data.avatarUrl,
        data.preferredLoginName,
        data.loginNames || [data.username || data.userName],
        'active',
        data.userType || 'human',
        data.passwordHash,
        data.passwordHash ? event.createdAt : null,
        data.passwordChangeRequired || false,
        false, // mfa_enabled default
        event.createdAt,
        event.createdAt,
        event.createdAt,
        event.aggregateVersion || 0,
      ]
    );
  }

  /**
   * Handle user.changed / user.profile.changed event
   */
  private async handleUserChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (data.username) {
      updates.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(data.email);
    }
    if (data.firstName || data.profile?.firstName) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName || data.profile?.firstName);
    }
    if (data.lastName || data.profile?.lastName) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName || data.profile?.lastName);
    }
    if (data.displayName || data.profile?.displayName) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(data.displayName || data.profile?.displayName);
    }
    if (data.nickname || data.profile?.nickName) {
      updates.push(`nickname = $${paramIndex++}`);
      values.push(data.nickname || data.profile?.nickName);
    }
    if (data.preferredLanguage || data.profile?.preferredLanguage) {
      updates.push(`preferred_language = $${paramIndex++}`);
      values.push(data.preferredLanguage || data.profile?.preferredLanguage);
    }
    if (data.gender || data.profile?.gender) {
      updates.push(`gender = $${paramIndex++}`);
      values.push(data.gender || data.profile?.gender);
    }
    
    if (updates.length > 0) {
      updates.push(`updated_at = $${paramIndex++}`);
      values.push(event.createdAt);
      updates.push(`change_date = $${paramIndex++}`);
      values.push(event.createdAt);
      updates.push(`sequence = $${paramIndex++}`);
      values.push(event.aggregateVersion || 0);
      values.push(event.instanceID || 'default');
      values.push(event.aggregateID);
      
      await this.database.query(
        `UPDATE projections.users SET ${updates.join(', ')} WHERE instance_id = $${paramIndex++} AND id = $${paramIndex}`,
        values
      );
    }
  }

  /**
   * Handle user.email.changed event
   */
  private async handleEmailChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `UPDATE projections.users 
       SET email = $1, email_verified = $2, updated_at = $3, change_date = $4, sequence = $5
       WHERE instance_id = $6 AND id = $7`,
      [data.email, false, event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle user.email.verified event
   */
  private async handleEmailVerified(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.users 
       SET email_verified = true, email_verified_at = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [event.createdAt, event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle user.phone.changed event
   */
  private async handlePhoneChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `UPDATE projections.users 
       SET phone = $1, phone_verified = $2, updated_at = $3, change_date = $4, sequence = $5
       WHERE instance_id = $6 AND id = $7`,
      [data.phone, false, event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle user.phone.verified event
   */
  private async handlePhoneVerified(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.users 
       SET phone_verified = $1, phone_verified_at = $2, updated_at = $3, change_date = $4, sequence = $5
       WHERE instance_id = $6 AND id = $7`,
      [true, event.createdAt, event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle user.phone.removed event
   */
  private async handlePhoneRemoved(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.users 
       SET phone = NULL, phone_verified = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [false, event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle user.password.changed event
   */
  private async handlePasswordChanged(event: Event): Promise<void> {
    const data = event.payload as any;
    
    await this.database.query(
      `UPDATE projections.users 
       SET password_hash = $1, password_changed_at = $2, password_change_required = $3, updated_at = $4, change_date = $5, sequence = $6
       WHERE instance_id = $7 AND id = $8`,
      [data.passwordHash, event.createdAt, data.changeRequired || false, event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle user.deactivated event
   */
  private async handleUserDeactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.users SET state = $1, updated_at = $2, change_date = $3, sequence = $4 WHERE instance_id = $5 AND id = $6`,
      ['inactive', event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle user.reactivated / user.unlocked event
   */
  private async handleUserReactivated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.users SET state = $1, updated_at = $2, change_date = $3, sequence = $4 WHERE instance_id = $5 AND id = $6`,
      ['active', event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle user.locked event
   */
  private async handleUserLocked(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE projections.users SET state = $1, updated_at = $2, change_date = $3, sequence = $4 WHERE instance_id = $5 AND id = $6`,
      ['locked', event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle user.removed event
   */
  private async handleUserRemoved(event: Event): Promise<void> {
    // Soft delete - mark as deleted and set deleted_at
    await this.database.query(
      `UPDATE projections.users 
       SET state = $1, deleted_at = $2, updated_at = $3, change_date = $4, sequence = $5
       WHERE instance_id = $6 AND id = $7`,
      ['deleted', event.createdAt, event.createdAt, event.createdAt, event.aggregateVersion || 0, event.instanceID || 'default', event.aggregateID]
    );
  }

  /**
   * Handle events from eventstore
   */
  async handleEvent(event: Event): Promise<void> {
    // Handle different event types
    switch (event.eventType) {
      case 'user.added':
      case 'user.registered':
        await this.handleUserAdded(event);
        break;
      case 'user.changed':
      case 'user.profile.changed':
        await this.handleUserChanged(event);
        break;
      case 'user.email.changed':
      case 'user.v2.email.changed':
        await this.handleEmailChanged(event);
        break;
      case 'user.email.verified':
      case 'user.v2.email.verified':
        await this.handleEmailVerified(event);
        break;
      case 'user.phone.changed':
        await this.handlePhoneChanged(event);
        break;
      case 'user.phone.verified':
        await this.handlePhoneVerified(event);
        break;
      case 'user.phone.removed':
        await this.handlePhoneRemoved(event);
        break;
      case 'user.password.changed':
        await this.handlePasswordChanged(event);
        break;
      case 'user.deactivated':
        await this.handleUserDeactivated(event);
        break;
      case 'user.reactivated':
      case 'user.unlocked':
        await this.handleUserReactivated(event);
        break;
      case 'user.locked':
        await this.handleUserLocked(event);
        break;
      case 'user.removed':
        await this.handleUserRemoved(event);
        break;
      default:
        // Unknown event type, ignore
        break;
    }
  }
}

/**
 * Create user projection instance
 */
export function createUserProjection(
  eventstore: Eventstore,
  database: DatabasePool
): UserProjection {
  return new UserProjection(eventstore, database);
}

/**
 * Create user projection configuration
 */
export function createUserProjectionConfig(): ProjectionConfig {
  return {
    name: 'user_projection',
    tables: ['projections.users'],
    eventTypes: [
      // New event types
      'user.added',
      'user.registered',
      'user.changed',
      'user.profile.changed',
      'user.email.changed',
      'user.v2.email.changed',
      'user.email.verified',
      'user.v2.email.verified',
      'user.phone.changed',
      'user.phone.verified',
      'user.phone.removed',
      'user.password.changed',
      'user.deactivated',
      'user.reactivated',
      'user.locked',
      'user.unlocked',
      'user.removed',
      // Old event types (backward compatibility)
      'user.created',
      'user.updated',
      'user.deleted',
    ],
    aggregateTypes: ['user'],
    batchSize: 100,
    interval: 1000,
    enableLocking: false, // Disable locking for simplicity (can be enabled in production)
  };
}
