/**
 * Authorization context builder
 */

import { 
  AuthContext, 
  Subject, 
  TokenType, 
  InstanceMetadata, 
  OrgMetadata, 
  ProjectMetadata 
} from './types';

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
  
  // Enhanced metadata
  private instanceMetadata?: InstanceMetadata;
  private orgMetadata?: OrgMetadata;
  private projectMetadata?: ProjectMetadata;
  
  // Token information
  private tokenType: TokenType = TokenType.USER;
  private isSystemToken: boolean = false;
  private serviceAccount: boolean = false;

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
   * Set instance metadata
   */
  withInstanceMetadata(metadata: InstanceMetadata): this {
    this.instanceMetadata = metadata;
    return this;
  }

  /**
   * Set organization metadata
   */
  withOrgMetadata(metadata: OrgMetadata): this {
    this.orgMetadata = metadata;
    return this;
  }

  /**
   * Set project metadata
   */
  withProjectMetadata(metadata: ProjectMetadata): this {
    this.projectMetadata = metadata;
    return this;
  }

  /**
   * Set token type
   */
  withTokenType(tokenType: TokenType): this {
    this.tokenType = tokenType;
    this.isSystemToken = (tokenType === TokenType.SYSTEM);
    return this;
  }

  /**
   * Mark as system token
   */
  asSystemToken(): this {
    this.tokenType = TokenType.SYSTEM;
    this.isSystemToken = true;
    return this;
  }

  /**
   * Mark as service account
   */
  asServiceAccount(): this {
    this.tokenType = TokenType.SERVICE_ACCOUNT;
    this.serviceAccount = true;
    return this;
  }

  /**
   * Build the auth context
   */
  build(): AuthContext {
    if (!this.userId && !this.isSystemToken) {
      throw new Error('User ID is required for auth context (except for system tokens)');
    }

    const subject: Subject = {
      userId: this.userId || 'system',
      orgId: this.orgId,
      roles: this.roles,
      tokenType: this.tokenType,
      serviceAccount: this.serviceAccount,
    };

    return {
      subject,
      instanceId: this.instanceId,
      orgId: this.orgId,
      projectId: this.projectId,
      
      // Enhanced metadata
      instanceMetadata: this.instanceMetadata,
      orgMetadata: this.orgMetadata,
      projectMetadata: this.projectMetadata,
      
      // Token information
      tokenType: this.tokenType,
      isSystemToken: this.isSystemToken,
      
      // Legacy metadata
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
  token_type?: 'user' | 'service' | 'system';
  service_account?: boolean;
  [key: string]: any;
}

/**
 * Build context from JWT token
 */
export function buildContextFromToken(payload: TokenPayload): AuthContext {
  const builder = AuthContextBuilder.create()
    .withUserId(payload.sub)
    .withOrgId(payload.org_id || '')
    .withProjectId(payload.project_id || '')
    .withInstanceId(payload.instance_id || 'default')
    .withRoles(payload.roles || [])
    .withMetadata(payload);

  // Detect token type
  if (payload.token_type === 'system') {
    builder.asSystemToken();
  } else if (payload.token_type === 'service' || payload.service_account) {
    builder.asServiceAccount();
  } else {
    builder.withTokenType(TokenType.USER);
  }

  return builder.build();
}

/**
 * Build context for system operations (no user required)
 */
export function buildSystemContext(instanceId: string = 'default'): AuthContext {
  return AuthContextBuilder.create()
    .withInstanceId(instanceId)
    .withRoles(['system_admin', 'iam_owner'])
    .asSystemToken()
    .build();
}

/**
 * Build context for service account
 */
export function buildServiceAccountContext(
  userId: string,
  instanceId: string = 'default',
  orgId?: string,
  roles: string[] = []
): AuthContext {
  return AuthContextBuilder.create()
    .withUserId(userId)
    .withInstanceId(instanceId)
    .withOrgId(orgId || '')
    .withRoles(roles)
    .asServiceAccount()
    .build();
}
