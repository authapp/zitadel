/**
 * User Membership Queries
 * Aggregates and queries all user memberships across different scopes
 * Based on Zitadel Go internal/query/user_membership.go
 */

import { DatabasePool } from '../../database';
import {
  UserMembership,
  UserMembershipSearchRequest,
  UserMembershipSearchResponse,
  MemberType,
} from './user-membership-types';

export class UserMembershipQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get all memberships for a user across all scopes
   * 
   * @param userID - User ID
   * @param instanceID - Instance ID
   * @returns Array of user memberships
   */
  async getUserMemberships(
    userID: string,
    instanceID: string
  ): Promise<UserMembership[]> {
    const memberships: UserMembership[] = [];

    // Get instance memberships
    const instanceMembers = await this.getInstanceMemberships(userID, instanceID);
    memberships.push(...instanceMembers);

    // Get org memberships
    const orgMembers = await this.getOrgMemberships(userID, instanceID);
    memberships.push(...orgMembers);

    // Get project memberships
    const projectMembers = await this.getProjectMemberships(userID, instanceID);
    memberships.push(...projectMembers);

    // Get project grant memberships
    const grantMembers = await this.getProjectGrantMemberships(userID, instanceID);
    memberships.push(...grantMembers);

    // Sort by creation date (newest first)
    return memberships.sort((a, b) => b.creationDate.getTime() - a.creationDate.getTime());
  }

  /**
   * Search user memberships with filters and pagination
   * 
   * @param request - Search request with filters
   * @returns Search response with memberships
   */
  async searchUserMemberships(
    request: UserMembershipSearchRequest
  ): Promise<UserMembershipSearchResponse> {
    const { userID, memberTypes, orgID, projectID, limit = 100, offset = 0 } = request;

    let memberships: UserMembership[] = [];

    // Determine which types to fetch
    const typesToFetch = memberTypes || Object.values(MemberType);

    for (const type of typesToFetch) {
      switch (type) {
        case MemberType.INSTANCE:
          const instanceMembers = await this.getInstanceMemberships(userID, request.instanceID!);
          memberships.push(...instanceMembers);
          break;

        case MemberType.ORG:
          const orgMembers = await this.getOrgMemberships(userID, request.instanceID!, orgID);
          memberships.push(...orgMembers);
          break;

        case MemberType.PROJECT:
          const projectMembers = await this.getProjectMemberships(
            userID,
            request.instanceID!,
            projectID
          );
          memberships.push(...projectMembers);
          break;

        case MemberType.PROJECT_GRANT:
          const grantMembers = await this.getProjectGrantMemberships(
            userID,
            request.instanceID!,
            projectID
          );
          memberships.push(...grantMembers);
          break;
      }
    }

    // Sort by creation date (newest first)
    memberships.sort((a, b) => b.creationDate.getTime() - a.creationDate.getTime());

    // Apply pagination
    const totalCount = memberships.length;
    const paginatedMemberships = memberships.slice(offset, offset + limit);

    return {
      items: paginatedMemberships,
      totalCount,
      limit,
      offset,
    };
  }

  /**
   * Get instance memberships for user
   */
  private async getInstanceMemberships(
    userID: string,
    instanceID: string
  ): Promise<UserMembership[]> {
    const query = `
      SELECT 
        im.user_id,
        im.instance_id,
        im.roles,
        im.creation_date,
        im.change_date,
        im.sequence,
        im.resource_owner
      FROM projections.instance_members im
      WHERE im.user_id = $1 AND im.instance_id = $2
    `;

    const result = await this.database.query(query, [userID, instanceID]);

    return result.rows.map(row => ({
      userID: row.user_id,
      memberType: MemberType.INSTANCE,
      aggregateID: row.instance_id,
      objectID: row.instance_id,
      roles: row.roles || [],
      displayName: 'Instance',
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
    }));
  }

  /**
   * Get org memberships for user
   */
  private async getOrgMemberships(
    userID: string,
    instanceID: string,
    orgID?: string
  ): Promise<UserMembership[]> {
    let query = `
      SELECT 
        om.user_id,
        om.org_id,
        om.instance_id,
        om.roles,
        om.creation_date,
        om.change_date,
        om.sequence,
        om.resource_owner,
        o.name as org_name
      FROM projections.org_members om
      LEFT JOIN projections.orgs o ON om.org_id = o.id AND om.instance_id = o.instance_id
      WHERE om.user_id = $1 AND om.instance_id = $2
    `;

    const params: (string | undefined)[] = [userID, instanceID];

    if (orgID) {
      query += ' AND om.org_id = $3';
      params.push(orgID);
    }

    const result = await this.database.query(query, params.filter(p => p !== undefined));

    return result.rows.map(row => ({
      userID: row.user_id,
      memberType: MemberType.ORG,
      aggregateID: row.org_id,
      objectID: row.org_id,
      roles: row.roles || [],
      displayName: row.org_name || row.org_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      orgID: row.org_id,
      orgName: row.org_name,
    }));
  }

  /**
   * Get project memberships for user
   */
  private async getProjectMemberships(
    userID: string,
    instanceID: string,
    projectID?: string
  ): Promise<UserMembership[]> {
    let query = `
      SELECT 
        pm.user_id,
        pm.project_id,
        pm.instance_id,
        pm.roles,
        pm.creation_date,
        pm.change_date,
        pm.sequence,
        pm.resource_owner,
        p.name as project_name,
        p.resource_owner as project_org_id
      FROM projections.project_members pm
      LEFT JOIN projections.projects p ON pm.project_id = p.id AND pm.instance_id = p.instance_id
      WHERE pm.user_id = $1 AND pm.instance_id = $2
    `;

    const params: (string | undefined)[] = [userID, instanceID];

    if (projectID) {
      query += ' AND pm.project_id = $3';
      params.push(projectID);
    }

    const result = await this.database.query(query, params.filter(p => p !== undefined));

    return result.rows.map(row => ({
      userID: row.user_id,
      memberType: MemberType.PROJECT,
      aggregateID: row.project_id,
      objectID: row.project_id,
      roles: row.roles || [],
      displayName: row.project_name || row.project_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      projectID: row.project_id,
      projectName: row.project_name,
      orgID: row.project_org_id,
    }));
  }

  /**
   * Get project grant memberships for user
   */
  private async getProjectGrantMemberships(
    userID: string,
    instanceID: string,
    projectID?: string
  ): Promise<UserMembership[]> {
    let query = `
      SELECT 
        pgm.user_id,
        pgm.project_id,
        pgm.grant_id,
        pgm.instance_id,
        pgm.roles,
        pgm.creation_date,
        pgm.change_date,
        pgm.sequence,
        pgm.resource_owner,
        p.name as project_name,
        pg.granted_org_id
      FROM projections.project_grant_members pgm
      LEFT JOIN projections.projects p ON pgm.project_id = p.id AND pgm.instance_id = p.instance_id
      LEFT JOIN projections.project_grants pg ON pgm.grant_id = pg.id AND pgm.instance_id = pg.instance_id
      WHERE pgm.user_id = $1 AND pgm.instance_id = $2
    `;

    const params: (string | undefined)[] = [userID, instanceID];

    if (projectID) {
      query += ' AND pgm.project_id = $3';
      params.push(projectID);
    }

    const result = await this.database.query(query, params.filter(p => p !== undefined));

    return result.rows.map(row => ({
      userID: row.user_id,
      memberType: MemberType.PROJECT_GRANT,
      aggregateID: row.grant_id,
      objectID: row.grant_id,
      roles: row.roles || [],
      displayName: `${row.project_name || row.project_id} (Grant)`,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      resourceOwner: row.resource_owner,
      projectID: row.project_id,
      grantID: row.grant_id,
      projectName: row.project_name,
      orgID: row.granted_org_id,
    }));
  }
}
