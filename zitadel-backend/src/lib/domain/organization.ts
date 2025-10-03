/**
 * Organization domain models
 */

export enum OrgState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
}

export interface Organization {
  id: string;
  name: string;
  state: OrgState;
  primaryDomain?: string;
  createdAt: Date;
  changedAt: Date;
  sequence: number;
}

export interface OrgDomain {
  orgId: string;
  domain: string;
  isPrimary: boolean;
  isVerified: boolean;
  validationType: DomainValidationType;
  validationCode?: string;
  createdAt: Date;
  changedAt: Date;
}

export enum DomainValidationType {
  UNSPECIFIED = 0,
  HTTP = 1,
  DNS = 2,
}

/**
 * Check if organization is active
 */
export function isOrgActive(state: OrgState): boolean {
  return state === OrgState.ACTIVE;
}

/**
 * Check if domain is verified
 */
export function isDomainVerified(domain: OrgDomain): boolean {
  return domain.isVerified;
}
