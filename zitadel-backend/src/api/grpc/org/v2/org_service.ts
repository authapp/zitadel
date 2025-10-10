/**
 * Organization Service Implementation (v2)
 * 
 * gRPC service handlers for organization management
 * Based on: internal/api/grpc/org/v2/org.go
 */

import { Commands } from '@/lib/command/commands';
import { Context } from '@/lib/command/context';
import { 
  AddOrganizationRequest, 
  AddOrganizationResponse,
  ListOrganizationsRequest,
  ListOrganizationsResponse,
  GetOrganizationRequest,
  GetOrganizationResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationResponse,
  DeactivateOrganizationRequest,
  DeactivateOrganizationResponse,
  ReactivateOrganizationRequest,
  ReactivateOrganizationResponse,
  RemoveOrganizationRequest,
  RemoveOrganizationResponse,
} from '../../proto/org/v2/org_service';
import { 
  addOrganizationRequestToCommand,
  createdOrgToAddOrganizationResponse,
  objectDetailsToDetailsProto,
} from './converters';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Organization Service
 */
export class OrganizationService {
  constructor(
    private readonly commands: Commands
  ) {}

  /**
   * AddOrganization - Create a new organization with admins
   */
  async addOrganization(
    ctx: Context,
    request: AddOrganizationRequest
  ): Promise<AddOrganizationResponse> {
    // Validate request
    if (!request.name || request.name.trim().length === 0) {
      throwInvalidArgument('name is required', 'ORGv2-001');
    }
    
    if (request.name.length > 200) {
      throwInvalidArgument('name must be at most 200 characters', 'ORGv2-002');
    }

    // Convert request to command
    const orgSetup = addOrganizationRequestToCommand(request);

    // Execute command
    const createdOrg = await this.commands.setupOrg(ctx, orgSetup);

    // Convert response
    return createdOrgToAddOrganizationResponse(createdOrg);
  }

  /**
   * ListOrganizations - Search for organizations
   */
  async listOrganizations(
    _ctx: Context,
    request: ListOrganizationsRequest
  ): Promise<ListOrganizationsResponse> {
    // TODO: Implement query layer integration
    // For now, return empty result
    return {
      details: {
        totalResult: 0,
        processedSequence: 0,
        timestamp: new Date(),
      },
      sortingColumn: request.sortingColumn,
      result: [],
    };
  }

  /**
   * GetOrganization - Get organization by ID
   */
  async getOrganization(
    _ctx: Context,
    _request: GetOrganizationRequest
  ): Promise<GetOrganizationResponse> {
    // TODO: Implement query layer integration
    throw new Error('Not implemented - requires query layer');
  }

  /**
   * UpdateOrganization - Update organization name
   */
  async updateOrganization(
    ctx: Context,
    request: UpdateOrganizationRequest
  ): Promise<UpdateOrganizationResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-010');
    }

    if (!request.name || request.name.trim().length === 0) {
      throwInvalidArgument('name is required', 'ORGv2-011');
    }

    const details = await this.commands.changeOrg(
      ctx,
      request.organizationId,
      { name: request.name }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * DeactivateOrganization - Deactivate an organization
   */
  async deactivateOrganization(
    ctx: Context,
    request: DeactivateOrganizationRequest
  ): Promise<DeactivateOrganizationResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-020');
    }

    const details = await this.commands.deactivateOrg(
      ctx,
      request.organizationId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * ReactivateOrganization - Reactivate an organization
   */
  async reactivateOrganization(
    ctx: Context,
    request: ReactivateOrganizationRequest
  ): Promise<ReactivateOrganizationResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-030');
    }

    const details = await this.commands.reactivateOrg(
      ctx,
      request.organizationId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveOrganization - Remove/delete an organization
   */
  async removeOrganization(
    ctx: Context,
    request: RemoveOrganizationRequest
  ): Promise<RemoveOrganizationResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-040');
    }

    const details = await this.commands.removeOrg(
      ctx,
      request.organizationId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }
}
