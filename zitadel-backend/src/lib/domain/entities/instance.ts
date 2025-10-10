/**
 * Instance Domain Entity
 * 
 * Multi-tenant root entity
 */

import { ObjectRoot, Stateful } from '../types';
import { DomainName } from '../value-objects';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Instance state
 */
export enum InstanceState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  REMOVED = 2,
}

/**
 * Instance entity
 */
export class Instance implements ObjectRoot, Stateful<InstanceState> {
  public domains: InstanceDomain[] = [];
  public members: InstanceMember[] = [];

  constructor(
    public aggregateID: string,
    public resourceOwner: string,
    public name: string,
    public state: InstanceState,
    public defaultOrgID?: string,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throwInvalidArgument('Instance name is required', 'INSTANCE-001');
    }
  }

  isValid(): boolean {
    return !!this.name && this.name.trim().length > 0;
  }

  exists(): boolean {
    return this.state !== InstanceState.UNSPECIFIED && this.state !== InstanceState.REMOVED;
  }

  /**
   * Add domain to instance
   */
  addDomain(domain: InstanceDomain): void {
    if (this.domains.some(d => d.domain === domain.domain)) {
      throwInvalidArgument('Domain already exists', 'INSTANCE-002');
    }
    this.domains.push(domain);
  }

  /**
   * Get primary domain
   */
  getPrimaryDomain(): InstanceDomain | undefined {
    return this.domains.find(d => d.isPrimary);
  }

  /**
   * Set primary domain
   */
  setPrimaryDomain(domain: string): void {
    const domainObj = this.domains.find(d => d.domain === domain);
    if (!domainObj) {
      throwInvalidArgument('Domain not found', 'INSTANCE-003');
    }
    
    // Remove primary from all domains
    this.domains.forEach(d => d.isPrimary = false);
    
    // Set new primary
    domainObj.isPrimary = true;
  }
}

/**
 * Instance domain
 */
export class InstanceDomain {
  constructor(
    public instanceID: string,
    public domain: string,
    public isGenerated: boolean = false,
    public isPrimary: boolean = false,
    public creationDate?: Date,
    public changeDate?: Date
  ) {
    this.validate();
  }

  private validate(): void {
    const domainName = new DomainName(this.domain);
    this.domain = domainName.normalize().domain;
  }
}

/**
 * Instance member
 */
export class InstanceMember {
  constructor(
    public instanceID: string,
    public userID: string,
    public roles: string[],
    public creationDate?: Date,
    public changeDate?: Date
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.userID) {
      throwInvalidArgument('User ID is required', 'INSTANCE-MEMBER-001');
    }
    if (!this.roles || this.roles.length === 0) {
      throwInvalidArgument('At least one role is required', 'INSTANCE-MEMBER-002');
    }
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }
}

/**
 * Helper functions
 */
export function isInstanceStateValid(state: InstanceState): boolean {
  return state >= InstanceState.UNSPECIFIED && state <= InstanceState.REMOVED;
}

export function isInstanceStateExists(state: InstanceState): boolean {
  return state !== InstanceState.UNSPECIFIED && state !== InstanceState.REMOVED;
}

/**
 * Instance constants
 */
export const INSTANCE_ID = 'IAM';
export const SYSTEM_USER = 'SYSTEM';
