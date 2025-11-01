/**
 * Instance Service Implementation (v2)
 * 
 * gRPC service handlers for instance management
 * Based on: internal/api/grpc/instance/v2/instance.go
 */

import { Commands } from '../../../../lib/command/commands';
import { Context } from '../../../../lib/command/context';
import { DatabasePool } from '../../../../lib/database';
import { InstanceQueries } from '../../../../lib/query/instance/instance-queries';
import { InstanceMemberQueries } from '../../../../lib/query/member/instance-member-queries';
import {
  SetupInstanceRequest,
  SetupInstanceResponse,
  GetInstanceRequest,
  GetInstanceResponse,
  RemoveInstanceRequest,
  RemoveInstanceResponse,
  AddInstanceDomainRequest,
  AddInstanceDomainResponse,
  SetDefaultInstanceDomainRequest,
  SetDefaultInstanceDomainResponse,
  RemoveInstanceDomainRequest,
  RemoveInstanceDomainResponse,
  SetInstanceFeaturesRequest,
  SetInstanceFeaturesResponse,
  GetInstanceFeaturesRequest,
  GetInstanceFeaturesResponse,
  ResetInstanceFeaturesRequest,
  ResetInstanceFeaturesResponse,
  AddInstanceMemberRequest,
  AddInstanceMemberResponse,
  UpdateInstanceMemberRequest,
  UpdateInstanceMemberResponse,
  RemoveInstanceMemberRequest,
  RemoveInstanceMemberResponse,
} from '../../proto/instance/v2/instance_service';
import {
  objectDetailsToDetailsProto,
  setupInstanceRequestToCommand,
  setupResultToResponse,
  protoToFeatureConfig,
  instanceStateToProto,
} from './converters';
import { throwInvalidArgument } from '../../../../lib/zerrors/errors';

/**
 * Instance Service
 */
export class InstanceService {
  private readonly instanceQueries: InstanceQueries;
  private readonly memberQueries: InstanceMemberQueries;
  
  constructor(
    private readonly commands: Commands,
    pool: DatabasePool
  ) {
    this.instanceQueries = new InstanceQueries(pool);
    this.memberQueries = new InstanceMemberQueries(pool);
  }

  /**
   * SetupInstance - Create a new instance with default organization and admin
   */
  async setupInstance(
    ctx: Context,
    request: SetupInstanceRequest
  ): Promise<SetupInstanceResponse> {
    // Validate request
    if (!request.instanceName || request.instanceName.trim().length === 0) {
      throwInvalidArgument('instance name is required', 'INSTv2-001');
    }
    
    if (!request.defaultOrgName || request.defaultOrgName.trim().length === 0) {
      throwInvalidArgument('default organization name is required', 'INSTv2-002');
    }

    if (!request.adminUser) {
      throwInvalidArgument('admin user is required', 'INSTv2-003');
    }

    if (!request.adminUser.username || !request.adminUser.email) {
      throwInvalidArgument('admin user username and email are required', 'INSTv2-004');
    }

    // Convert request to command
    const setupData = setupInstanceRequestToCommand(request);

    // Execute command
    const result = await this.commands.setupInstance(ctx, setupData);

    // Convert response
    return setupResultToResponse(result);
  }

  /**
   * GetInstance - Retrieve instance by ID
   */
  async getInstance(
    _ctx: Context,
    request: GetInstanceRequest
  ): Promise<GetInstanceResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-005');
    }

    // Query instance from database
    const instance = await this.instanceQueries.getInstanceByID(request.instanceId);
    
    if (!instance) {
      throwInvalidArgument('instance not found', 'INSTv2-024');
    }

    return {
      instance: {
        id: instance.id,
        details: {
          sequence: instance.sequence,
          changeDate: instance.updatedAt,
          resourceOwner: instance.id,
        },
        state: instanceStateToProto(instance.state),
        name: instance.name,
        version: '1.0.0',
        domains: instance.domains.map(d => ({
          domain: d.domain,
          details: {
            sequence: d.sequence,
            changeDate: d.updatedAt,
            resourceOwner: instance.id,
          },
          isGenerated: d.isGenerated,
          isPrimary: d.isPrimary,
        })),
      },
    };
  }

  /**
   * RemoveInstance - Delete an instance (destructive operation)
   */
  async removeInstance(
    ctx: Context,
    request: RemoveInstanceRequest
  ): Promise<RemoveInstanceResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-006');
    }

    // Execute command
    const details = await this.commands.removeInstance(ctx, request.instanceId);

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * AddInstanceDomain - Add a new domain to the instance
   */
  async addInstanceDomain(
    ctx: Context,
    request: AddInstanceDomainRequest
  ): Promise<AddInstanceDomainResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-007');
    }

    if (!request.domain || request.domain.trim().length === 0) {
      throwInvalidArgument('domain is required', 'INSTv2-008');
    }

    // Execute command
    const details = await this.commands.addInstanceDomain(
      ctx,
      request.instanceId,
      {
        domain: request.domain,
        isGenerated: request.isGenerated || false,
      }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * SetDefaultInstanceDomain - Set the default domain for the instance
   */
  async setDefaultInstanceDomain(
    ctx: Context,
    request: SetDefaultInstanceDomainRequest
  ): Promise<SetDefaultInstanceDomainResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-009');
    }

    if (!request.domain || request.domain.trim().length === 0) {
      throwInvalidArgument('domain is required', 'INSTv2-010');
    }

    // Execute command
    const details = await this.commands.setDefaultInstanceDomain(
      ctx,
      request.instanceId,
      request.domain
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveInstanceDomain - Remove a domain from the instance
   */
  async removeInstanceDomain(
    ctx: Context,
    request: RemoveInstanceDomainRequest
  ): Promise<RemoveInstanceDomainResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-011');
    }

    if (!request.domain || request.domain.trim().length === 0) {
      throwInvalidArgument('domain is required', 'INSTv2-012');
    }

    // Execute command
    const details = await this.commands.removeInstanceDomain(
      ctx,
      request.instanceId,
      request.domain
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * SetInstanceFeatures - Configure instance feature flags
   */
  async setInstanceFeatures(
    ctx: Context,
    request: SetInstanceFeaturesRequest
  ): Promise<SetInstanceFeaturesResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-013');
    }

    // Convert features to command format
    const features = protoToFeatureConfig(request);

    // Execute command
    const details = await this.commands.setInstanceFeatures(
      ctx,
      request.instanceId,
      features
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * GetInstanceFeatures - Retrieve instance feature flags
   */
  async getInstanceFeatures(
    _ctx: Context,
    request: GetInstanceFeaturesRequest
  ): Promise<GetInstanceFeaturesResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-014');
    }

    // Query features from database
    const features = await this.instanceQueries.getInstanceFeatures(request.instanceId);
    
    if (!features) {
      throwInvalidArgument('instance not found', 'INSTv2-025');
    }

    return {
      features: {
        loginDefaultOrg: Boolean(features.loginDefaultOrg),
        triggerIntrospectionProjections: Boolean(features.triggerIntrospectionProjections),
        legacyIntrospection: Boolean(features.legacyIntrospection),
        userSchema: Boolean(features.userSchema),
        tokenExchange: Boolean(features.tokenExchange),
        actions: Boolean(features.actions),
        improvedPerformance: Boolean(features.improvedPerformance),
      },
    };
  }

  /**
   * ResetInstanceFeatures - Reset all features to defaults
   */
  async resetInstanceFeatures(
    ctx: Context,
    request: ResetInstanceFeaturesRequest
  ): Promise<ResetInstanceFeaturesResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-015');
    }

    // Execute command
    const details = await this.commands.resetInstanceFeatures(ctx, request.instanceId);

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * AddInstanceMember - Add a member to the instance with roles
   */
  async addInstanceMember(
    ctx: Context,
    request: AddInstanceMemberRequest
  ): Promise<AddInstanceMemberResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-016');
    }

    if (!request.userId || request.userId.trim().length === 0) {
      throwInvalidArgument('user ID is required', 'INSTv2-017');
    }

    if (!request.roles || request.roles.length === 0) {
      throwInvalidArgument('at least one role is required', 'INSTv2-018');
    }

    // Execute command
    const details = await this.commands.addInstanceMember(
      ctx,
      request.instanceId,
      request.userId,
      request.roles
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * UpdateInstanceMember - Update member roles
   */
  async updateInstanceMember(
    ctx: Context,
    request: UpdateInstanceMemberRequest
  ): Promise<UpdateInstanceMemberResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-019');
    }

    if (!request.userId || request.userId.trim().length === 0) {
      throwInvalidArgument('user ID is required', 'INSTv2-020');
    }

    if (!request.roles || request.roles.length === 0) {
      throwInvalidArgument('at least one role is required', 'INSTv2-021');
    }

    // Execute command
    const details = await this.commands.changeInstanceMember(
      ctx,
      request.instanceId,
      request.userId,
      request.roles
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveInstanceMember - Remove a member from the instance
   */
  async removeInstanceMember(
    ctx: Context,
    request: RemoveInstanceMemberRequest
  ): Promise<RemoveInstanceMemberResponse> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-022');
    }

    if (!request.userId || request.userId.trim().length === 0) {
      throwInvalidArgument('user ID is required', 'INSTv2-023');
    }

    // Execute command
    const details = await this.commands.removeInstanceMember(
      ctx,
      request.instanceId,
      request.userId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * ListInstances - List all instances with filters
   */
  async listInstances(
    _ctx: Context,
    request: { query?: any; queries?: any[] }
  ): Promise<any> {
    // Query instances from database
    const result = await this.instanceQueries.searchInstances({
      limit: request.query?.limit || 50,
      offset: request.query?.offset || 0,
    });

    return {
      details: {
        totalResult: result.total,
        processedSequence: 0,
        timestamp: new Date(),
      },
      result: result.instances.map(i => ({
        id: i.id,
        details: {
          sequence: i.sequence,
          changeDate: i.updatedAt,
          resourceOwner: i.id,
        },
        state: instanceStateToProto(i.state),
        name: i.name,
        version: '1.0.0',
        domains: i.domains.map(d => ({
          domain: d.domain,
          details: {
            sequence: d.sequence,
            changeDate: d.updatedAt,
            resourceOwner: i.id,
          },
          isGenerated: d.isGenerated,
          isPrimary: d.isPrimary,
        })),
      })),
    };
  }

  /**
   * ListInstanceDomains - List all domains for an instance
   */
  async listInstanceDomains(
    _ctx: Context,
    request: { instanceId: string; query?: any }
  ): Promise<any> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-026');
    }

    // Query domains from database
    const result = await this.instanceQueries.searchInstanceDomains({
      instanceID: request.instanceId,
      limit: request.query?.limit || 50,
      offset: request.query?.offset || 0,
    });

    return {
      details: {
        totalResult: result.total,
        processedSequence: 0,
        timestamp: new Date(),
      },
      result: result.domains.map(d => ({
        domain: d.domain,
        details: {
          sequence: d.sequence,
          changeDate: d.updatedAt,
          resourceOwner: request.instanceId,
        },
        isGenerated: d.isGenerated,
        isPrimary: d.isPrimary,
      })),
    };
  }

  /**
   * ListInstanceMembers - List all members for an instance
   */
  async listInstanceMembers(
    _ctx: Context,
    request: { instanceId: string; query?: any }
  ): Promise<any> {
    // Validate request
    if (!request.instanceId || request.instanceId.trim().length === 0) {
      throwInvalidArgument('instance ID is required', 'INSTv2-027');
    }

    // Query members from database
    const result = await this.memberQueries.searchIAMMembers({
      instanceID: request.instanceId,
      limit: request.query?.limit || 50,
      offset: request.query?.offset || 0,
    });

    return {
      details: {
        totalResult: result.totalCount,
        processedSequence: 0,
        timestamp: new Date(),
      },
      result: result.members.map(m => ({
        userId: m.userID,
        details: {
          sequence: Number(m.sequence),
          changeDate: m.changeDate,
          resourceOwner: m.resourceOwner,
        },
        roles: m.roles,
        displayName: m.displayName || '',
        email: m.email || '',
      })),
    };
  }
}
