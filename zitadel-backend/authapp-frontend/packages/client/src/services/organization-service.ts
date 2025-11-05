import { HttpClient } from '../lib/http-client';
import {
  AddOrganizationRequest,
  AddOrganizationResponse,
  AddOrganizationDomainRequest,
  AddOrganizationMemberRequest,
  GetOrganizationByIdResponse,
  ListOrganizationsResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationMemberRequest,
} from '../types/organization';
import { ObjectDetails } from '../types/common';

export class OrganizationService {
  constructor(private client: HttpClient) {}

  /**
   * Get organization by ID
   */
  async getOrganizationById(organizationId: string): Promise<GetOrganizationByIdResponse> {
    return this.client.post('/zitadel.org.v2.OrganizationService/GetOrganizationByID', {
      organizationId,
    });
  }

  /**
   * List organizations
   */
  async listOrganizations(request: {
    query?: { offset?: number; limit?: number; asc?: boolean };
  } = {}): Promise<ListOrganizationsResponse> {
    return this.client.post('/zitadel.org.v2.OrganizationService/ListOrganizations', request);
  }

  /**
   * Add organization
   */
  async addOrganization(request: AddOrganizationRequest): Promise<AddOrganizationResponse> {
    return this.client.post('/zitadel.org.v2.OrganizationService/AddOrganization', request);
  }

  /**
   * Update organization
   */
  async updateOrganization(
    request: UpdateOrganizationRequest
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/UpdateOrganization', request);
  }

  /**
   * Deactivate organization
   */
  async deactivateOrganization(organizationId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/DeactivateOrganization', {
      organizationId,
    });
  }

  /**
   * Reactivate organization
   */
  async reactivateOrganization(organizationId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/ReactivateOrganization', {
      organizationId,
    });
  }

  /**
   * Remove organization
   */
  async removeOrganization(organizationId: string): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/RemoveOrganization', {
      organizationId,
    });
  }

  /**
   * Add organization domain
   */
  async addOrganizationDomain(
    request: AddOrganizationDomainRequest
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/AddOrganizationDomain', request);
  }

  /**
   * Verify organization domain
   */
  async verifyOrganizationDomain(
    organizationId: string,
    domain: string,
    validationCode: string
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/VerifyOrganizationDomain', {
      organizationId,
      domain,
      validationCode,
    });
  }

  /**
   * Set primary organization domain
   */
  async setPrimaryOrganizationDomain(
    organizationId: string,
    domain: string
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/SetPrimaryOrganizationDomain', {
      organizationId,
      domain,
    });
  }

  /**
   * Remove organization domain
   */
  async removeOrganizationDomain(
    organizationId: string,
    domain: string
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/RemoveOrganizationDomain', {
      organizationId,
      domain,
    });
  }

  /**
   * Add organization member
   */
  async addOrganizationMember(
    request: AddOrganizationMemberRequest
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/AddOrganizationMember', request);
  }

  /**
   * Update organization member
   */
  async updateOrganizationMember(
    request: UpdateOrganizationMemberRequest
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post(
      '/zitadel.org.v2.OrganizationService/UpdateOrganizationMember',
      request
    );
  }

  /**
   * Remove organization member
   */
  async removeOrganizationMember(
    organizationId: string,
    userId: string
  ): Promise<{ details: ObjectDetails }> {
    return this.client.post('/zitadel.org.v2.OrganizationService/RemoveOrganizationMember', {
      organizationId,
      userId,
    });
  }
}
