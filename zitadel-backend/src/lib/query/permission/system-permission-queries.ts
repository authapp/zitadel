/**
 * System Permission queries for Zitadel platform management
 * Handles Zitadel-specific system permissions for platform administration
 */

import { DatabasePool } from '../../database';
import {
  ZitadelPermission,
  ZitadelResource,
  ZitadelAction,
  Permission,
  ZITADEL_ROLES,
} from './permission-types';

export class SystemPermissionQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get Zitadel system permissions for current user
   * These are platform-level permissions for managing Zitadel itself
   * 
   * @param userID - User ID
   * @param instanceID - Instance ID
   * @returns Zitadel permissions
   */
  async getMyZitadelPermissions(
    userID: string,
    instanceID: string
  ): Promise<ZitadelPermission[]> {
    const permissions: ZitadelPermission[] = [];

    // Check instance membership (IAM level)
    const instanceMember = await this.database.queryOne(
      `SELECT roles FROM projections.instance_members
       WHERE instance_id = $1 AND user_id = $2`,
      [instanceID, userID]
    );

    if (instanceMember) {
      const roles = instanceMember.roles || [];
      const systemPerms = this.mapRolesToZitadelPermissions(roles);
      permissions.push(...systemPerms);
    }

    return permissions;
  }

  /**
   * Check if user has specific Zitadel system permission
   * 
   * @param userID - User ID
   * @param instanceID - Instance ID
   * @param resource - Resource type
   * @param action - Action type
   * @returns True if user has permission
   */
  async hasZitadelPermission(
    userID: string,
    instanceID: string,
    resource: ZitadelResource,
    action: ZitadelAction
  ): Promise<boolean> {
    const permissions = await this.getMyZitadelPermissions(userID, instanceID);

    return permissions.some(
      perm =>
        perm.resource === resource &&
        (perm.action === action || perm.action === ZitadelAction.MANAGE)
    );
  }

  /**
   * Get all Zitadel permissions for instance owners
   * 
   * @param _instanceID - Instance ID
   * @returns All instance owner permissions
   */
  async getInstanceOwnerPermissions(_instanceID: string): Promise<ZitadelPermission[]> {
    // Instance owners have full permissions on everything
    return this.getAllZitadelPermissions();
  }

  /**
   * Map roles to Zitadel system permissions
   */
  private mapRolesToZitadelPermissions(roles: string[]): ZitadelPermission[] {
    const permissions: ZitadelPermission[] = [];

    for (const role of roles) {
      const perms = this.getRoleZitadelPermissions(role);
      permissions.push(...perms);
    }

    return permissions;
  }

  /**
   * Get Zitadel permissions for a specific role
   */
  private getRoleZitadelPermissions(role: string): ZitadelPermission[] {
    switch (role) {
      case ZITADEL_ROLES.IAM_OWNER:
        return this.getIAMOwnerPermissions();

      case ZITADEL_ROLES.IAM_ADMIN:
        return this.getIAMAdminPermissions();

      case ZITADEL_ROLES.IAM_USER:
        return this.getIAMUserPermissions();

      default:
        return [];
    }
  }

  /**
   * IAM Owner has full system permissions
   */
  private getIAMOwnerPermissions(): ZitadelPermission[] {
    return this.getAllZitadelPermissions();
  }

  /**
   * IAM Admin has most permissions except instance management
   */
  private getIAMAdminPermissions(): ZitadelPermission[] {
    return [
      // Organization management
      { resource: ZitadelResource.ORG, action: ZitadelAction.MANAGE },
      { resource: ZitadelResource.ORG_MEMBER, action: ZitadelAction.MANAGE },
      
      // User management
      { resource: ZitadelResource.USER, action: ZitadelAction.MANAGE },
      { resource: ZitadelResource.USER_GRANT, action: ZitadelAction.MANAGE },
      
      // Project management
      { resource: ZitadelResource.PROJECT, action: ZitadelAction.MANAGE },
      { resource: ZitadelResource.PROJECT_MEMBER, action: ZitadelAction.MANAGE },
      { resource: ZitadelResource.PROJECT_GRANT, action: ZitadelAction.MANAGE },
      
      // Application management
      { resource: ZitadelResource.APP, action: ZitadelAction.MANAGE },
      
      // Policy management
      { resource: ZitadelResource.POLICY, action: ZitadelAction.MANAGE },
      
      // Instance read-only
      { resource: ZitadelResource.INSTANCE, action: ZitadelAction.READ },
    ];
  }

  /**
   * IAM User has read-only permissions
   */
  private getIAMUserPermissions(): ZitadelPermission[] {
    return [
      { resource: ZitadelResource.INSTANCE, action: ZitadelAction.READ },
      { resource: ZitadelResource.ORG, action: ZitadelAction.READ },
      { resource: ZitadelResource.USER, action: ZitadelAction.READ },
      { resource: ZitadelResource.PROJECT, action: ZitadelAction.READ },
      { resource: ZitadelResource.APP, action: ZitadelAction.READ },
    ];
  }

  /**
   * Get all possible Zitadel system permissions
   */
  private getAllZitadelPermissions(): ZitadelPermission[] {
    const resources = Object.values(ZitadelResource);
    const permissions: ZitadelPermission[] = [];

    for (const resource of resources) {
      permissions.push({
        resource: resource as ZitadelResource,
        action: ZitadelAction.MANAGE,
      });
    }

    return permissions;
  }

  /**
   * Convert Zitadel permission to generic permission
   */
  toGenericPermission(zitadelPerm: ZitadelPermission): Permission {
    return {
      resource: zitadelPerm.resource,
      action: zitadelPerm.action,
    };
  }

  /**
   * Convert Zitadel permissions to generic permissions
   */
  toGenericPermissions(zitadelPerms: ZitadelPermission[]): Permission[] {
    return zitadelPerms.map(p => this.toGenericPermission(p));
  }
}
