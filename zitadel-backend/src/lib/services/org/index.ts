/**
 * Organization service module
 */

export * from './types';
export * from './org-service';

export type {
  OrgService,
  CreateOrgRequest,
  UpdateOrgRequest,
  AddMemberRequest,
  OrgSearchFilters,
  OrgListOptions,
} from './types';

export {
  OrgServiceError,
  OrgNotFoundError,
  OrgAlreadyExistsError,
} from './types';

export {
  DefaultOrgService,
  createOrgService,
} from './org-service';
