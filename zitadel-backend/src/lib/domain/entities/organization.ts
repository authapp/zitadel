/**
 * Organization Domain Entity
 * 
 * Complete organization entity with all properties and business logic
 */

import { ObjectRoot, Stateful } from '../types';
import { DomainName } from '../value-objects';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Organization state
 */
export enum OrgState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  REMOVED = 3,
}

/**
 * Organization entity
 */
export class Organization implements ObjectRoot, Stateful<OrgState> {
  constructor(
    public aggregateID: string,
    public resourceOwner: string,
    public name: string,
    public state: OrgState,
    public primaryDomain?: string,
    public domains: OrgDomain[] = [],
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {}

  /**
   * Validate organization
   */
  isValid(): boolean {
    if (!this.name || this.name.trim().length === 0) {
      return false;
    }
    return this.name.trim().length > 0 && this.name.length <= 200;
  }

  /**
   * Check if organization exists
   */
  exists(): boolean {
    return this.state !== OrgState.UNSPECIFIED && this.state !== OrgState.REMOVED;
  }

  /**
   * Check if organization is active
   */
  isActive(): boolean {
    return this.state === OrgState.ACTIVE;
  }

  /**
   * Add IAM domain to organization
   */
  addIAMDomain(iamDomain: string): void {
    const orgDomain = this.generateIAMDomain(iamDomain);
    this.domains.push(orgDomain);
    if (!this.primaryDomain) {
      this.primaryDomain = orgDomain.domain;
    }
  }

  /**
   * Generate IAM domain name from org name
   */
  private generateIAMDomain(iamDomain: string): OrgDomain {
    // Convert org name to valid domain label
    let label = this.name.toLowerCase()
      .replace(/\s+/g, '-')  // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '')  // Remove invalid characters
      .substring(0, 63);  // Max 63 characters per label
    
    // Remove leading/trailing hyphens
    label = label.replace(/^-+|-+$/g, '');
    
    if (label.length === 0) {
      label = 'org';
    }
    
    const domain = `${label}.${iamDomain}`;
    
    return new OrgDomain(
      this.aggregateID,
      domain,
      true,  // is primary
      true,  // is verified (IAM domains are auto-verified)
      DomainValidationType.HTTP
    );
  }

  /**
   * Get primary domain or generate one
   */
  getPrimaryDomain(): string {
    if (this.primaryDomain) {
      return this.primaryDomain;
    }
    
    const primaryDomainObj = this.domains.find(d => d.isPrimary);
    if (primaryDomainObj) {
      return primaryDomainObj.domain;
    }
    
    throwInvalidArgument('Organization has no primary domain', 'ORG-001');
  }

  /**
   * Set primary domain
   */
  setPrimaryDomain(domain: string): void {
    const domainObj = this.domains.find(d => d.domain === domain);
    if (!domainObj) {
      throwInvalidArgument('Domain not found in organization', 'ORG-002');
    }
    
    if (!domainObj.isVerified) {
      throwInvalidArgument('Domain must be verified to set as primary', 'ORG-003');
    }
    
    // Remove primary from all domains
    this.domains.forEach(d => d.isPrimary = false);
    
    // Set new primary
    domainObj.isPrimary = true;
    this.primaryDomain = domain;
  }
}

/**
 * Domain validation type
 */
export enum DomainValidationType {
  UNSPECIFIED = 0,
  HTTP = 1,
  DNS = 2,
}

/**
 * Organization domain
 */
export class OrgDomain {
  public validationCode?: string;
  public creationDate?: Date;
  public changeDate?: Date;

  constructor(
    public orgID: string,
    public domain: string,
    public isPrimary: boolean = false,
    public isVerified: boolean = false,
    public validationType: DomainValidationType = DomainValidationType.HTTP
  ) {
    this.validate();
  }

  /**
   * Validate domain
   */
  private validate(): void {
    if (!this.domain || this.domain.trim().length === 0) {
      throwInvalidArgument('Domain cannot be empty', 'ORG-DOMAIN-001');
    }
    
    // Validate domain format
    const domainName = new DomainName(this.domain);
    this.domain = domainName.normalize().domain;
  }

  /**
   * Generate verification code
   */
  generateVerificationCode(): string {
    // Generate random verification code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 32; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.validationCode = code;
    return code;
  }

  /**
   * Verify domain with code
   */
  verify(code: string): boolean {
    if (!this.validationCode) {
      return false;
    }
    
    if (this.validationCode === code) {
      this.isVerified = true;
      return true;
    }
    
    return false;
  }
}

/**
 * Organization member
 */
export class OrgMember {
  constructor(
    public orgID: string,
    public userID: string,
    public roles: string[],
    public creationDate?: Date,
    public changeDate?: Date
  ) {
    this.validate();
  }

  /**
   * Validate member
   */
  private validate(): void {
    if (!this.orgID) {
      throwInvalidArgument('Organization ID is required', 'ORG-MEMBER-001');
    }
    if (!this.userID) {
      throwInvalidArgument('User ID is required', 'ORG-MEMBER-002');
    }
    if (!this.roles || this.roles.length === 0) {
      throwInvalidArgument('At least one role is required', 'ORG-MEMBER-003');
    }
  }

  /**
   * Check if member has role
   */
  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  /**
   * Add role to member
   */
  addRole(role: string): void {
    if (!this.roles.includes(role)) {
      this.roles.push(role);
    }
  }

  /**
   * Remove role from member
   */
  removeRole(role: string): void {
    const index = this.roles.indexOf(role);
    if (index > -1) {
      this.roles.splice(index, 1);
    }
  }
}

/**
 * Helper functions
 */
export function isOrgStateValid(state: OrgState): boolean {
  return state > OrgState.UNSPECIFIED && state <= OrgState.REMOVED;
}

export function isOrgStateExists(state: OrgState): boolean {
  return state !== OrgState.UNSPECIFIED && state !== OrgState.REMOVED;
}
