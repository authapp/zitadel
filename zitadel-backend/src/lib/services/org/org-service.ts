/**
 * Organization service implementation
 */

import { Organization } from '../../domain/organization';
import { AuthContext, PermissionBuilder, ActionType } from '../../authz';
import { PermissionChecker } from '../../authz/types';
import { CommandBus } from '../../command/types';
import { Query } from '../../query/types';
import { generateId } from '../../id/snowflake';
import {
  OrgService,
  CreateOrgRequest,
  UpdateOrgRequest,
  AddMemberRequest,
  OrgListOptions,
  OrgNotFoundError,
  OrgAlreadyExistsError,
} from './types';

/**
 * Default organization service implementation
 */
export class DefaultOrgService implements OrgService {
  constructor(
    _commandBus: CommandBus, // Will be used in production for dispatching commands
    private query: Query,
    private permissionChecker: PermissionChecker
  ) {}

  /**
   * Create new organization
   */
  async create(context: AuthContext, request: CreateOrgRequest): Promise<Organization> {
    await this.checkPermission(context, PermissionBuilder.org(ActionType.CREATE));

    // Check if org already exists
    if (request.domain) {
      const existing = await this.query.execute<any>(
        'SELECT id FROM organizations WHERE domain = $1',
        [request.domain]
      );
      if (existing.length > 0) {
        throw new OrgAlreadyExistsError(request.domain);
      }
    }

    // Create org
    const orgId = generateId();
    const org: Organization = {
      id: orgId,
      name: request.name,
      state: 1, // OrgState.ACTIVE
      primaryDomain: request.domain,
      createdAt: new Date(),
      changedAt: new Date(),
      sequence: 0,
    };

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'org.create', ... });

    return org;
  }

  /**
   * Get organization by ID
   */
  async getById(context: AuthContext, orgId: string): Promise<Organization | null> {
    await this.checkPermission(context, PermissionBuilder.org(ActionType.READ, orgId));

    const org = await this.query.findById<Organization>('organizations', orgId);
    return org;
  }

  /**
   * Get organization by domain
   */
  async getByDomain(context: AuthContext, domain: string): Promise<Organization | null> {
    await this.checkPermission(context, PermissionBuilder.org(ActionType.READ));

    const orgs = await this.query.execute<Organization>(
      'SELECT * FROM organizations WHERE domain = $1',
      [domain]
    );
    return orgs.length > 0 ? orgs[0] : null;
  }

  /**
   * List organizations
   */
  async list(context: AuthContext, options?: OrgListOptions): Promise<Organization[]> {
    await this.checkPermission(context, PermissionBuilder.org(ActionType.LIST));

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    let query = 'SELECT * FROM organizations WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.filters?.name) {
      query += ` AND name LIKE $${paramIndex}`;
      params.push(`%${options.filters.name}%`);
      paramIndex++;
    }

    if (options?.filters?.domain) {
      query += ` AND domain = $${paramIndex}`;
      params.push(options.filters.domain);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const orgs = await this.query.execute<Organization>(query, params);
    return orgs;
  }

  /**
   * Update organization
   */
  async update(
    context: AuthContext,
    orgId: string,
    _request: UpdateOrgRequest
  ): Promise<Organization> {
    await this.checkPermission(context, PermissionBuilder.org(ActionType.UPDATE, orgId));

    const org = await this.getById(context, orgId);
    if (!org) {
      throw new OrgNotFoundError(orgId);
    }

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'org.update', ... });

    return this.getById(context, orgId) as Promise<Organization>;
  }

  /**
   * Delete organization
   */
  async delete(context: AuthContext, orgId: string): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.org(ActionType.DELETE, orgId));

    const org = await this.getById(context, orgId);
    if (!org) {
      throw new OrgNotFoundError(orgId);
    }

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'org.delete', ... });
  }

  /**
   * Add member to organization
   */
  async addMember(context: AuthContext, orgId: string, _request: AddMemberRequest): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.org(ActionType.MANAGE, orgId));

    const org = await this.getById(context, orgId);
    if (!org) {
      throw new OrgNotFoundError(orgId);
    }

    // In production, dispatch command to add member
    // await this.commandBus.execute({ type: 'org.addMember', ... });
  }

  /**
   * Remove member from organization
   */
  async removeMember(context: AuthContext, orgId: string, _userId: string): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.org(ActionType.MANAGE, orgId));

    // In production, dispatch command
    // await this.commandBus.execute({ type: 'org.removeMember', ... });
  }

  /**
   * List organization members
   */
  async listMembers(context: AuthContext, orgId: string): Promise<any[]> {
    await this.checkPermission(context, PermissionBuilder.org(ActionType.READ, orgId));

    const members = await this.query.execute<any>(
      'SELECT u.* FROM users u JOIN org_members om ON u.id = om.user_id WHERE om.org_id = $1',
      [orgId]
    );
    return members;
  }

  /**
   * Check permission
   */
  private async checkPermission(context: AuthContext, permission: any): Promise<void> {
    const result = await this.permissionChecker.check(context, permission);
    if (!result.allowed) {
      throw new Error(`Permission denied: ${result.reason}`);
    }
  }
}

/**
 * Create organization service
 */
export function createOrgService(
  commandBus: CommandBus,
  query: Query,
  permissionChecker: PermissionChecker
): OrgService {
  return new DefaultOrgService(commandBus, query, permissionChecker);
}
