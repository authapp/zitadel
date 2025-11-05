import { ObjectDetails, OrgState } from './common';

export interface Organization {
  id: string;
  state: OrgState;
  name: string;
  primaryDomain: string;
  details: ObjectDetails;
}

export interface AddOrganizationRequest {
  name: string;
  admins?: {
    userId: string;
    roles: string[];
  }[];
}

export interface UpdateOrganizationRequest {
  organizationId: string;
  name: string;
}

export interface AddOrganizationDomainRequest {
  organizationId: string;
  domain: string;
}

export interface AddOrganizationMemberRequest {
  organizationId: string;
  userId: string;
  roles: string[];
}

export interface UpdateOrganizationMemberRequest {
  organizationId: string;
  userId: string;
  roles: string[];
}

export interface AddOrganizationResponse {
  organizationId: string;
  details: ObjectDetails;
}

export interface GetOrganizationByIdResponse {
  organization: Organization;
}

export interface ListOrganizationsResponse {
  details: {
    totalResult: string;
    processedSequence: string;
    viewTimestamp: string;
  };
  result: Organization[];
}
