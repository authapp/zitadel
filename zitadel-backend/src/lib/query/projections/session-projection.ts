/**
 * Session projection for Zitadel query layer
 * Projects session-related events into the sessions_projection table
 */

import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';
import { Event } from '../../eventstore/types';

export class SessionProjection extends Projection {
  readonly name = 'session_projection';
  readonly tables = ['sessions_projection'];

  async init(): Promise<void> {
    // Tables created by migration, nothing to do
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'session.created':
        await this.handleSessionCreated(event);
        break;
      
      case 'session.updated':
        await this.handleSessionUpdated(event);
        break;
      
      case 'session.terminated':
        await this.handleSessionTerminated(event);
        break;
      
      case 'session.token.set':
        await this.handleSessionTokenSet(event);
        break;
      
      case 'session.factor.set':
        await this.handleSessionFactorSet(event);
        break;
      
      case 'session.metadata.set':
        await this.handleSessionMetadataSet(event);
        break;
      
      case 'session.metadata.deleted':
        await this.handleSessionMetadataDeleted(event);
        break;
    }
  }

  /**
   * Handle session.created event
   */
  private async handleSessionCreated(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    const metadata = payload.metadata || {};
    const metadataJSON = JSON.stringify(metadata);
    
    await this.database.query(
      `INSERT INTO sessions_projection (
        id, instance_id, state, user_id, user_agent, client_ip,
        created_at, updated_at, change_date, sequence, metadata, tokens, factors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        state = EXCLUDED.state,
        user_id = EXCLUDED.user_id,
        user_agent = EXCLUDED.user_agent,
        client_ip = EXCLUDED.client_ip,
        updated_at = EXCLUDED.updated_at,
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        metadata = EXCLUDED.metadata`,
      [
        event.aggregateID,
        event.instanceID,
        'active',
        payload.userID || null,
        payload.userAgent || null,
        payload.clientIP || null,
        event.createdAt,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        metadataJSON,
        '[]', // tokens
        '[]', // factors
      ]
    );
  }

  /**
   * Handle session.updated event
   */
  private async handleSessionUpdated(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    // Build update parts dynamically
    const updates: string[] = ['updated_at = $1', 'change_date = $2', 'sequence = $3'];
    const values: any[] = [event.createdAt, event.createdAt, Math.floor(event.position.position)];
    let paramIndex = 4;
    
    if (payload.userAgent !== undefined) {
      updates.push(`user_agent = $${paramIndex++}`);
      values.push(payload.userAgent);
    }
    
    if (payload.clientIP !== undefined) {
      updates.push(`client_ip = $${paramIndex++}`);
      values.push(payload.clientIP);
    }
    
    if (payload.metadata) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(payload.metadata));
    }
    
    values.push(event.instanceID);
    values.push(event.aggregateID);
    
    await this.database.query(
      `UPDATE sessions_projection 
       SET ${updates.join(', ')} 
       WHERE instance_id = $${paramIndex} AND id = $${paramIndex + 1}`,
      values
    );
  }

  /**
   * Handle session.terminated event
   */
  private async handleSessionTerminated(event: Event): Promise<void> {
    await this.database.query(
      `UPDATE sessions_projection 
       SET state = $1, terminated_at = $2, updated_at = $3, change_date = $4, sequence = $5
       WHERE instance_id = $6 AND id = $7`,
      [
        'terminated',
        event.createdAt,
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  /**
   * Handle session.token.set event
   */
  private async handleSessionTokenSet(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    if (!payload.tokenID || !payload.token || !payload.expiry) {
      return; // Invalid token data
    }
    
    // Get current tokens, add new one
    const result = await this.database.queryOne(
      'SELECT tokens FROM sessions_projection WHERE instance_id = $1 AND id = $2',
      [event.instanceID, event.aggregateID]
    );
    
    if (!result) return;
    
    let tokens = [];
    try {
      tokens = typeof result.tokens === 'string' 
        ? JSON.parse(result.tokens) 
        : result.tokens || [];
    } catch {
      tokens = [];
    }
    
    // Remove existing token with same ID if exists
    tokens = tokens.filter((t: any) => t.tokenID !== payload.tokenID);
    
    // Add new token
    tokens.push({
      tokenID: payload.tokenID,
      token: payload.token,
      expiry: payload.expiry,
    });
    
    await this.database.query(
      `UPDATE sessions_projection 
       SET tokens = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [
        JSON.stringify(tokens),
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  /**
   * Handle session.factor.set event
   */
  private async handleSessionFactorSet(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    if (!payload.type) {
      return; // Invalid factor data
    }
    
    // Get current factors, add/update one
    const result = await this.database.queryOne(
      'SELECT factors FROM sessions_projection WHERE instance_id = $1 AND id = $2',
      [event.instanceID, event.aggregateID]
    );
    
    if (!result) return;
    
    let factors = [];
    try {
      factors = typeof result.factors === 'string' 
        ? JSON.parse(result.factors) 
        : result.factors || [];
    } catch {
      factors = [];
    }
    
    // Remove existing factor with same type if exists
    factors = factors.filter((f: any) => f.type !== payload.type);
    
    // Add new factor
    factors.push({
      type: payload.type,
      verified: payload.verified || false,
      verifiedAt: payload.verifiedAt || null,
      metadata: payload.metadata || {},
    });
    
    await this.database.query(
      `UPDATE sessions_projection 
       SET factors = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [
        JSON.stringify(factors),
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  /**
   * Handle session.metadata.set event
   */
  private async handleSessionMetadataSet(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    if (payload.key === undefined) return;
    
    // Get current metadata, update key
    const result = await this.database.queryOne(
      'SELECT metadata FROM sessions_projection WHERE instance_id = $1 AND id = $2',
      [event.instanceID, event.aggregateID]
    );
    
    if (!result) return;
    
    let metadata: Record<string, string> = {};
    try {
      metadata = typeof result.metadata === 'string' 
        ? JSON.parse(result.metadata) 
        : result.metadata || {};
    } catch {
      metadata = {};
    }
    
    metadata[payload.key] = payload.value || '';
    
    await this.database.query(
      `UPDATE sessions_projection 
       SET metadata = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [
        JSON.stringify(metadata),
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  /**
   * Handle session.metadata.deleted event
   */
  private async handleSessionMetadataDeleted(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    if (!payload.key) return;
    
    // Get current metadata, delete key
    const result = await this.database.queryOne(
      'SELECT metadata FROM sessions_projection WHERE instance_id = $1 AND id = $2',
      [event.instanceID, event.aggregateID]
    );
    
    if (!result) return;
    
    let metadata: Record<string, string> = {};
    try {
      metadata = typeof result.metadata === 'string' 
        ? JSON.parse(result.metadata) 
        : result.metadata || {};
    } catch {
      metadata = {};
    }
    
    delete metadata[payload.key];
    
    await this.database.query(
      `UPDATE sessions_projection 
       SET metadata = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [
        JSON.stringify(metadata),
        event.createdAt,
        event.createdAt,
        Math.floor(event.position.position),
        event.instanceID,
        event.aggregateID,
      ]
    );
  }
}

/**
 * Factory function to create session projection config
 */
export function createSessionProjectionConfig(): ProjectionConfig {
  return {
    name: 'session_projection',
    tables: ['sessions_projection'],
    eventTypes: [
      'session.created',
      'session.updated',
      'session.terminated',
      'session.token.set',
      'session.factor.set',
      'session.metadata.set',
      'session.metadata.deleted',
    ],
  };
}
