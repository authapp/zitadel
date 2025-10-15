/**
 * Organization Queries
 * 
 * Query methods for organizations and organization domains.
 * Based on Zitadel Go internal/query/org.go
 */

import { DatabasePool } from '../../database/pool';
import {
  Organization,
  OrganizationDomain,
  OrganizationWithDomains,
  OrgSearchQuery,
  OrgDomainSearchQuery,
  OrgSearchResult,
  OrgDomainSearchResult,
  OrgState,
} from './org-types';

/**
 * Organization Queries
 */
export class OrgQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get organization by ID
   */
  async getOrgByID(orgID: string): Promise<Organization | null> {
    const result = await this.database.query(
      `SELECT 
        id,
        name,
        state,
        primary_domain as "primaryDomain",
        created_at as "createdAt",
        updated_at as "updatedAt",
        sequence
      FROM orgs_projection
      WHERE id = $1 AND state != 'removed'`,
      [orgID]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToOrganization(result.rows[0]);
  }

  /**
   * Get organization by domain (global lookup)
   */
  async getOrgByDomainGlobal(domain: string): Promise<Organization | null> {
    const result = await this.database.query(
      `SELECT 
        o.id,
        o.name,
        o.state,
        o.primary_domain as "primaryDomain",
        o.created_at as "createdAt",
        o.updated_at as "updatedAt",
        o.sequence
      FROM orgs_projection o
      INNER JOIN org_domains_projection od ON o.id = od.org_id
      WHERE od.domain = $1 AND od.is_verified = TRUE AND o.state != 'removed'`,
      [domain]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToOrganization(result.rows[0]);
  }

  /**
   * Search organizations
   */
  async searchOrgs(query: OrgSearchQuery): Promise<OrgSearchResult> {
    const conditions: string[] = ["state != 'removed'"];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (query.name) {
      conditions.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${query.name}%`);
    }

    if (query.state) {
      conditions.push(`state = $${paramIndex++}`);
      params.push(query.state);
    }

    if (query.domain) {
      conditions.push(
        `id IN (
          SELECT org_id FROM org_domains_projection 
          WHERE domain ILIKE $${paramIndex++} AND is_verified = TRUE
        )`
      );
      params.push(`%${query.domain}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countResult = await this.database.query(
      `SELECT COUNT(*) as count FROM orgs_projection ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    params.push(limit, offset);

    const result = await this.database.query(
      `SELECT 
        id,
        name,
        state,
        primary_domain as "primaryDomain",
        created_at as "createdAt",
        updated_at as "updatedAt",
        sequence
      FROM orgs_projection
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return {
      orgs: result.rows.map(row => this.mapToOrganization(row)),
      total,
    };
  }

  /**
   * Get organization with domains
   */
  async getOrgWithDomains(orgID: string): Promise<OrganizationWithDomains | null> {
    const org = await this.getOrgByID(orgID);
    if (!org) {
      return null;
    }

    const domains = await this.getOrgDomainsByID(orgID);

    return {
      ...org,
      domains,
    };
  }

  /**
   * Get organization domains by org ID
   */
  async getOrgDomainsByID(orgID: string): Promise<OrganizationDomain[]> {
    const result = await this.database.query(
      `SELECT 
        org_id as "orgID",
        domain,
        is_verified as "isVerified",
        is_primary as "isPrimary",
        validation_type as "validationType",
        validation_code as "validationCode",
        created_at as "createdAt",
        updated_at as "updatedAt",
        sequence
      FROM org_domains_projection
      WHERE org_id = $1
      ORDER BY is_primary DESC, created_at ASC`,
      [orgID]
    );

    return result.rows.map(row => this.mapToOrganizationDomain(row));
  }

  /**
   * Search organization domains
   */
  async searchOrgDomains(query: OrgDomainSearchQuery): Promise<OrgDomainSearchResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (query.orgID) {
      conditions.push(`org_id = $${paramIndex++}`);
      params.push(query.orgID);
    }

    if (query.domain) {
      conditions.push(`domain ILIKE $${paramIndex++}`);
      params.push(`%${query.domain}%`);
    }

    if (query.isVerified !== undefined) {
      conditions.push(`is_verified = $${paramIndex++}`);
      params.push(query.isVerified);
    }

    if (query.isPrimary !== undefined) {
      conditions.push(`is_primary = $${paramIndex++}`);
      params.push(query.isPrimary);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countResult = await this.database.query(
      `SELECT COUNT(*) as count FROM org_domains_projection ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    params.push(limit, offset);

    const result = await this.database.query(
      `SELECT 
        org_id as "orgID",
        domain,
        is_verified as "isVerified",
        is_primary as "isPrimary",
        validation_type as "validationType",
        validation_code as "validationCode",
        created_at as "createdAt",
        updated_at as "updatedAt",
        sequence
      FROM org_domains_projection
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return {
      domains: result.rows.map(row => this.mapToOrganizationDomain(row)),
      total,
    };
  }

  /**
   * Check if domain is available (not used by any org)
   */
  async isDomainAvailable(domain: string): Promise<boolean> {
    const result = await this.database.query(
      `SELECT COUNT(*) as count FROM org_domains_projection WHERE domain = $1`,
      [domain]
    );

    return parseInt(result.rows[0].count, 10) === 0;
  }

  /**
   * Get primary domain for organization
   */
  async getPrimaryDomain(orgID: string): Promise<OrganizationDomain | null> {
    const result = await this.database.query(
      `SELECT 
        org_id as "orgID",
        domain,
        is_verified as "isVerified",
        is_primary as "isPrimary",
        validation_type as "validationType",
        validation_code as "validationCode",
        created_at as "createdAt",
        updated_at as "updatedAt",
        sequence
      FROM org_domains_projection
      WHERE org_id = $1 AND is_primary = TRUE`,
      [orgID]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToOrganizationDomain(result.rows[0]);
  }

  /**
   * Map database row to Organization
   */
  private mapToOrganization(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      state: row.state as OrgState,
      primaryDomain: row.primaryDomain || undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      sequence: parseInt(row.sequence, 10),
    };
  }

  /**
   * Map database row to OrganizationDomain
   */
  private mapToOrganizationDomain(row: any): OrganizationDomain {
    return {
      orgID: row.orgID,
      domain: row.domain,
      isVerified: row.isVerified,
      isPrimary: row.isPrimary,
      validationType: row.validationType,
      validationCode: row.validationCode || undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      sequence: parseInt(row.sequence, 10),
    };
  }
}
