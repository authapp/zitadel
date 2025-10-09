/**
 * Commands Class (Zitadel v2)
 * 
 * Main orchestrator for all write operations.
 * Follows Zitadel's command pattern with write models.
 */

import { Eventstore } from '../eventstore/types';
import { Cache } from '../cache/types';
import { Storage } from '../static/types';
import { SnowflakeGenerator } from '../id';
import { PermissionChecker, SimplePermissionChecker, checkPermission as checkPerm } from './permissions';
import { Context } from './context';

// Type alias for convenience
export type IDGenerator = SnowflakeGenerator;

/**
 * Commands configuration
 */
export interface CommandsConfig {
  externalDomain: string;
  externalSecure: boolean;
  externalPort: number;
  zitadelRoles?: string[];
}

/**
 * Main Commands class
 * 
 * This is the write-side (CQRS) orchestrator.
 * All business logic and state mutations go through here.
 */
export class Commands {
  private permissionChecker: PermissionChecker;
  
  constructor(
    private eventstore: Eventstore,
    private cache: Cache,
    private staticStorage: Storage,
    private idGenerator: IDGenerator,
    private config: CommandsConfig,
    permissionChecker?: PermissionChecker
  ) {
    this.permissionChecker = permissionChecker || new SimplePermissionChecker();
  }
  
  /**
   * Get eventstore (for write models)
   */
  getEventstore(): Eventstore {
    return this.eventstore;
  }
  
  /**
   * Get cache
   */
  getCache(): Cache {
    return this.cache;
  }
  
  /**
   * Get static storage
   */
  getStatic(): Storage {
    return this.staticStorage;
  }
  
  /**
   * Get ID generator
   */
  getIDGenerator(): IDGenerator {
    return this.idGenerator;
  }
  
  /**
   * Get config
   */
  getConfig(): CommandsConfig {
    return this.config;
  }
  
  /**
   * Generate next ID
   */
  async nextID(): Promise<string> {
    return this.idGenerator.generate();
  }
  
  /**
   * Check permission
   */
  async checkPermission(ctx: Context, resource: string, action: string, scope?: string): Promise<void> {
    await checkPerm(this.permissionChecker, ctx, resource, action, scope);
  }
  
  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      return await this.eventstore.health();
    } catch {
      return false;
    }
  }
  
  // ============================================================================
  // User Commands (Week 2)
  // ============================================================================
  
  /**
   * Add human user
   */
  addHumanUser: typeof import('./user/user-commands').addHumanUser = 
    require('./user/user-commands').addHumanUser;
  
  /**
   * Add machine user
   */
  addMachineUser: typeof import('./user/user-commands').addMachineUser = 
    require('./user/user-commands').addMachineUser;
  
  /**
   * Change username
   */
  changeUsername: typeof import('./user/user-commands').changeUsername = 
    require('./user/user-commands').changeUsername;
  
  /**
   * Change user profile
   */
  changeProfile: typeof import('./user/user-commands').changeProfile = 
    require('./user/user-commands').changeProfile;
  
  /**
   * Change email
   */
  changeEmail: typeof import('./user/user-commands').changeEmail = 
    require('./user/user-commands').changeEmail;
  
  /**
   * Verify email
   */
  verifyEmail: typeof import('./user/user-commands').verifyEmail = 
    require('./user/user-commands').verifyEmail;
  
  /**
   * Change password
   */
  changePassword: typeof import('./user/user-commands').changePassword = 
    require('./user/user-commands').changePassword;
  
  /**
   * Deactivate user
   */
  deactivateUser: typeof import('./user/user-commands').deactivateUser = 
    require('./user/user-commands').deactivateUser;
  
  /**
   * Reactivate user
   */
  reactivateUser: typeof import('./user/user-commands').reactivateUser = 
    require('./user/user-commands').reactivateUser;
  
  /**
   * Remove user
   */
  removeUser: typeof import('./user/user-commands').removeUser = 
    require('./user/user-commands').removeUser;
  
  // ============================================================================
  // Organization Commands (Week 3)
  // ============================================================================
  
  /**
   * Add organization
   */
  addOrg: typeof import('./org/org-commands').addOrg = 
    require('./org/org-commands').addOrg;
  
  /**
   * Change organization
   */
  changeOrg: typeof import('./org/org-commands').changeOrg = 
    require('./org/org-commands').changeOrg;
  
  /**
   * Deactivate organization
   */
  deactivateOrg: typeof import('./org/org-commands').deactivateOrg = 
    require('./org/org-commands').deactivateOrg;
  
  /**
   * Reactivate organization
   */
  reactivateOrg: typeof import('./org/org-commands').reactivateOrg = 
    require('./org/org-commands').reactivateOrg;
  
  /**
   * Add organization member
   */
  addOrgMember: typeof import('./org/org-commands').addOrgMember = 
    require('./org/org-commands').addOrgMember;
  
  /**
   * Change organization member roles
   */
  changeOrgMember: typeof import('./org/org-commands').changeOrgMember = 
    require('./org/org-commands').changeOrgMember;
  
  /**
   * Remove organization member
   */
  removeOrgMember: typeof import('./org/org-commands').removeOrgMember = 
    require('./org/org-commands').removeOrgMember;
  
  /**
   * Add domain to organization
   */
  addDomain: typeof import('./org/org-commands').addDomain = 
    require('./org/org-commands').addDomain;
  
  /**
   * Verify domain
   */
  verifyDomain: typeof import('./org/org-commands').verifyDomain = 
    require('./org/org-commands').verifyDomain;
  
  /**
   * Set primary domain
   */
  setPrimaryDomain: typeof import('./org/org-commands').setPrimaryDomain = 
    require('./org/org-commands').setPrimaryDomain;
  
  // ============================================================================
  // Project Commands (Week 4)
  // ============================================================================
  
  /**
   * Add project
   */
  addProject: typeof import('./project/project-commands').addProject = 
    require('./project/project-commands').addProject;
  
  /**
   * Change project
   */
  changeProject: typeof import('./project/project-commands').changeProject = 
    require('./project/project-commands').changeProject;
  
  /**
   * Deactivate project
   */
  deactivateProject: typeof import('./project/project-commands').deactivateProject = 
    require('./project/project-commands').deactivateProject;
  
  /**
   * Reactivate project
   */
  reactivateProject: typeof import('./project/project-commands').reactivateProject = 
    require('./project/project-commands').reactivateProject;
  
  /**
   * Add project role
   */
  addProjectRole: typeof import('./project/project-commands').addProjectRole = 
    require('./project/project-commands').addProjectRole;
  
  /**
   * Change project role
   */
  changeProjectRole: typeof import('./project/project-commands').changeProjectRole = 
    require('./project/project-commands').changeProjectRole;
  
  /**
   * Remove project role
   */
  removeProjectRole: typeof import('./project/project-commands').removeProjectRole = 
    require('./project/project-commands').removeProjectRole;
  
  /**
   * Add project member
   */
  addProjectMember: typeof import('./project/project-commands').addProjectMember = 
    require('./project/project-commands').addProjectMember;
  
  /**
   * Change project member roles
   */
  changeProjectMember: typeof import('./project/project-commands').changeProjectMember = 
    require('./project/project-commands').changeProjectMember;
  
  /**
   * Add project grant
   */
  addProjectGrant: typeof import('./project/project-commands').addProjectGrant = 
    require('./project/project-commands').addProjectGrant;
  
  /**
   * Change project grant
   */
  changeProjectGrant: typeof import('./project/project-commands').changeProjectGrant = 
    require('./project/project-commands').changeProjectGrant;
  
  // ============================================================================
  // Application Commands (Week 5)
  // ============================================================================
  
  /**
   * Add OIDC application
   */
  addOIDCApp: typeof import('./application/app-commands').addOIDCApp = 
    require('./application/app-commands').addOIDCApp;
  
  /**
   * Update OIDC application
   */
  updateOIDCApp: typeof import('./application/app-commands').updateOIDCApp = 
    require('./application/app-commands').updateOIDCApp;
  
  /**
   * Add API application
   */
  addAPIApp: typeof import('./application/app-commands').addAPIApp = 
    require('./application/app-commands').addAPIApp;
  
  /**
   * Update API application
   */
  updateAPIApp: typeof import('./application/app-commands').updateAPIApp = 
    require('./application/app-commands').updateAPIApp;
  
  /**
   * Change application secret
   */
  changeAppSecret: typeof import('./application/app-commands').changeAppSecret = 
    require('./application/app-commands').changeAppSecret;
  
  /**
   * Add application key
   */
  addAppKey: typeof import('./application/app-commands').addAppKey = 
    require('./application/app-commands').addAppKey;
}

/**
 * Factory function to create Commands instance
 */
export function createCommands(
  eventstore: Eventstore,
  cache: Cache,
  staticStorage: Storage,
  idGenerator: IDGenerator,
  config: CommandsConfig
): Commands {
  return new Commands(eventstore, cache, staticStorage, idGenerator, config);
}
