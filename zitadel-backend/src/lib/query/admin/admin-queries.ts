/**
 * Admin & Debug Queries
 * Administrative and debugging functionality
 * Based on Zitadel Go internal/query (admin modules)
 */

import { DatabasePool } from '../../database';
import {
  PersonalAccessToken,
  Quota,
  QuotaPeriod,
  Restrictions,
  Milestone,
  MilestoneType,
  WebKey,
  WebKeyState,
  FailedEvent,
} from './admin-types';

export class AdminQueries {
  constructor(private readonly database: DatabasePool) {}

  // ===== Personal Access Token Methods =====

  /**
   * Search personal access tokens
   * @param instanceID - Instance ID
   * @param userID - Optional user ID filter
   * @returns Array of tokens
   */
  async searchPersonalAccessTokens(
    instanceID: string,
    userID?: string
  ): Promise<PersonalAccessToken[]> {
    let query = `
      SELECT 
        id, user_id, instance_id, creation_date, change_date, sequence,
        scopes, expiration_date
      FROM projections.personal_access_tokens
      WHERE instance_id = $1
    `;

    const params: any[] = [instanceID];

    if (userID) {
      query += ` AND user_id = $2`;
      params.push(userID);
    }

    query += ` ORDER BY creation_date DESC`;

    const result = await this.database.query(query, params);
    return result.rows.map(row => this.mapToPersonalAccessToken(row));
  }

  /**
   * Get personal access token by ID
   * @param instanceID - Instance ID
   * @param tokenID - Token ID
   * @returns Token or null
   */
  async getPersonalAccessTokenByID(
    instanceID: string,
    tokenID: string
  ): Promise<PersonalAccessToken | null> {
    const query = `
      SELECT 
        id, user_id, instance_id, created_at AS creation_date, change_date, sequence,
        scopes, expiration_date
      FROM projections.personal_access_tokens
      WHERE instance_id = $1 AND id = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, tokenID]);
    return result ? this.mapToPersonalAccessToken(result) : null;
  }

  // ===== Quota Methods =====

  /**
   * Get quota by unit
   * @param instanceID - Instance ID
   * @param unit - Quota unit (e.g., 'requests', 'actions.all.runs')
   * @returns Quota or null
   */
  async getQuota(instanceID: string, unit: string): Promise<Quota | null> {
    const query = `
      SELECT 
        instance_id, unit, from_date, interval, has_limit, amount, usage
      FROM projections.quotas
      WHERE instance_id = $1 AND unit = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, unit]);
    return result ? this.mapToQuota(result) : null;
  }

  /**
   * Get all quotas for instance
   * @param instanceID - Instance ID
   * @returns Array of quotas
   */
  async getQuotas(instanceID: string): Promise<Quota[]> {
    const query = `
      SELECT 
        instance_id, unit, from_date, interval, has_limit, amount, usage
      FROM projections.quotas
      WHERE instance_id = $1
      ORDER BY unit
    `;

    const result = await this.database.query(query, [instanceID]);
    return result.rows.map(row => this.mapToQuota(row));
  }

  /**
   * Get current quota period
   * @param instanceID - Instance ID
   * @param unit - Quota unit
   * @returns Current period or null
   */
  async getCurrentQuotaPeriod(
    instanceID: string,
    unit: string
  ): Promise<QuotaPeriod | null> {
    const query = `
      SELECT unit, period_start, usage
      FROM projections.quota_periods
      WHERE instance_id = $1 AND unit = $2
        AND period_start <= NOW()
        AND period_end > NOW()
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, unit]);
    return result ? this.mapToQuotaPeriod(result) : null;
  }

  // ===== Restrictions Methods =====

  /**
   * Get restrictions for instance
   * @param instanceID - Instance ID
   * @returns Restrictions
   */
  async getRestrictions(instanceID: string): Promise<Restrictions> {
    const query = `
      SELECT 
        disallow_public_org_registration,
        allowed_languages
      FROM projections.restrictions
      WHERE instance_id = $1
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID]);

    if (!result) {
      return this.getDefaultRestrictions();
    }

    return {
      disallowPublicOrgRegistration: result.disallow_public_org_registration || false,
      allowedLanguages: result.allowed_languages || [],
    };
  }

  /**
   * Get default restrictions
   * @returns Default restrictions (no restrictions)
   */
  getDefaultRestrictions(): Restrictions {
    return {
      disallowPublicOrgRegistration: false,
      allowedLanguages: [],
    };
  }

  // ===== Milestone Methods =====

  /**
   * Get milestones for instance
   * @param instanceID - Instance ID
   * @returns Array of milestones
   */
  async getMilestones(instanceID: string): Promise<Milestone[]> {
    const query = `
      SELECT 
        type, instance_id, reached, pushed_date, reached_date
      FROM projections.milestones
      WHERE instance_id = $1
      ORDER BY type
    `;

    const result = await this.database.query(query, [instanceID]);
    return result.rows.map(row => this.mapToMilestone(row));
  }

  /**
   * Get milestone by type
   * @param instanceID - Instance ID
   * @param type - Milestone type
   * @returns Milestone or null
   */
  async getMilestoneByType(
    instanceID: string,
    type: MilestoneType
  ): Promise<Milestone | null> {
    const query = `
      SELECT 
        type, instance_id, reached, pushed_date, reached_date
      FROM projections.milestones
      WHERE instance_id = $1 AND type = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, type]);
    return result ? this.mapToMilestone(result) : null;
  }

  // ===== Web Key Methods =====

  /**
   * Get web key by state
   * @param instanceID - Instance ID
   * @param state - Web key state
   * @returns Web key or null
   */
  async getWebKeyByState(
    instanceID: string,
    state: WebKeyState
  ): Promise<WebKey | null> {
    const query = `
      SELECT 
        id, instance_id, creation_date, change_date, sequence,
        state, key_use, algorithm, public_key
      FROM projections.web_keys
      WHERE instance_id = $1 AND state = $2
      ORDER BY creation_date DESC
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, state]);
    return result ? this.mapToWebKey(result) : null;
  }

  /**
   * Search web keys
   * @param instanceID - Instance ID
   * @returns Array of web keys
   */
  async searchWebKeys(instanceID: string): Promise<WebKey[]> {
    const query = `
      SELECT 
        id, instance_id, creation_date, change_date, sequence,
        state, key_use, algorithm, public_key
      FROM projections.web_keys
      WHERE instance_id = $1
      ORDER BY creation_date DESC
    `;

    const result = await this.database.query(query, [instanceID]);
    return result.rows.map(row => this.mapToWebKey(row));
  }

  /**
   * Get public keys
   * Returns only active public keys for JWT verification
   * @param instanceID - Instance ID
   * @returns Array of active web keys
   */
  async getPublicKeys(instanceID: string): Promise<WebKey[]> {
    const query = `
      SELECT 
        id, instance_id, creation_date, change_date, sequence,
        state, key_use, algorithm, public_key
      FROM projections.web_keys
      WHERE instance_id = $1 AND state = $2
      ORDER BY creation_date DESC
    `;

    const result = await this.database.query(query, [instanceID, WebKeyState.ACTIVE]);
    return result.rows.map(row => this.mapToWebKey(row));
  }

  // ===== Failed Event Methods =====

  /**
   * Get failed events
   * For debugging event processing issues
   * @param projectID - Project ID
   * @returns Array of failed events
   */
  async getFailedEvents(projectID: string): Promise<FailedEvent[]> {
    const query = `
      SELECT 
        project_id, event_type, aggregate_type, aggregate_id,
        failure_count, error, last_failed
      FROM projections.failed_events
      WHERE project_id = $1
      ORDER BY last_failed DESC
      LIMIT 100
    `;

    const result = await this.database.query(query, [projectID]);
    return result.rows.map(row => this.mapToFailedEvent(row));
  }

  // ===== Private Mapping Methods =====

  private mapToPersonalAccessToken(row: any): PersonalAccessToken {
    return {
      id: row.id,
      userID: row.user_id,
      instanceID: row.instance_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      scopes: row.scopes || [],
      expirationDate: row.expiration_date,
    };
  }

  private mapToQuota(row: any): Quota {
    return {
      instanceID: row.instance_id,
      unit: row.unit,
      from: row.from_date,
      interval: Number(row.interval),
      limit: row.has_limit || false,
      amount: Number(row.amount) || 0,
      usage: Number(row.usage) || 0,
      notifications: [],
    };
  }

  private mapToQuotaPeriod(row: any): QuotaPeriod {
    return {
      unit: row.unit,
      periodStart: row.period_start,
      usage: Number(row.usage) || 0,
    };
  }

  private mapToMilestone(row: any): Milestone {
    return {
      type: row.type,
      instanceID: row.instance_id,
      reached: row.reached || false,
      pushedDate: row.pushed_date || null,
      reachedDate: row.reached_date || null,
    };
  }

  private mapToWebKey(row: any): WebKey {
    return {
      id: row.id,
      instanceID: row.instance_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      state: row.state || WebKeyState.INITIAL,
      config: {
        use: row.key_use || 'sig',
        algorithm: row.algorithm || 'RS256',
        publicKey: row.public_key || '',
      },
    };
  }

  private mapToFailedEvent(row: any): FailedEvent {
    return {
      projectID: row.project_id,
      eventType: row.event_type,
      aggregateType: row.aggregate_type,
      aggregateID: row.aggregate_id,
      failureCount: Number(row.failure_count) || 0,
      error: row.error || '',
      lastFailed: row.last_failed,
    };
  }
}
