/**
 * Session projection for Zitadel query layer
 * Projects session-related events into the projections.sessions table
 */

import { Projection } from '../projection/projection';
import { ProjectionConfig } from '../projection/projection-config';
import { Event } from '../../eventstore/types';

export class SessionProjection extends Projection {
  readonly name = 'session_projection';
  readonly tables = ['projections.sessions'];

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
      
      // Logout Events (Phase 3 - Week 19-20)
      case 'user.sessions.terminated':
        await this.handleUserSessionsTerminated(event);
        break;
      
      case 'org.sessions.terminated':
        await this.handleOrgSessionsTerminated(event);
        break;
      
      case 'oidc.session.backchannel.logout':
        await this.handleBackchannelLogout(event);
        break;
    }
  }

  /**
   * Handle session.created event
   * Supports both regular sessions and OIDC sessions (optional OIDC data in payload)
   */
  private async handleSessionCreated(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    const metadata = payload.metadata || {};
    const metadataJSON = JSON.stringify(metadata);
    
    // Build OIDC data if present (optional for OIDC sessions)
    let oidcDataJSON = null;
    if (payload.clientID) {
      const oidcData = {
        clientID: payload.clientID,
        redirectURI: payload.redirectURI,
        scope: payload.scope || [],
        audience: payload.audience || [],
        nonce: payload.nonce,
        state: payload.state,
        codeChallenge: payload.codeChallenge,
        codeChallengeMethod: payload.codeChallengeMethod,
        responseType: payload.responseType || ['code'],
        grantType: payload.grantType || ['authorization_code'],
        maxAge: payload.maxAge,
      };
      oidcDataJSON = JSON.stringify(oidcData);
    }
    
    await this.database.query(
      `INSERT INTO projections.sessions (
        id, instance_id, state, user_id, user_agent, client_ip,
        created_at, updated_at, change_date, sequence, metadata, tokens, factors, resource_owner, oidc_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        state = EXCLUDED.state,
        user_id = EXCLUDED.user_id,
        user_agent = EXCLUDED.user_agent,
        client_ip = EXCLUDED.client_ip,
        resource_owner = EXCLUDED.resource_owner,
        oidc_data = EXCLUDED.oidc_data,
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
        Number(event.aggregateVersion || 1n),
        metadataJSON,
        '[]', // tokens
        '[]', // factors
        payload.orgID || event.owner || null, // resource_owner
        oidcDataJSON, // oidc_data (null for regular sessions)
      ]
    );
  }

  /**
   * Handle session.updated event
   * Supports both regular session updates and OIDC session updates
   */
  private async handleSessionUpdated(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    // Build update parts dynamically
    const updates: string[] = ['updated_at = $1', 'change_date = $2', 'sequence = $3'];
    const values: any[] = [event.createdAt, event.createdAt, Number(event.aggregateVersion || 1n)];
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
    
    // Handle OIDC session updates (authTime, amr, token IDs)
    if (payload.authTime !== undefined || payload.amr !== undefined || 
        payload.accessTokenID !== undefined || payload.refreshTokenID !== undefined || payload.idTokenID !== undefined) {
      // Update OIDC data by merging with existing
      updates.push(`oidc_data = oidc_data || $${paramIndex++}::jsonb`);
      const oidcUpdate: any = {};
      if (payload.authTime !== undefined) oidcUpdate.authTime = payload.authTime;
      if (payload.amr !== undefined) oidcUpdate.amr = payload.amr;
      if (payload.accessTokenID !== undefined) oidcUpdate.accessTokenID = payload.accessTokenID;
      if (payload.refreshTokenID !== undefined) oidcUpdate.refreshTokenID = payload.refreshTokenID;
      if (payload.idTokenID !== undefined) oidcUpdate.idTokenID = payload.idTokenID;
      values.push(JSON.stringify(oidcUpdate));
    }
    
    values.push(event.instanceID);
    values.push(event.aggregateID);
    
    await this.database.query(
      `UPDATE projections.sessions 
       SET ${updates.join(', ')} 
       WHERE instance_id = $${paramIndex} AND id = $${paramIndex + 1}`,
      values
    );
  }

  /**
   * Handle session.terminated event
   * Supports optional termination reason (OIDC logout scenarios)
   */
  private async handleSessionTerminated(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.database.query(
      `UPDATE projections.sessions 
       SET state = $1, terminated_at = $2, termination_reason = $3, updated_at = $4, change_date = $5, sequence = $6
       WHERE instance_id = $7 AND id = $8`,
      [
        'terminated',
        event.createdAt,
        payload.reason || null, // termination_reason (e.g., 'user_logout', 'org_security_event')
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
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
      'SELECT tokens FROM projections.sessions WHERE instance_id = $1 AND id = $2',
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
      `UPDATE projections.sessions 
       SET tokens = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [
        JSON.stringify(tokens),
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
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
      'SELECT factors FROM projections.sessions WHERE instance_id = $1 AND id = $2',
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
      `UPDATE projections.sessions 
       SET factors = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [
        JSON.stringify(factors),
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
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
      'SELECT metadata FROM projections.sessions WHERE instance_id = $1 AND id = $2',
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
      `UPDATE projections.sessions 
       SET metadata = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [
        JSON.stringify(metadata),
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
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
      'SELECT metadata FROM projections.sessions WHERE instance_id = $1 AND id = $2',
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
      `UPDATE projections.sessions 
       SET metadata = $1, updated_at = $2, change_date = $3, sequence = $4
       WHERE instance_id = $5 AND id = $6`,
      [
        JSON.stringify(metadata),
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.instanceID,
        event.aggregateID,
      ]
    );
  }

  // ============================================================================
  // Logout Event Handlers (Phase 3 - Week 19-20)
  // ============================================================================

  /**
   * Handle user.sessions.terminated event
   * Terminates all sessions for a specific user
   */
  private async handleUserSessionsTerminated(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.database.query(
      `UPDATE projections.sessions 
       SET state = $1, terminated_at = $2, termination_reason = $3, updated_at = $4, change_date = $5
       WHERE instance_id = $6 AND user_id = $7 AND state = 'active'`,
      [
        'terminated',
        event.createdAt,
        payload.reason || 'user_logout_all',
        event.createdAt,
        event.createdAt,
        event.instanceID,
        payload.userID || event.aggregateID,
      ]
    );
  }

  /**
   * Handle org.sessions.terminated event
   * Terminates all sessions for an organization
   */
  private async handleOrgSessionsTerminated(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    // Note: This would need an org_id column in projections.sessions
    // For now, using resource_owner from events
    await this.database.query(
      `UPDATE projections.sessions 
       SET state = $1, terminated_at = $2, termination_reason = $3, updated_at = $4, change_date = $5
       WHERE instance_id = $6 AND resource_owner = $7 AND state = 'active'`,
      [
        'terminated',
        event.createdAt,
        payload.reason || 'org_security_event',
        event.createdAt,
        event.createdAt,
        event.instanceID,
        payload.orgID || event.aggregateID,
      ]
    );
  }

  /**
   * Handle oidc.session.backchannel.logout event
   * Terminates session via OIDC backchannel logout
   */
  private async handleBackchannelLogout(event: Event): Promise<void> {
    const payload = event.payload || {};
    
    await this.database.query(
      `UPDATE projections.sessions 
       SET state = $1, terminated_at = $2, termination_reason = $3, logout_method = $4, updated_at = $5, change_date = $6
       WHERE instance_id = $7 AND id = $8`,
      [
        'terminated',
        event.createdAt,
        'backchannel_logout',
        payload.method || 'backchannel',
        event.createdAt,
        event.createdAt,
        event.instanceID,
        payload.sessionID || event.aggregateID,
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
    tables: ['projections.sessions'],
    eventTypes: [
      'session.created',
      'session.updated',
      'session.terminated',
      'session.token.set',
      'session.factor.set',
      'session.metadata.set',
      'session.metadata.deleted',
      // OIDC Session Events (Week 19-20)
      'oidc.session.created',
      'oidc.session.updated',
      'oidc.session.terminated',
      // Logout Events (Week 19-20)
      'user.sessions.terminated',
      'org.sessions.terminated',
      'oidc.session.backchannel.logout',
    ],
  };
}
