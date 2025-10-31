/**
 * Project Service Implementation (v2)
 * 
 * gRPC service handlers for project management
 * Based on: internal/api/grpc/project/v2/project.go
 */

import { Commands } from '@/lib/command/commands';
import { Context } from '@/lib/command/context';
import { 
  AddProjectRequest,
  AddProjectResponse,
  GetProjectRequest,
  GetProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
  DeactivateProjectRequest,
  DeactivateProjectResponse,
  ReactivateProjectRequest,
  ReactivateProjectResponse,
  RemoveProjectRequest,
  RemoveProjectResponse,
  AddProjectRoleRequest,
  AddProjectRoleResponse,
  UpdateProjectRoleRequest,
  UpdateProjectRoleResponse,
  RemoveProjectRoleRequest,
  RemoveProjectRoleResponse,
  AddProjectMemberRequest,
  AddProjectMemberResponse,
  UpdateProjectMemberRequest,
  UpdateProjectMemberResponse,
  RemoveProjectMemberRequest,
  RemoveProjectMemberResponse,
  AddProjectGrantRequest,
  AddProjectGrantResponse,
  UpdateProjectGrantRequest,
  UpdateProjectGrantResponse,
  DeactivateProjectGrantRequest,
  DeactivateProjectGrantResponse,
  ReactivateProjectGrantRequest,
  ReactivateProjectGrantResponse,
  RemoveProjectGrantRequest,
  RemoveProjectGrantResponse,
} from '../../proto/project/v2/project_service';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Convert object details to proto Details
 */
function objectDetailsToDetailsProto(details: any): any {
  return {
    sequence: details.sequence,
    changeDate: details.eventDate,
    resourceOwner: details.resourceOwner,
  };
}

/**
 * Project Service
 */
export class ProjectService {
  constructor(
    private readonly commands: Commands
  ) {}

  // ====================================================================
  // PROJECT CRUD
  // ====================================================================

  /**
   * AddProject - Create a new project
   */
  async addProject(
    ctx: Context,
    request: AddProjectRequest
  ): Promise<AddProjectResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-001');
    }
    if (!request.name || request.name.trim().length === 0) {
      throwInvalidArgument('name is required', 'PROJv2-002');
    }

    const result = await this.commands.addProject(ctx, {
      orgID: request.organizationId,
      name: request.name,
      projectRoleAssertion: request.projectRoleAssertion,
      projectRoleCheck: request.projectRoleCheck,
      hasProjectCheck: request.hasProjectCheck,
      privateLabelingSetting: request.privateLabelingSetting,
    });

    return {
      details: objectDetailsToDetailsProto(result),
      projectId: result.projectID,
    };
  }

  /**
   * GetProject - Get project by ID
   */
  async getProject(
    _ctx: Context,
    _request: GetProjectRequest
  ): Promise<GetProjectResponse> {
    // TODO: Implement query layer integration
    throw new Error('Not implemented - requires query layer');
  }

  /**
   * UpdateProject - Update project settings
   */
  async updateProject(
    ctx: Context,
    request: UpdateProjectRequest
  ): Promise<UpdateProjectResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-010');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-011');
    }

    const details = await this.commands.changeProject(
      ctx,
      request.projectId,
      request.organizationId,
      {
        name: request.name,
        projectRoleAssertion: request.projectRoleAssertion,
        projectRoleCheck: request.projectRoleCheck,
        hasProjectCheck: request.hasProjectCheck,
        privateLabelingSetting: request.privateLabelingSetting,
      }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * DeactivateProject - Deactivate a project
   */
  async deactivateProject(
    ctx: Context,
    request: DeactivateProjectRequest
  ): Promise<DeactivateProjectResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-020');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-021');
    }

    const details = await this.commands.deactivateProject(
      ctx,
      request.projectId,
      request.organizationId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * ReactivateProject - Reactivate a project
   */
  async reactivateProject(
    ctx: Context,
    request: ReactivateProjectRequest
  ): Promise<ReactivateProjectResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-030');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-031');
    }

    const details = await this.commands.reactivateProject(
      ctx,
      request.projectId,
      request.organizationId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveProject - Remove/delete a project
   */
  async removeProject(
    ctx: Context,
    request: RemoveProjectRequest
  ): Promise<RemoveProjectResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-040');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-041');
    }

    const details = await this.commands.removeProject(
      ctx,
      request.projectId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  // ====================================================================
  // PROJECT ROLES
  // ====================================================================

  /**
   * AddProjectRole - Add a role to the project
   */
  async addProjectRole(
    ctx: Context,
    request: AddProjectRoleRequest
  ): Promise<AddProjectRoleResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-050');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-051');
    }
    if (!request.roleKey) {
      throwInvalidArgument('roleKey is required', 'PROJv2-052');
    }
    if (!request.displayName) {
      throwInvalidArgument('displayName is required', 'PROJv2-053');
    }

    const details = await this.commands.addProjectRole(
      ctx,
      request.projectId,
      request.organizationId,
      {
        roleKey: request.roleKey,
        displayName: request.displayName,
        group: request.group,
      }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * UpdateProjectRole - Update a project role
   */
  async updateProjectRole(
    ctx: Context,
    request: UpdateProjectRoleRequest
  ): Promise<UpdateProjectRoleResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-060');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-061');
    }
    if (!request.roleKey) {
      throwInvalidArgument('roleKey is required', 'PROJv2-062');
    }

    const details = await this.commands.changeProjectRole(
      ctx,
      request.projectId,
      request.organizationId,
      request.roleKey,
      request.displayName,
      request.group
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveProjectRole - Remove a role from the project
   */
  async removeProjectRole(
    ctx: Context,
    request: RemoveProjectRoleRequest
  ): Promise<RemoveProjectRoleResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-070');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-071');
    }
    if (!request.roleKey) {
      throwInvalidArgument('roleKey is required', 'PROJv2-072');
    }

    const details = await this.commands.removeProjectRole(
      ctx,
      request.projectId,
      request.organizationId,
      request.roleKey
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  // ====================================================================
  // PROJECT MEMBERS
  // ====================================================================

  /**
   * AddProjectMember - Add a member to the project
   */
  async addProjectMember(
    ctx: Context,
    request: AddProjectMemberRequest
  ): Promise<AddProjectMemberResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-080');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-081');
    }
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'PROJv2-082');
    }
    if (!request.roles || request.roles.length === 0) {
      throwInvalidArgument('at least one role is required', 'PROJv2-083');
    }

    const details = await this.commands.addProjectMember(
      ctx,
      request.projectId,
      request.organizationId,
      {
        userID: request.userId,
        roles: request.roles,
      }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * UpdateProjectMember - Update member roles
   */
  async updateProjectMember(
    ctx: Context,
    request: UpdateProjectMemberRequest
  ): Promise<UpdateProjectMemberResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-090');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-091');
    }
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'PROJv2-092');
    }
    if (!request.roles || request.roles.length === 0) {
      throwInvalidArgument('at least one role is required', 'PROJv2-093');
    }

    const details = await this.commands.changeProjectMember(
      ctx,
      request.projectId,
      request.organizationId,
      request.userId,
      request.roles
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveProjectMember - Remove a member from project
   */
  async removeProjectMember(
    ctx: Context,
    request: RemoveProjectMemberRequest
  ): Promise<RemoveProjectMemberResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-100');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-101');
    }
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'PROJv2-102');
    }

    const details = await this.commands.removeProjectMember(
      ctx,
      request.projectId,
      request.userId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  // ====================================================================
  // PROJECT GRANTS
  // ====================================================================

  /**
   * AddProjectGrant - Grant project access to another organization
   */
  async addProjectGrant(
    ctx: Context,
    request: AddProjectGrantRequest
  ): Promise<AddProjectGrantResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-110');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-111');
    }
    if (!request.grantedOrgId) {
      throwInvalidArgument('grantedOrgId is required', 'PROJv2-112');
    }
    if (!request.roleKeys || request.roleKeys.length === 0) {
      throwInvalidArgument('at least one roleKey is required', 'PROJv2-113');
    }

    const result = await this.commands.addProjectGrant(
      ctx,
      request.projectId,
      request.organizationId,
      {
        grantedOrgID: request.grantedOrgId,
        roleKeys: request.roleKeys,
      }
    );

    return {
      details: objectDetailsToDetailsProto(result),
      grantId: result.grantID,
    };
  }

  /**
   * UpdateProjectGrant - Update grant roles
   */
  async updateProjectGrant(
    ctx: Context,
    request: UpdateProjectGrantRequest
  ): Promise<UpdateProjectGrantResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-120');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-121');
    }
    if (!request.grantId) {
      throwInvalidArgument('grantId is required', 'PROJv2-122');
    }
    if (!request.roleKeys || request.roleKeys.length === 0) {
      throwInvalidArgument('at least one roleKey is required', 'PROJv2-123');
    }

    const details = await this.commands.changeProjectGrant(
      ctx,
      request.projectId,
      request.organizationId,
      request.grantId,
      request.roleKeys
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * DeactivateProjectGrant - Deactivate a grant
   */
  async deactivateProjectGrant(
    ctx: Context,
    request: DeactivateProjectGrantRequest
  ): Promise<DeactivateProjectGrantResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-130');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-131');
    }
    if (!request.grantId) {
      throwInvalidArgument('grantId is required', 'PROJv2-132');
    }

    const details = await this.commands.deactivateProjectGrant(
      ctx,
      request.projectId,
      request.grantId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * ReactivateProjectGrant - Reactivate a grant
   */
  async reactivateProjectGrant(
    ctx: Context,
    request: ReactivateProjectGrantRequest
  ): Promise<ReactivateProjectGrantResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-140');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-141');
    }
    if (!request.grantId) {
      throwInvalidArgument('grantId is required', 'PROJv2-142');
    }

    const details = await this.commands.reactivateProjectGrant(
      ctx,
      request.projectId,
      request.grantId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveProjectGrant - Remove a grant
   */
  async removeProjectGrant(
    ctx: Context,
    request: RemoveProjectGrantRequest
  ): Promise<RemoveProjectGrantResponse> {
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'PROJv2-150');
    }
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'PROJv2-151');
    }
    if (!request.grantId) {
      throwInvalidArgument('grantId is required', 'PROJv2-152');
    }

    const details = await this.commands.removeProjectGrant(
      ctx,
      request.projectId,
      request.grantId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }
}
