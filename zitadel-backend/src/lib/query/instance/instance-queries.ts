/**
 * Instance queries for Zitadel query layer
 * Handles instance and instance domain lookups
 */

import { DatabasePool } from '../../database';
import {
  Instance,
  InstanceDomain,
  InstanceTrustedDomain,
  InstanceState,
  InstanceDomainSearchQuery,
  InstanceDomainSearchResult,
  InstanceTrustedDomainSearchQuery,
  InstanceTrustedDomainSearchResult,
  InstanceFeatures,
  InstanceSearchQuery,
  InstanceSearchResult,
} from './instance-types';

export class InstanceQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get instance by ID
   */
  async getInstanceByID(instanceID: string): Promise<Instance | null> {
    const result = await this.database.query<any>(
      `SELECT 
        i.id,
        i.name,
        i.default_org_id,
        i.default_language,
        i.state,
        i.features,
        i.created_at,
        i.updated_at,
        i.sequence
      FROM projections.instances i
      WHERE i.id = $1`,
      [instanceID]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Get domains for this instance
    const domains = await this.getInstanceDomainsByInstanceID(instanceID);
    
    // Get trusted domains
    const trustedDomains = await this.getInstanceTrustedDomainsByInstanceID(instanceID);
    
    return this.mapRowToInstance(row, domains, trustedDomains);
  }

  /**
   * Get instance by host/domain name
   */
  async getInstanceByHost(host: string): Promise<Instance | null> {
    // Look up instance by domain
    const domainResult = await this.database.query<any>(
      `SELECT instance_id
      FROM projections.instance_domains
      WHERE domain = $1`,
      [host]
    );

    if (domainResult.rows.length === 0) {
      return null;
    }

    const instanceID = domainResult.rows[0].instance_id;
    return this.getInstanceByID(instanceID);
  }

  /**
   * Search instances with filters
   */
  async searchInstances(query: InstanceSearchQuery): Promise<InstanceSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceIDs && query.instanceIDs.length > 0) {
      conditions.push(`i.id = ANY($${paramIndex++})`);
      params.push(query.instanceIDs);
    }

    if (query.name) {
      conditions.push(`i.name ILIKE $${paramIndex++}`);
      params.push(`%${query.name}%`);
    }

    if (query.state) {
      conditions.push(`i.state = $${paramIndex++}`);
      params.push(query.state);
    }

    if (query.hasDefaultOrg !== undefined) {
      if (query.hasDefaultOrg) {
        conditions.push(`i.default_org_id IS NOT NULL`);
      } else {
        conditions.push(`i.default_org_id IS NULL`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.query<{ count: string }>(
      `SELECT COUNT(*) as count
      FROM projections.instances i
      ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get paginated results
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const result = await this.database.query<any>(
      `SELECT 
        i.id,
        i.name,
        i.default_org_id,
        i.default_language,
        i.state,
        i.features,
        i.created_at,
        i.updated_at,
        i.sequence
      FROM projections.instances i
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    // For each instance, get domains and trusted domains
    const instances = await Promise.all(
      result.rows.map(async (row) => {
        const domains = await this.getInstanceDomainsByInstanceID(row.id);
        const trustedDomains = await this.getInstanceTrustedDomainsByInstanceID(row.id);
        return this.mapRowToInstance(row, domains, trustedDomains);
      })
    );

    return { instances, total };
  }

  /**
   * Get default instance
   * Returns the first active instance or the first instance if none are active
   */
  async getDefaultInstance(): Promise<Instance | null> {
    // Try to get active instance first
    let result = await this.database.query<any>(
      `SELECT 
        i.id,
        i.name,
        i.default_org_id,
        i.default_language,
        i.state,
        i.features,
        i.created_at,
        i.updated_at,
        i.sequence
      FROM projections.instances i
      WHERE i.state = $1
      ORDER BY i.created_at ASC
      LIMIT 1`,
      [InstanceState.ACTIVE]
    );

    // If no active instance, get any instance
    if (result.rows.length === 0) {
      result = await this.database.query<any>(
        `SELECT 
          i.id,
          i.name,
          i.default_org_id,
          i.default_language,
          i.state,
          i.features,
          i.created_at,
          i.updated_at,
          i.sequence
        FROM projections.instances i
        ORDER BY i.created_at ASC
        LIMIT 1`
      );
    }

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const domains = await this.getInstanceDomainsByInstanceID(row.id);
    const trustedDomains = await this.getInstanceTrustedDomainsByInstanceID(row.id);
    
    return this.mapRowToInstance(row, domains, trustedDomains);
  }

  /**
   * Search instance domains
   */
  async searchInstanceDomains(
    query: InstanceDomainSearchQuery
  ): Promise<InstanceDomainSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.domain) {
      conditions.push(`domain ILIKE $${paramIndex++}`);
      params.push(`%${query.domain}%`);
    }

    if (query.isPrimary !== undefined) {
      conditions.push(`is_primary = $${paramIndex++}`);
      params.push(query.isPrimary);
    }

    if (query.isGenerated !== undefined) {
      conditions.push(`is_generated = $${paramIndex++}`);
      params.push(query.isGenerated);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.query<{ count: string }>(
      `SELECT COUNT(*) as count
      FROM projections.instance_domains
      ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get paginated results
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const result = await this.database.query<any>(
      `SELECT 
        instance_id,
        domain,
        is_primary,
        is_generated,
        created_at,
        updated_at,
        sequence
      FROM projections.instance_domains
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const domains = result.rows.map(this.mapRowToInstanceDomain);

    return { domains, total };
  }

  /**
   * Get instance features
   */
  async getInstanceFeatures(instanceID: string): Promise<InstanceFeatures | null> {
    const result = await this.database.query<any>(
      `SELECT features
      FROM projections.instances
      WHERE id = $1`,
      [instanceID]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].features || {};
  }

  /**
   * Search instance trusted domains
   */
  async searchInstanceTrustedDomains(
    query: InstanceTrustedDomainSearchQuery
  ): Promise<InstanceTrustedDomainSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.domain) {
      conditions.push(`domain ILIKE $${paramIndex++}`);
      params.push(`%${query.domain}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.query<{ count: string }>(
      `SELECT COUNT(*) as count
      FROM projections.instance_trusted_domains
      ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get paginated results
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const result = await this.database.query<any>(
      `SELECT 
        instance_id,
        domain,
        created_at,
        sequence
      FROM projections.instance_trusted_domains
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const domains = result.rows.map(this.mapRowToInstanceTrustedDomain);

    return { domains, total };
  }

  /**
   * Helper: Get all domains for an instance
   */
  private async getInstanceDomainsByInstanceID(instanceID: string): Promise<InstanceDomain[]> {
    const result = await this.database.query<any>(
      `SELECT 
        instance_id,
        domain,
        is_primary,
        is_generated,
        created_at,
        updated_at,
        sequence
      FROM projections.instance_domains
      WHERE instance_id = $1
      ORDER BY is_primary DESC, created_at ASC`,
      [instanceID]
    );

    return result.rows.map(this.mapRowToInstanceDomain);
  }

  /**
   * Helper: Get all trusted domains for an instance
   */
  private async getInstanceTrustedDomainsByInstanceID(
    instanceID: string
  ): Promise<InstanceTrustedDomain[]> {
    const result = await this.database.query<any>(
      `SELECT 
        instance_id,
        domain,
        created_at,
        sequence
      FROM projections.instance_trusted_domains
      WHERE instance_id = $1
      ORDER BY created_at ASC`,
      [instanceID]
    );

    return result.rows.map(this.mapRowToInstanceTrustedDomain);
  }

  /**
   * Map database row to Instance
   */
  private mapRowToInstance(
    row: any,
    domains: InstanceDomain[],
    trustedDomains: InstanceTrustedDomain[]
  ): Instance {
    const primaryDomain = domains.find(d => d.isPrimary);
    
    return {
      id: row.id,
      name: row.name,
      defaultOrgID: row.default_org_id,
      defaultLanguage: row.default_language,
      state: row.state as InstanceState,
      domains,
      primaryDomain: primaryDomain?.domain,
      features: row.features,
      trustedDomains,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      sequence: parseInt(row.sequence, 10),
    };
  }

  /**
   * Map database row to InstanceDomain
   */
  private mapRowToInstanceDomain(row: any): InstanceDomain {
    return {
      instanceID: row.instance_id,
      domain: row.domain,
      isPrimary: row.is_primary,
      isGenerated: row.is_generated,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      sequence: parseInt(row.sequence, 10),
    };
  }

  /**
   * Map database row to InstanceTrustedDomain
   */
  private mapRowToInstanceTrustedDomain(row: any): InstanceTrustedDomain {
    return {
      instanceID: row.instance_id,
      domain: row.domain,
      createdAt: new Date(row.created_at),
      sequence: parseInt(row.sequence, 10),
    };
  }
}
