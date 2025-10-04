/**
 * Role manager implementation
 */

import { Query } from '../query/types';
import { Role, RoleManager, Subject, RoleNotFoundError } from './types';
import { SystemRoleDefinitions, getRolePermissions } from './permissions';

/**
 * Query-based role manager implementation
 */
export class QueryRoleManager implements RoleManager {
  constructor(private query: Query) {}

  /**
   * Get role by ID
   */
  async getRole(roleId: string): Promise<Role | null> {
    // Check if it's a system role
    if (roleId in SystemRoleDefinitions) {
      return SystemRoleDefinitions[roleId as keyof typeof SystemRoleDefinitions];
    }

    // Query custom roles from database  
    return await this.query.findById<Role>('roles', roleId);
  }

  /**
   * Get roles for subject
   */
  async getRolesForSubject(subject: Subject): Promise<Role[]> {
    const roles: Role[] = [];

    for (const roleId of subject.roles) {
      const role = await this.getRole(roleId);
      if (role) {
        // Apply subject context to role permissions
        const contextualRole: Role = {
          ...role,
          permissions: role.permissions.map(p => ({
            ...p,
            orgId: p.orgId || subject.orgId,
          })),
        };
        roles.push(contextualRole);
      }
    }

    return roles;
  }

  /**
   * Assign role to subject
   */
  async assignRole(_userId: string, roleId: string, _orgId?: string): Promise<void> {
    // Verify role exists
    const role = await this.getRole(roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    // Note: In a real implementation, we would check if the assignment already exists
    // const existing = await this.query.find('user_roles', { filters: [...] });
    // and use userId to filter

    // Note: This would typically be done through command module
    // For now, this is a placeholder showing the intent
    // In production, this would dispatch a command
    throw new Error('Role assignment must be done through command module');
  }

  /**
   * Remove role from subject
   */
  async removeRole(_userId: string, _roleId: string): Promise<void> {
    // Note: This would typically be done through command module
    // For now, this is a placeholder showing the intent
    // In production, this would dispatch a command
    throw new Error('Role removal must be done through command module');
  }
}

/**
 * In-memory role manager for testing
 */
export class InMemoryRoleManager implements RoleManager {
  private roles = new Map<string, Role>();
  private userRoles = new Map<string, Set<string>>();

  constructor() {
    // Load system roles
    Object.entries(SystemRoleDefinitions).forEach(([id, role]) => {
      this.roles.set(id, role);
    });
  }

  async getRole(roleId: string): Promise<Role | null> {
    return this.roles.get(roleId) || null;
  }

  async getRolesForSubject(subject: Subject): Promise<Role[]> {
    const roles: Role[] = [];

    for (const roleId of subject.roles) {
      const role = await this.getRole(roleId);
      if (role) {
        roles.push({
          ...role,
          permissions: getRolePermissions(roleId, subject.orgId),
        });
      }
    }

    return roles;
  }

  async assignRole(userId: string, roleId: string, _orgId?: string): Promise<void> {
    const role = await this.getRole(roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, new Set());
    }

    this.userRoles.get(userId)!.add(roleId);
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const userRoleSet = this.userRoles.get(userId);
    if (userRoleSet) {
      userRoleSet.delete(roleId);
    }
  }

  /**
   * Add custom role (for testing)
   */
  addRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  /**
   * Get user roles (for testing)
   */
  getUserRoles(userId: string): string[] {
    return Array.from(this.userRoles.get(userId) || []);
  }
}

/**
 * Create role manager instance
 */
export function createRoleManager(query: Query): RoleManager {
  return new QueryRoleManager(query);
}

/**
 * Create in-memory role manager for testing
 */
export function createInMemoryRoleManager(): InMemoryRoleManager {
  return new InMemoryRoleManager();
}
