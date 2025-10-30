/**
 * Instance-level authorization
 * 
 * Handles authorization checks at the instance level:
 * - Feature flag checks
 * - Quota enforcement
 * - Instance-level permissions
 * - IAM member validation
 */

import { AuthContext, Permission } from './types';
import { ZitadelError, ErrorCode } from '../zerrors';

/**
 * Check if instance feature is enabled
 */
export function checkInstanceFeature(
  context: AuthContext,
  featureName: string
): boolean {
  // System tokens bypass feature checks
  if (context.isSystemToken) {
    return true;
  }

  // Check if feature metadata exists
  const features = context.instanceMetadata?.features;
  if (!features) {
    // If no feature metadata, assume enabled (backward compatibility)
    return true;
  }

  return features[featureName] === true;
}

/**
 * Require instance feature to be enabled
 * @throws {ZitadelError} if feature is disabled
 */
export function requireInstanceFeature(
  context: AuthContext,
  featureName: string
): void {
  if (!checkInstanceFeature(context, featureName)) {
    throw new ZitadelError(
      ErrorCode.FEATURE_DISABLED,
      `Feature '${featureName}' is not enabled for this instance`,
      { instanceId: context.instanceId, feature: featureName }
    );
  }
}

/**
 * Check instance quota
 * Returns true if within quota, false if exceeded
 */
export function checkInstanceQuota(
  context: AuthContext,
  quotaName: string,
  currentUsage: number
): boolean {
  // System tokens bypass quota checks
  if (context.isSystemToken) {
    return true;
  }

  const quotas = context.instanceMetadata?.quotas;
  if (!quotas) {
    // No quota defined = unlimited
    return true;
  }

  const limit = quotas[quotaName];
  if (limit === undefined || limit === -1) {
    // No limit or unlimited
    return true;
  }

  return currentUsage < limit;
}

/**
 * Require quota to not be exceeded
 * @throws {ZitadelError} if quota exceeded
 */
export function requireInstanceQuota(
  context: AuthContext,
  quotaName: string,
  currentUsage: number
): void {
  if (!checkInstanceQuota(context, quotaName, currentUsage)) {
    const limit = context.instanceMetadata?.quotas?.[quotaName] || 0;
    throw new ZitadelError(
      ErrorCode.QUOTA_EXCEEDED,
      `Quota '${quotaName}' exceeded (${currentUsage}/${limit})`,
      {
        instanceId: context.instanceId,
        quota: quotaName,
        usage: currentUsage,
        limit,
      }
    );
  }
}

/**
 * Check if user is IAM member (instance administrator)
 */
export function isIAMMember(context: AuthContext): boolean {
  // System tokens are always IAM members
  if (context.isSystemToken) {
    return true;
  }

  const roles = context.subject.roles || [];
  return roles.some(role => 
    role === 'IAM_OWNER' || 
    role === 'IAM_ADMIN' ||
    role === 'iam_owner' ||
    role === 'iam_admin' ||
    role === 'system_admin'
  );
}

/**
 * Require IAM member role
 * @throws {ZitadelError} if not IAM member
 */
export function requireIAMMember(context: AuthContext): void {
  if (!isIAMMember(context)) {
    throw new ZitadelError(
      ErrorCode.PERMISSION_DENIED,
      'IAM member role required for this operation',
      { instanceId: context.instanceId, userId: context.subject.userId }
    );
  }
}

/**
 * Check if user has specific instance-level permission
 */
export function hasInstancePermission(
  context: AuthContext,
  permission: Permission
): boolean {
  // System tokens have all permissions
  if (context.isSystemToken) {
    return true;
  }

  // IAM members have all instance permissions
  if (isIAMMember(context)) {
    return true;
  }

  // Check explicit permissions
  const permissions = context.subject.permissions || [];
  return permissions.some(p => 
    p.resource === permission.resource && 
    p.action === permission.action &&
    (!permission.resourceId || p.resourceId === permission.resourceId)
  );
}

/**
 * Require instance permission
 * @throws {ZitadelError} if permission denied
 */
export function requireInstancePermission(
  context: AuthContext,
  permission: Permission
): void {
  if (!hasInstancePermission(context, permission)) {
    throw new ZitadelError(
      ErrorCode.PERMISSION_DENIED,
      `Permission denied: ${permission.action} on ${permission.resource}`,
      {
        instanceId: context.instanceId,
        userId: context.subject.userId,
        permission,
      }
    );
  }
}

/**
 * Validate instance context
 * Ensures the context has a valid instance ID
 * @throws {ZitadelError} if invalid instance
 */
export function validateInstanceContext(context: AuthContext): void {
  if (!context.instanceId || context.instanceId === '') {
    throw new ZitadelError(
      ErrorCode.INVALID_ARGUMENT,
      'Instance ID is required',
      { context }
    );
  }
}

/**
 * Check if operation is allowed on instance
 * Combines feature, quota, and permission checks
 */
export async function checkInstanceOperation(
  context: AuthContext,
  options: {
    feature?: string;
    quota?: { name: string; currentUsage: number };
    permission?: Permission;
    requireIAM?: boolean;
  }
): Promise<boolean> {
  try {
    // Validate instance
    validateInstanceContext(context);

    // Check IAM requirement
    if (options.requireIAM && !isIAMMember(context)) {
      return false;
    }

    // Check feature flag
    if (options.feature && !checkInstanceFeature(context, options.feature)) {
      return false;
    }

    // Check quota
    if (options.quota) {
      const { name, currentUsage } = options.quota;
      if (!checkInstanceQuota(context, name, currentUsage)) {
        return false;
      }
    }

    // Check permission
    if (options.permission && !hasInstancePermission(context, options.permission)) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}
