/**
 * Project Domain Entity
 * 
 * Complete project entity with roles and grants
 */

import { ObjectRoot, Stateful } from '../types';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * Project state
 */
export enum ProjectState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  REMOVED = 3,
}

/**
 * Private labeling setting
 */
export enum PrivateLabelingSetting {
  UNSPECIFIED = 0,
  ENFORCE_PROJECT_RESOURCE_OWNER_POLICY = 1,
  ALLOW_LOGIN_USER_RESOURCE_OWNER_POLICY = 2,
}

/**
 * Project entity
 */
export class Project implements ObjectRoot, Stateful<ProjectState> {
  public roles: ProjectRole[] = [];
  public grants: ProjectGrant[] = [];
  public members: ProjectMember[] = [];

  constructor(
    public aggregateID: string,
    public resourceOwner: string,
    public name: string,
    public state: ProjectState,
    public projectRoleAssertion: boolean = false,
    public projectRoleCheck: boolean = false,
    public hasProjectCheck: boolean = false,
    public privateLabelingSetting: PrivateLabelingSetting = PrivateLabelingSetting.UNSPECIFIED,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  /**
   * Validate project
   */
  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throwInvalidArgument('Project name is required', 'PROJECT-001');
    }
    
    if (this.name.length > 200) {
      throwInvalidArgument('Project name too long (max 200)', 'PROJECT-002');
    }
  }

  isValid(): boolean {
    return !!this.name && this.name.trim().length > 0;
  }

  exists(): boolean {
    return this.state !== ProjectState.UNSPECIFIED && this.state !== ProjectState.REMOVED;
  }

  /**
   * Add role to project
   */
  addRole(role: ProjectRole): void {
    if (this.roles.some(r => r.key === role.key)) {
      throwInvalidArgument('Role key already exists', 'PROJECT-003');
    }
    this.roles.push(role);
  }

  /**
   * Remove role from project
   */
  removeRole(roleKey: string): void {
    const index = this.roles.findIndex(r => r.key === roleKey);
    if (index > -1) {
      this.roles.splice(index, 1);
    }
  }

  /**
   * Get role by key
   */
  getRole(roleKey: string): ProjectRole | undefined {
    return this.roles.find(r => r.key === roleKey);
  }

  /**
   * Get all role keys
   */
  getRoleKeys(): string[] {
    return this.roles.map(r => r.key);
  }

  /**
   * Validate role keys
   */
  validateRoleKeys(roleKeys: string[]): boolean {
    const validKeys = this.getRoleKeys();
    return roleKeys.every(key => validKeys.includes(key));
  }
}

/**
 * Project role
 */
export class ProjectRole {
  constructor(
    public projectID: string,
    public key: string,
    public displayName: string,
    public group?: string,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  /**
   * Validate role
   */
  private validate(): void {
    if (!this.key || this.key.trim().length === 0) {
      throwInvalidArgument('Role key is required', 'PROJECT-ROLE-001');
    }
    
    if (!this.displayName || this.displayName.trim().length === 0) {
      throwInvalidArgument('Role display name is required', 'PROJECT-ROLE-002');
    }
    
    // Role key format validation (uppercase with underscores)
    const roleKeyRegex = /^[A-Z][A-Z0-9_]*$/;
    if (!roleKeyRegex.test(this.key)) {
      throwInvalidArgument(
        'Role key must be uppercase with underscores',
        'PROJECT-ROLE-003'
      );
    }
  }

  /**
   * Check if role belongs to group
   */
  belongsToGroup(group: string): boolean {
    return this.group === group;
  }
}

/**
 * Project grant (cross-org project sharing)
 */
export class ProjectGrant {
  constructor(
    public grantID: string,
    public projectID: string,
    public grantedOrgID: string,
    public roleKeys: string[],
    public state: ProjectGrantState = ProjectGrantState.ACTIVE,
    public creationDate?: Date,
    public changeDate?: Date,
    public sequence?: bigint
  ) {
    this.validate();
  }

  /**
   * Validate grant
   */
  private validate(): void {
    if (!this.projectID) {
      throwInvalidArgument('Project ID is required', 'PROJECT-GRANT-001');
    }
    if (!this.grantedOrgID) {
      throwInvalidArgument('Granted organization ID is required', 'PROJECT-GRANT-002');
    }
    if (!this.roleKeys || this.roleKeys.length === 0) {
      throwInvalidArgument('At least one role is required', 'PROJECT-GRANT-003');
    }
  }

  /**
   * Check if grant is valid
   */
  isValid(): boolean {
    return (
      !!this.projectID &&
      !!this.grantedOrgID &&
      this.roleKeys.length > 0
    );
  }

  /**
   * Check if grant exists
   */
  exists(): boolean {
    return (
      this.state !== ProjectGrantState.UNSPECIFIED &&
      this.state !== ProjectGrantState.REMOVED
    );
  }

  /**
   * Check if grant has role
   */
  hasRole(roleKey: string): boolean {
    return this.roleKeys.includes(roleKey);
  }
}

/**
 * Project grant state
 */
export enum ProjectGrantState {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  INACTIVE = 2,
  REMOVED = 3,
}

/**
 * Project member
 */
export class ProjectMember {
  constructor(
    public projectID: string,
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
    if (!this.projectID) {
      throwInvalidArgument('Project ID is required', 'PROJECT-MEMBER-001');
    }
    if (!this.userID) {
      throwInvalidArgument('User ID is required', 'PROJECT-MEMBER-002');
    }
    if (!this.roles || this.roles.length === 0) {
      throwInvalidArgument('At least one role is required', 'PROJECT-MEMBER-003');
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
 * Project grant member
 */
export class ProjectGrantMember {
  constructor(
    public projectID: string,
    public grantID: string,
    public userID: string,
    public roles: string[],
    public creationDate?: Date,
    public changeDate?: Date
  ) {}
}

/**
 * Helper functions
 */
export function isProjectStateValid(state: ProjectState): boolean {
  return state > ProjectState.UNSPECIFIED && state <= ProjectState.REMOVED;
}

export function isProjectStateExists(state: ProjectState): boolean {
  return state !== ProjectState.UNSPECIFIED && state !== ProjectState.REMOVED;
}

export function isProjectGrantStateValid(state: ProjectGrantState): boolean {
  return state > ProjectGrantState.UNSPECIFIED && state <= ProjectGrantState.REMOVED;
}

export function getRemovedRoles(existingRoles: string[], newRoles: string[]): string[] {
  return existingRoles.filter(role => !newRoles.includes(role));
}
