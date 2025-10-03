/**
 * Permission and authorization domain models
 */

/**
 * Role types in Zitadel
 */
export enum RoleType {
  UNSPECIFIED = 0,
  ORG = 1,
  IAM = 2,
  PROJECT = 3,
}

/**
 * Role definition
 */
export interface Role {
  key: string;
  displayName: string;
  group?: string;
  type: RoleType;
}

/**
 * User grant - assigns roles to a user
 */
export interface UserGrant {
  id: string;
  userId: string;
  projectId: string;
  projectGrantId?: string;
  roleKeys: string[];
  resourceOwner: string;
  createdAt: Date;
  changedAt: Date;
  sequence: number;
}

/**
 * Member role assignment
 */
export interface Member {
  userId: string;
  roles: string[];
  createdAt: Date;
  changedAt: Date;
}

/**
 * Permission check function type
 */
export type PermissionCheck = (
  ctx: PermissionContext,
  permission: string,
  resourceId: string,
) => Promise<boolean>;

/**
 * Permission context
 */
export interface PermissionContext {
  userId: string;
  orgId: string;
  projectId?: string;
  roles: string[];
}

/**
 * Built-in Zitadel permissions
 */
export const ZitadelPermissions = {
  // User permissions
  USER_READ: 'user.read',
  USER_WRITE: 'user.write',
  USER_DELETE: 'user.delete',

  // Organization permissions
  ORG_READ: 'org.read',
  ORG_WRITE: 'org.write',
  ORG_DELETE: 'org.delete',
  ORG_MEMBER_READ: 'org.member.read',
  ORG_MEMBER_WRITE: 'org.member.write',

  // Project permissions
  PROJECT_READ: 'project.read',
  PROJECT_WRITE: 'project.write',
  PROJECT_DELETE: 'project.delete',
  PROJECT_MEMBER_READ: 'project.member.read',
  PROJECT_MEMBER_WRITE: 'project.member.write',
  PROJECT_ROLE_READ: 'project.role.read',
  PROJECT_ROLE_WRITE: 'project.role.write',
  PROJECT_APP_READ: 'project.app.read',
  PROJECT_APP_WRITE: 'project.app.write',

  // Grant permissions
  PROJECT_GRANT_READ: 'project.grant.read',
  PROJECT_GRANT_WRITE: 'project.grant.write',
  USER_GRANT_READ: 'user.grant.read',
  USER_GRANT_WRITE: 'user.grant.write',

  // IAM permissions
  IAM_READ: 'iam.read',
  IAM_WRITE: 'iam.write',
  IAM_POLICY_READ: 'iam.policy.read',
  IAM_POLICY_WRITE: 'iam.policy.write',
  IAM_MEMBER_READ: 'iam.member.read',
  IAM_MEMBER_WRITE: 'iam.member.write',
} as const;

/**
 * Built-in Zitadel roles
 */
export const ZitadelRoles = {
  // IAM roles
  IAM_OWNER: 'IAM_OWNER',
  IAM_ADMIN: 'IAM_ADMIN',
  IAM_USER: 'IAM_USER',

  // Organization roles
  ORG_OWNER: 'ORG_OWNER',
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_USER: 'ORG_USER',
  ORG_USER_MANAGER: 'ORG_USER_MANAGER',
  ORG_PROJECT_CREATOR: 'ORG_PROJECT_CREATOR',

  // Project roles
  PROJECT_OWNER: 'PROJECT_OWNER',
  PROJECT_ADMIN: 'PROJECT_ADMIN',
  PROJECT_USER: 'PROJECT_USER',
} as const;
