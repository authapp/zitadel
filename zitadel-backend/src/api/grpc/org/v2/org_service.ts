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
  AddOrganizationDomainRequest,
  AddOrganizationDomainResponse,
  VerifyOrganizationDomainRequest,
  VerifyOrganizationDomainResponse,
  SetPrimaryOrganizationDomainRequest,
  SetPrimaryOrganizationDomainResponse,
  RemoveOrganizationDomainRequest,
  RemoveOrganizationDomainResponse,
  GenerateDomainValidationRequest,
  GenerateDomainValidationResponse,
  AddOrganizationMemberRequest,
  AddOrganizationMemberResponse,
  UpdateOrganizationMemberRequest,
  UpdateOrganizationMemberResponse,
  RemoveOrganizationMemberRequest,
  RemoveOrganizationMemberResponse,
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

  // ====================================================================
  // DOMAIN MANAGEMENT
  // ====================================================================

  /**
   * AddOrganizationDomain - Add a new domain to the organization
   */
  async addOrganizationDomain(
    ctx: Context,
    request: AddOrganizationDomainRequest
  ): Promise<AddOrganizationDomainResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-050');
    }
    if (!request.domain) {
      throwInvalidArgument('domain is required', 'ORGv2-051');
    }

    const details = await this.commands.addDomain(
      ctx,
      request.organizationId,
      { domain: request.domain }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * VerifyOrganizationDomain - Verify domain ownership
   */
  async verifyOrganizationDomain(
    ctx: Context,
    request: VerifyOrganizationDomainRequest
  ): Promise<VerifyOrganizationDomainResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-060');
    }
    if (!request.domain) {
      throwInvalidArgument('domain is required', 'ORGv2-061');
    }
    if (!request.validationCode) {
      throwInvalidArgument('validationCode is required', 'ORGv2-062');
    }

    const details = await this.commands.validateOrgDomain(
      ctx,
      request.organizationId,
      request.domain,
      { validationCode: request.validationCode }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * SetPrimaryOrganizationDomain - Set a domain as primary
   */
  async setPrimaryOrganizationDomain(
    ctx: Context,
    request: SetPrimaryOrganizationDomainRequest
  ): Promise<SetPrimaryOrganizationDomainResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-070');
    }
    if (!request.domain) {
      throwInvalidArgument('domain is required', 'ORGv2-071');
    }

    const details = await this.commands.setPrimaryDomain(
      ctx,
      request.organizationId,
      request.domain
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveOrganizationDomain - Remove a domain from organization
   */
  async removeOrganizationDomain(
    ctx: Context,
    request: RemoveOrganizationDomainRequest
  ): Promise<RemoveOrganizationDomainResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-080');
    }
    if (!request.domain) {
      throwInvalidArgument('domain is required', 'ORGv2-081');
    }

    const details = await this.commands.removeDomain(
      ctx,
      request.organizationId,
      request.domain
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * GenerateDomainValidation - Generate domain validation token
   */
  async generateDomainValidation(
    ctx: Context,
    request: GenerateDomainValidationRequest
  ): Promise<GenerateDomainValidationResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-090');
    }
    if (!request.domain) {
      throwInvalidArgument('domain is required', 'ORGv2-091');
    }

    const result = await this.commands.generateDomainValidation(
      ctx,
      request.organizationId,
      request.domain,
      (request.type === 'DNS_TXT' || request.type === 'DNS') ? 'DNS' : 'HTTP'
    );

    return {
      validationToken: result.validationCode,
      validationUrl: result.url || '',
    };
  }

  // ====================================================================
  // MEMBER MANAGEMENT
  // ====================================================================

  /**
   * AddOrganizationMember - Add a member to the organization
   */
  async addOrganizationMember(
    ctx: Context,
    request: AddOrganizationMemberRequest
  ): Promise<AddOrganizationMemberResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-100');
    }
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'ORGv2-101');
    }
    if (!request.roles || request.roles.length === 0) {
      throwInvalidArgument('at least one role is required', 'ORGv2-102');
    }

    const details = await this.commands.addOrgMember(
      ctx,
      request.organizationId,
      {
        userID: request.userId,
        roles: request.roles
      }
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * UpdateOrganizationMember - Update member roles
   */
  async updateOrganizationMember(
    ctx: Context,
    request: UpdateOrganizationMemberRequest
  ): Promise<UpdateOrganizationMemberResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-110');
    }
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'ORGv2-111');
    }
    if (!request.roles || request.roles.length === 0) {
      throwInvalidArgument('at least one role is required', 'ORGv2-112');
    }

    const details = await this.commands.changeOrgMember(
      ctx,
      request.organizationId,
      request.userId,
      request.roles
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }

  /**
   * RemoveOrganizationMember - Remove a member from organization
   */
  async removeOrganizationMember(
    ctx: Context,
    request: RemoveOrganizationMemberRequest
  ): Promise<RemoveOrganizationMemberResponse> {
    if (!request.organizationId) {
      throwInvalidArgument('organizationId is required', 'ORGv2-120');
    }
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'ORGv2-121');
    }

    const details = await this.commands.removeOrgMember(
      ctx,
      request.organizationId,
      request.userId
    );

    return {
      details: objectDetailsToDetailsProto(details),
    };
  }
}
