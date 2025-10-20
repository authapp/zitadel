/**
 * IDP queries for Zitadel query layer
 * Handles identity provider lookups for external authentication
 */

import { DatabasePool } from '../../database';
import {
  IDP,
  IDPTemplate,
  IDPUserLink,
  IDPLoginPolicyLink,
  IDPSearchQuery,
  IDPSearchResult,
  IDPTemplateSearchQuery,
  IDPTemplateSearchResult,
  IDPUserLinkSearchQuery,
  IDPUserLinkSearchResult,
  IDPLoginPolicyLinkSearchQuery,
  IDPLoginPolicyLinkSearchResult,
  IDPType,
  IDPState,
} from './idp-types';

export class IDPQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get IDP by ID
   * 
   * @param idpID - The IDP ID
   * @param instanceID - Optional instance ID filter
   * @returns IDP or null if not found
   */
  async getIDPByID(idpID: string, instanceID?: string): Promise<IDP | null> {
    const conditions = ['id = $1'];
    const params: any[] = [idpID];

    if (instanceID) {
      conditions.push('instance_id = $2');
      params.push(instanceID);
    }

    const result = await this.database.queryOne(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        name, type, state, styling_type, is_creation_allowed, is_linking_allowed,
        is_auto_creation, is_auto_update, config_data
       FROM projections.idps
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (!result) {
      return null;
    }

    return this.mapRowToIDP(result);
  }

  /**
   * Search IDPs
   * 
   * @param query - Search query parameters
   * @returns Search result with IDPs
   */
  async searchIDPs(query: IDPSearchQuery): Promise<IDPSearchResult> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.resourceOwner) {
      conditions.push(`resource_owner = $${paramIndex++}`);
      params.push(query.resourceOwner);
    }

    if (query.name) {
      conditions.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${query.name}%`);
    }

    if (query.type !== undefined) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(query.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM projections.idps ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get IDPs
    const result = await this.database.query(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        name, type, state, styling_type, is_creation_allowed, is_linking_allowed,
        is_auto_creation, is_auto_update, config_data
       FROM projections.idps
       ${whereClause}
       ORDER BY creation_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const idps = result.rows.map(row => this.mapRowToIDP(row));

    return {
      idps,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get IDP template by ID
   * 
   * @param templateID - The template ID
   * @param instanceID - Optional instance ID filter
   * @returns IDP template or null if not found
   */
  async getIDPTemplate(templateID: string, instanceID?: string): Promise<IDPTemplate | null> {
    const conditions = ['id = $1'];
    const params: any[] = [templateID];

    if (instanceID) {
      conditions.push('instance_id = $2');
      params.push(instanceID);
    }

    const result = await this.database.queryOne(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        name, type, owner_type, is_creation_allowed, is_linking_allowed,
        is_auto_creation, is_auto_update
       FROM projections.idp_templates
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (!result) {
      return null;
    }

    return this.mapRowToIDPTemplate(result);
  }

  /**
   * Search IDP templates
   * 
   * @param query - Search query parameters
   * @returns Search result with templates
   */
  async searchIDPTemplates(query: IDPTemplateSearchQuery): Promise<IDPTemplateSearchResult> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.resourceOwner) {
      conditions.push(`resource_owner = $${paramIndex++}`);
      params.push(query.resourceOwner);
    }

    if (query.ownerType) {
      conditions.push(`owner_type = $${paramIndex++}`);
      params.push(query.ownerType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM projections.idp_templates ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get templates
    const result = await this.database.query(
      `SELECT 
        id, creation_date, change_date, sequence, resource_owner, instance_id,
        name, type, owner_type, is_creation_allowed, is_linking_allowed,
        is_auto_creation, is_auto_update
       FROM projections.idp_templates
       ${whereClause}
       ORDER BY creation_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const templates = result.rows.map(row => this.mapRowToIDPTemplate(row));

    return {
      templates,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get user-IDP link
   * 
   * @param userID - The user ID
   * @param idpID - The IDP ID
   * @param instanceID - Optional instance ID filter
   * @returns User-IDP link or null if not found
   */
  async getUserIDPLink(userID: string, idpID: string, instanceID?: string): Promise<IDPUserLink | null> {
    const conditions = ['user_id = $1', 'idp_id = $2'];
    const params: any[] = [userID, idpID];

    if (instanceID) {
      conditions.push('instance_id = $3');
      params.push(instanceID);
    }

    const result = await this.database.queryOne(
      `SELECT 
        idp_id, user_id, idp_name, provided_user_id, provided_user_name,
        creation_date, change_date, sequence, resource_owner, instance_id
       FROM projections.idp_user_links
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (!result) {
      return null;
    }

    return this.mapRowToIDPUserLink(result);
  }

  /**
   * Search user-IDP links
   * 
   * @param query - Search query parameters
   * @returns Search result with links
   */
  async searchUserIDPLinks(query: IDPUserLinkSearchQuery): Promise<IDPUserLinkSearchResult> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.userID) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(query.userID);
    }

    if (query.idpID) {
      conditions.push(`idp_id = $${paramIndex++}`);
      params.push(query.idpID);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM projections.idp_user_links ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get links
    const result = await this.database.query(
      `SELECT 
        idp_id, user_id, idp_name, provided_user_id, provided_user_name,
        creation_date, change_date, sequence, resource_owner, instance_id
       FROM projections.idp_user_links
       ${whereClause}
       ORDER BY creation_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const links = result.rows.map(row => this.mapRowToIDPUserLink(row));

    return {
      links,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get login policy IDP link
   * 
   * @param idpID - The IDP ID
   * @param resourceOwner - Resource owner (org or instance ID)
   * @param instanceID - Optional instance ID filter
   * @returns Login policy IDP link or null if not found
   */
  async getLoginPolicyIDPLink(
    idpID: string,
    resourceOwner: string,
    instanceID?: string
  ): Promise<IDPLoginPolicyLink | null> {
    const conditions = ['idp_id = $1', 'resource_owner = $2'];
    const params: any[] = [idpID, resourceOwner];

    if (instanceID) {
      conditions.push('instance_id = $3');
      params.push(instanceID);
    }

    const result = await this.database.queryOne(
      `SELECT 
        idp_id, creation_date, change_date, sequence, resource_owner, instance_id, owner_type
       FROM projections.idp_login_policy_links
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (!result) {
      return null;
    }

    return this.mapRowToIDPLoginPolicyLink(result);
  }

  /**
   * Search login policy IDP links
   * 
   * @param query - Search query parameters
   * @returns Search result with links
   */
  async searchLoginPolicyIDPLinks(
    query: IDPLoginPolicyLinkSearchQuery
  ): Promise<IDPLoginPolicyLinkSearchResult> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.instanceID) {
      conditions.push(`instance_id = $${paramIndex++}`);
      params.push(query.instanceID);
    }

    if (query.resourceOwner) {
      conditions.push(`resource_owner = $${paramIndex++}`);
      params.push(query.resourceOwner);
    }

    if (query.ownerType) {
      conditions.push(`owner_type = $${paramIndex++}`);
      params.push(query.ownerType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.database.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM projections.idp_login_policy_links ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get links
    const result = await this.database.query(
      `SELECT 
        idp_id, creation_date, change_date, sequence, resource_owner, instance_id, owner_type
       FROM projections.idp_login_policy_links
       ${whereClause}
       ORDER BY creation_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const links = result.rows.map(row => this.mapRowToIDPLoginPolicyLink(row));

    return {
      links,
      total,
      limit,
      offset,
    };
  }

  /**
   * Map database row to IDP
   */
  private mapRowToIDP(row: any): IDP {
    return {
      id: row.id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      name: row.name,
      type: row.type || IDPType.UNSPECIFIED,
      state: row.state || IDPState.UNSPECIFIED,
      stylingType: row.styling_type || 0,
      isCreationAllowed: row.is_creation_allowed || false,
      isLinkingAllowed: row.is_linking_allowed || false,
      isAutoCreation: row.is_auto_creation || false,
      isAutoUpdate: row.is_auto_update || false,
    };
  }

  /**
   * Map database row to IDP template
   */
  private mapRowToIDPTemplate(row: any): IDPTemplate {
    return {
      id: row.id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      name: row.name,
      type: row.type || IDPType.UNSPECIFIED,
      ownerType: row.owner_type || 'instance',
      isCreationAllowed: row.is_creation_allowed || false,
      isLinkingAllowed: row.is_linking_allowed || false,
      isAutoCreation: row.is_auto_creation || false,
      isAutoUpdate: row.is_auto_update || false,
    };
  }

  /**
   * Map database row to IDP user link
   */
  private mapRowToIDPUserLink(row: any): IDPUserLink {
    return {
      idpID: row.idp_id,
      userID: row.user_id,
      idpName: row.idp_name,
      providedUserID: row.provided_user_id,
      providedUserName: row.provided_user_name,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
    };
  }

  /**
   * Map database row to IDP login policy link
   */
  private mapRowToIDPLoginPolicyLink(row: any): IDPLoginPolicyLink {
    return {
      idpID: row.idp_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      instanceID: row.instance_id,
      ownerType: row.owner_type || 'instance',
    };
  }
}
