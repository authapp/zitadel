/**
 * Authorization context builder
 */

import { AuthContext, Subject } from './types';

/**
 * Build authorization context from request data
 */
export class AuthContextBuilder {
  private userId?: string;
  private orgId?: string;
  private projectId?: string;
  private instanceId: string = 'default';
  private roles: string[] = [];
  private metadata: Record<string, any> = {};

  /**
   * Set user ID
   */
  withUserId(userId: string): this {
    this.userId = userId;
    return this;
  }

  /**
   * Set organization ID
   */
  withOrgId(orgId: string): this {
    this.orgId = orgId;
    return this;
  }

  /**
   * Set project ID
   */
  withProjectId(projectId: string): this {
    this.projectId = projectId;
    return this;
  }

  /**
   * Set instance ID
   */
  withInstanceId(instanceId: string): this {
    this.instanceId = instanceId;
    return this;
  }

  /**
   * Set roles
   */
  withRoles(roles: string[]): this {
    this.roles = roles;
    return this;
  }

  /**
   * Add single role
   */
  addRole(role: string): this {
    this.roles.push(role);
    return this;
  }

  /**
   * Set metadata
   */
  withMetadata(metadata: Record<string, any>): this {
    this.metadata = metadata;
    return this;
  }

  /**
   * Add metadata field
   */
  addMetadata(key: string, value: any): this {
    this.metadata[key] = value;
    return this;
  }

  /**
   * Build the auth context
   */
  build(): AuthContext {
    if (!this.userId) {
      throw new Error('User ID is required for auth context');
    }

    const subject: Subject = {
      userId: this.userId,
      orgId: this.orgId,
      roles: this.roles,
    };

    return {
      subject,
      instanceId: this.instanceId,
      orgId: this.orgId,
      projectId: this.projectId,
      metadata: this.metadata,
    };
  }

  /**
   * Create new builder
   */
  static create(): AuthContextBuilder {
    return new AuthContextBuilder();
  }
}

/**
 * Extract auth context from JWT token payload
 */
export interface TokenPayload {
  sub: string; // User ID
  org_id?: string;
  project_id?: string;
  instance_id?: string;
  roles?: string[];
  [key: string]: any;
}

/**
 * Build context from JWT token
 */
export function buildContextFromToken(payload: TokenPayload): AuthContext {
  return AuthContextBuilder.create()
    .withUserId(payload.sub)
    .withOrgId(payload.org_id || '')
    .withProjectId(payload.project_id || '')
    .withInstanceId(payload.instance_id || 'default')
    .withRoles(payload.roles || [])
    .withMetadata(payload)
    .build();
}

/**
 * Build context for system operations
 */
export function buildSystemContext(instanceId: string = 'default'): AuthContext {
  return AuthContextBuilder.create()
    .withUserId('system')
    .withInstanceId(instanceId)
    .withRoles(['system_admin'])
    .build();
}
