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
  async getOrgByID(orgID: string, instanceID?: string): Promise<Organization | null> {
    const query = instanceID
      ? `SELECT 
          id, instance_id as "instanceID", name, state,
          primary_domain as "primaryDomain", resource_owner as "resourceOwner",
          created_at as "createdAt", updated_at as "updatedAt",
          change_date as "changeDate", sequence
        FROM projections.orgs
        WHERE instance_id = $1 AND id = $2 AND state != 'removed'`
      : `SELECT 
          id, instance_id as "instanceID", name, state,
          primary_domain as "primaryDomain", resource_owner as "resourceOwner",
          created_at as "createdAt", updated_at as "updatedAt",
          change_date as "changeDate", sequence
        FROM projections.orgs
        WHERE id = $1 AND state != 'removed'`;
    
    const params = instanceID ? [instanceID, orgID] : [orgID];
    const result = await this.database.query(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToOrganization(result.rows[0]);
  }

  /**
   * Get organization by domain
   */
  async getOrgByDomainGlobal(domain: string, instanceID?: string): Promise<Organization | null> {
    const query = instanceID
      ? `SELECT 
          o.id,
          o.instance_id as "instanceID",
          o.name,
          o.state,
          o.primary_domain as "primaryDomain",
          o.created_at as "createdAt",
          o.updated_at as "updatedAt",
          o.sequence
        FROM projections.orgs o
        INNER JOIN projections.org_domains od ON o.instance_id = od.instance_id AND o.id = od.org_id
        WHERE o.instance_id = $1 AND od.domain = $2 AND od.is_verified = TRUE AND o.state != 'removed'`
      : `SELECT 
          o.id,
          o.instance_id as "instanceID",
          o.name,
          o.state,
          o.primary_domain as "primaryDomain",
          o.created_at as "createdAt",
          o.updated_at as "updatedAt",
          o.sequence
        FROM projections.orgs o
        INNER JOIN projections.org_domains od ON o.instance_id = od.instance_id AND o.id = od.org_id
        WHERE od.domain = $1 AND od.is_verified = TRUE AND o.state != 'removed'`;
    
    const params = instanceID ? [instanceID, domain] : [domain];
    const result = await this.database.query(query, params);

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
    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.name) {
      conditions.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${query.name}%`);
    }

    if (query.state) {
      conditions.push(`state = $${paramIndex++}`);
      params.push(query.state);
    }

    if (query.domain) {
      const domainParam = `%${query.domain}%`;
      if (query.instanceID) {
        conditions.push(
          `id IN (
            SELECT org_id FROM projections.org_domains 
            WHERE instance_id = $${paramIndex++} AND domain ILIKE $${paramIndex++} AND is_verified = TRUE
          )`
        );
        params.push(query.instanceID, domainParam);
      } else {
        conditions.push(
          `id IN (
            SELECT org_id FROM projections.org_domains 
            WHERE domain ILIKE $${paramIndex++} AND is_verified = TRUE
          )`
        );
        params.push(domainParam);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countResult = await this.database.query(
      `SELECT COUNT(*) as count FROM projections.orgs ${whereClause}`,
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
        instance_id as "instanceID",
        name,
        state,
        primary_domain as "primaryDomain",
        created_at as "createdAt",
        updated_at as "updatedAt",
        sequence
      FROM projections.orgs
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
   * Get all domains for an organization
   */
  async getOrgDomainsByID(orgID: string, instanceID?: string): Promise<OrganizationDomain[]> {
    const query = instanceID
      ? `SELECT 
          instance_id as "instanceID",
          org_id as "orgID",
          domain,
          is_verified as "isVerified",
          is_primary as "isPrimary",
          validation_type as "validationType",
          validation_code as "validationCode",
          created_at as "createdAt",
          updated_at as "updatedAt",
          sequence
        FROM projections.org_domains
        WHERE instance_id = $1 AND org_id = $2
        ORDER BY is_primary DESC, created_at ASC`
      : `SELECT 
          instance_id as "instanceID",
          org_id as "orgID",
          domain,
          is_verified as "isVerified",
          is_primary as "isPrimary",
          validation_type as "validationType",
          validation_code as "validationCode",
          created_at as "createdAt",
          updated_at as "updatedAt",
          sequence
        FROM projections.org_domains
        WHERE org_id = $1
        ORDER BY is_primary DESC, created_at ASC`;
    
    const params = instanceID ? [instanceID, orgID] : [orgID];
    const result = await this.database.query(query, params);

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
    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

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
      `SELECT COUNT(*) as count FROM projections.org_domains ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    params.push(limit, offset);

    const result = await this.database.query(
      `SELECT 
        instance_id as "instanceID",
        org_id as "orgID",
        domain,
        is_verified as "isVerified",
        is_primary as "isPrimary",
        validation_type as "validationType",
        validation_code as "validationCode",
        created_at as "createdAt",
        updated_at as "updatedAt",
        sequence
      FROM projections.org_domains
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
   * Check if domain is available (not taken by another org)
   */
  async isDomainAvailable(domain: string, instanceID?: string): Promise<boolean> {
    const query = instanceID
      ? `SELECT COUNT(*) as count FROM projections.org_domains WHERE instance_id = $1 AND domain = $2`
      : `SELECT COUNT(*) as count FROM projections.org_domains WHERE domain = $1`;
    
    const params = instanceID ? [instanceID, domain] : [domain];
    const result = await this.database.query(query, params);

    return parseInt(result.rows[0].count, 10) === 0;
  }

  /**
   * Get primary domain for an organization
   */
  async getPrimaryDomainByOrgID(orgID: string, instanceID?: string): Promise<OrganizationDomain | null> {
    const query = instanceID
      ? `SELECT 
          instance_id as "instanceID",
          org_id as "orgID",
          domain,
          is_verified as "isVerified",
          is_primary as "isPrimary",
          validation_type as "validationType",
          validation_code as "validationCode",
          created_at as "createdAt",
          updated_at as "updatedAt",
          sequence
        FROM projections.org_domains
        WHERE instance_id = $1 AND org_id = $2 AND is_primary = TRUE`
      : `SELECT 
          instance_id as "instanceID",
          org_id as "orgID",
          domain,
          is_verified as "isVerified",
          is_primary as "isPrimary",
          validation_type as "validationType",
          validation_code as "validationCode",
          created_at as "createdAt",
          updated_at as "updatedAt",
          sequence
        FROM projections.org_domains
        WHERE org_id = $1 AND is_primary = TRUE`;
    
    const params = instanceID ? [instanceID, orgID] : [orgID];
    const result = await this.database.query(query, params);

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
      instanceID: row.instanceID || undefined,
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
      instanceID: row.instanceID || undefined,
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
