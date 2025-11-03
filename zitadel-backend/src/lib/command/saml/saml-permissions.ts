/**
 * SAML Permission Checking
 * 
 * Validates user access to SAML applications
 * Based on Go: internal/api/grpc/saml/v2/saml.go checkPermission
 */

import { DatabasePool } from '../../database';
import { throwPermissionDenied } from '@/zerrors/errors';

/**
 * Project Permission Result
 */
export interface ProjectPermission {
  hasProjectChecked: boolean;
  projectRoleChecked: boolean;
  projectID?: string;
  orgID?: string;
}

/**
 * Check if user has permission to access SAML application
 * 
 * Validates:
 * 1. User has access to the project (via UserGrant)
 * 2. User has required roles for the application
 * 
 * @param pool Database pool
 * @param entityID SAML issuer/entityID (maps to application)
 * @param userID User requesting access
 * @param instanceID Instance ID
 * @throws PermissionDenied if user lacks access
 */
export async function checkSAMLPermission(
  pool: DatabasePool,
  entityID: string,
  userID: string,
  instanceID: string
): Promise<ProjectPermission> {
  // 1. Find application by entity ID (issuer)
  // In SAML, the issuer is typically the application's entity ID
  const appQuery = `
    SELECT 
      a.id as app_id,
      a.project_id,
      p.resource_owner as org_id
    FROM projections.applications a
    JOIN projections.projects p ON a.project_id = p.id AND a.instance_id = p.instance_id
    WHERE a.instance_id = $1
      AND a.state = 'active'
      AND p.state = 'active'
      AND (
        -- Match by entity ID or application name
        a.entity_id = $2
        OR a.id = $2
      )
    LIMIT 1
  `;

  const appResult = await pool.query(appQuery, [instanceID, entityID]);

  if (appResult.rows.length === 0) {
    throwPermissionDenied(
      'Application not found or inactive',
      'SAML-perm01'
    );
  }

  const app = appResult.rows[0];
  const projectID = app.project_id;
  const orgID = app.org_id;

  // 2. Check if user has access to the project via UserGrant
  const grantQuery = `
    SELECT 
      ug.id,
      ug.roles
    FROM projections.user_grants ug
    WHERE ug.instance_id = $1
      AND ug.user_id = $2
      AND ug.project_id = $3
      AND ug.state = 1
    LIMIT 1
  `;

  const grantResult = await pool.query(grantQuery, [instanceID, userID, projectID]);

  // Check project access
  const hasProjectAccess = grantResult.rows.length > 0;
  
  if (!hasProjectAccess) {
    throwPermissionDenied(
      'User does not have access to this project',
      'SAML-perm02'
    );
  }

  // 3. Check if user has required roles
  // For SAML, we typically require at least one role in the project
  const grant = grantResult.rows[0];
  const roleKeys = grant.roles || [];
  const hasRequiredRoles = roleKeys.length > 0;

  if (!hasRequiredRoles) {
    throwPermissionDenied(
      'User does not have required roles for this application',
      'SAML-perm03'
    );
  }

  // Return permission result
  return {
    hasProjectChecked: true,
    projectRoleChecked: true,
    projectID,
    orgID
  };
}

/**
 * Check SAML permission with project ID
 * 
 * Simpler check when project ID is already known
 */
export async function checkSAMLPermissionByProjectID(
  pool: DatabasePool,
  projectID: string,
  userID: string,
  instanceID: string
): Promise<ProjectPermission> {
  const query = `
    SELECT 
      ug.id,
      ug.roles,
      p.resource_owner as org_id
    FROM projections.user_grants ug
    JOIN projections.projects p ON ug.project_id = p.id AND ug.instance_id = p.instance_id
    WHERE ug.instance_id = $1
      AND ug.user_id = $2
      AND ug.project_id = $3
      AND ug.state = 1
    LIMIT 1
  `;

  const result = await pool.query(query, [instanceID, userID, projectID]);

  if (result.rows.length === 0) {
    throwPermissionDenied(
      'User does not have access to this project',
      'SAML-perm04'
    );
  }

  const grant = result.rows[0];
  const roleKeys = grant.roles || [];

  if (roleKeys.length === 0) {
    throwPermissionDenied(
      'User does not have required roles',
      'SAML-perm05'
    );
  }

  return {
    hasProjectChecked: true,
    projectRoleChecked: true,
    projectID,
    orgID: grant.org_id
  };
}

/**
 * Get user's roles for a SAML application
 * 
 * Returns the list of role keys the user has been granted
 */
export async function getUserRolesForSAMLApp(
  pool: DatabasePool,
  entityID: string,
  userID: string,
  instanceID: string
): Promise<string[]> {
  const query = `
    SELECT 
      ug.roles
    FROM projections.user_grants ug
    JOIN projections.applications a ON ug.project_id = a.project_id AND ug.instance_id = a.instance_id
    WHERE ug.instance_id = $1
      AND ug.user_id = $2
      AND ug.state = 1
      AND (a.entity_id = $3 OR a.id = $3)
    LIMIT 1
  `;

  const result = await pool.query(query, [instanceID, userID, entityID]);

  if (result.rows.length === 0) {
    return [];
  }

  return result.rows[0].roles || [];
}
