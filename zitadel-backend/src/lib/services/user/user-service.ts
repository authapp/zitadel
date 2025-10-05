/**
 * User service implementation
 */

import { User } from '../../domain/user';
import { AuthContext, PermissionBuilder, ActionType } from '../../authz';
import { PermissionChecker } from '../../authz/types';
import { CommandBus } from '../../command/types';
import { Query } from '../../query/types';
import { PasswordHasher } from '../../auth/types';
import { NotificationService } from '../../notification/types';
import { generateId } from '../../id/snowflake';
import {
  UserService,
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  SetupMfaRequest,
  UserListOptions,
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidPasswordError,
} from './types';
import {
  CreateUserCommand,
  UpdateUserCommand,
  DeactivateUserCommand,
} from '../../command/commands/user';

/**
 * Default user service implementation
 */
export class DefaultUserService implements UserService {
  constructor(
    private commandBus: CommandBus,
    private query: Query,
    private permissionChecker: PermissionChecker,
    private passwordHasher: PasswordHasher,
    private notificationService: NotificationService
  ) {}

  /**
   * Create new user
   */
  async create(context: AuthContext, request: CreateUserRequest): Promise<User> {
    // Check permission
    await this.checkPermission(context, PermissionBuilder.user(ActionType.CREATE));

    // Check if user already exists
    const existingByUsername = await this.query.execute<any>(
      'SELECT id FROM users WHERE username = $1',
      [request.username]
    );
    if (existingByUsername.length > 0) {
      throw new UserAlreadyExistsError(request.username);
    }

    const existingByEmail = await this.query.execute<any>(
      'SELECT id FROM users WHERE email = $1',
      [request.email]
    );
    if (existingByEmail.length > 0) {
      throw new UserAlreadyExistsError(request.email);
    }

    // Hash password (would be stored with user in production)
    // TODO: Handle password hashing in projection or separate process
    // const hashedPassword = await this.passwordHasher.hash(request.password);

    // Create user command
    const userId = generateId();
    const command = new CreateUserCommand(
      request.username,
      request.email,
      request.firstName,
      request.lastName,
      request.phone,
      {
        userId: context.subject.userId,
        instanceId: context.instanceId,
      }
    );
    command.aggregateId = userId;

    // Execute command
    await this.commandBus.execute(command);

    // Send welcome notification
    try {
      await this.notificationService.sendFromTemplate(
        'welcome_email',
        request.email,
        {
          username: request.username,
          appName: 'Zitadel',
        }
      );
    } catch (error) {
      // Log but don't fail
      console.error('Failed to send welcome email:', error);
    }

    // Return created user
    return this.getById(context, userId) as Promise<User>;
  }

  /**
   * Get user by ID
   */
  async getById(context: AuthContext, userId: string): Promise<User | null> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.READ, userId));

    const user = await this.query.findById<User>('users', userId);
    return user;
  }

  /**
   * Get user by username
   */
  async getByUsername(context: AuthContext, username: string): Promise<User | null> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.READ));

    const users = await this.query.execute<User>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Get user by email
   */
  async getByEmail(context: AuthContext, email: string): Promise<User | null> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.READ));

    const users = await this.query.execute<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return users.length > 0 ? users[0] : null;
  }

  /**
   * List users
   */
  async list(context: AuthContext, options?: UserListOptions): Promise<User[]> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.LIST));

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // Build query based on filters
    let query = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.filters?.username) {
      query += ` AND username LIKE $${paramIndex}`;
      params.push(`%${options.filters.username}%`);
      paramIndex++;
    }

    if (options?.filters?.email) {
      query += ` AND email LIKE $${paramIndex}`;
      params.push(`%${options.filters.email}%`);
      paramIndex++;
    }

    if (options?.filters?.orgId) {
      query += ` AND org_id = $${paramIndex}`;
      params.push(options.filters.orgId);
      paramIndex++;
    }

    if (options?.filters?.state) {
      query += ` AND state = $${paramIndex}`;
      params.push(options.filters.state);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const users = await this.query.execute<User>(query, params);
    return users;
  }

  /**
   * Update user
   */
  async update(context: AuthContext, userId: string, request: UpdateUserRequest): Promise<User> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.UPDATE, userId));

    const user = await this.getById(context, userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const command = new UpdateUserCommand(
      userId,
      request.email,
      request.firstName,
      request.lastName,
      {
        userId: context.subject.userId,
        instanceId: context.instanceId,
      }
    );

    await this.commandBus.execute(command);

    return this.getById(context, userId) as Promise<User>;
  }

  /**
   * Delete user
   */
  async delete(context: AuthContext, userId: string): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.DELETE, userId));

    const user = await this.getById(context, userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Deactivate instead of hard delete
    await this.deactivate(context, userId);
  }

  /**
   * Activate user
   */
  async activate(context: AuthContext, userId: string): Promise<User> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.UPDATE, userId));

    // Implementation would dispatch an activate command
    // For now, simulate by returning user
    return this.getById(context, userId) as Promise<User>;
  }

  /**
   * Deactivate user
   */
  async deactivate(context: AuthContext, userId: string): Promise<User> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.UPDATE, userId));

    const command = new DeactivateUserCommand(
      userId,
      {
        userId: context.subject.userId,
        instanceId: context.instanceId,
      }
    );

    await this.commandBus.execute(command);

    return this.getById(context, userId) as Promise<User>;
  }

  /**
   * Change user password
   */
  async changePassword(
    context: AuthContext,
    userId: string,
    request: ChangePasswordRequest
  ): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.UPDATE, userId));

    const users = await this.query.execute<any>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (users.length === 0) {
      throw new UserNotFoundError(userId);
    }

    // Verify current password
    const valid = await this.passwordHasher.verify(
      request.currentPassword,
      users[0].password_hash
    );
    if (!valid) {
      throw new InvalidPasswordError('Current password is incorrect');
    }

    // Hash new password
    const newHash = await this.passwordHasher.hash(request.newPassword);

    // Update password (would dispatch command in production)
    await this.query.execute(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId]
    );
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const users = await this.query.execute<any>(
      'SELECT id, username FROM users WHERE email = $1',
      [email]
    );

    if (users.length === 0) {
      // Don't reveal if user exists
      return;
    }

    // Generate reset token
    const resetToken = generateId();

    // Store token (in production, store in database with expiration)
    // For now, send notification with token
    await this.notificationService.sendFromTemplate(
      'password_reset',
      email,
      {
        username: users[0].username,
        resetLink: `https://app.zitadel.com/reset-password?token=${resetToken}`,
      }
    );
  }

  /**
   * Reset password with token
   */
  async resetPassword(_request: ResetPasswordRequest): Promise<void> {
    // Verify token (in production, check database)
    // For now, simulate token validation
    
    // Hash new password and update (would use proper token lookup)
    // This is a simplified implementation
    // const newHash = await this.passwordHasher.hash(request.newPassword);
  }

  /**
   * Setup MFA for user
   */
  async setupMfa(
    context: AuthContext,
    userId: string,
    _request: SetupMfaRequest
  ): Promise<{ secret: string }> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.UPDATE, userId));

    // Generate MFA secret (in production, use proper TOTP library)
    const secret = generateId();

    // Store secret (would dispatch command in production)
    return { secret };
  }

  /**
   * Verify MFA setup
   */
  async verifyMfa(context: AuthContext, userId: string, _code: string): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.UPDATE, userId));

    // Verify code and enable MFA (would dispatch command in production)
  }

  /**
   * Disable MFA
   */
  async disableMfa(context: AuthContext, userId: string): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.user(ActionType.UPDATE, userId));

    // Disable MFA (would dispatch command in production)
  }

  /**
   * Assign role to user
   */
  async assignRole(context: AuthContext, _userId: string, _roleId: string): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.role(ActionType.UPDATE));

    // Assign role (would dispatch command in production)
  }

  /**
   * Remove role from user
   */
  async removeRole(context: AuthContext, _userId: string, _roleId: string): Promise<void> {
    await this.checkPermission(context, PermissionBuilder.role(ActionType.UPDATE));

    // Remove role (would dispatch command in production)
  }

  /**
   * Check permission
   */
  private async checkPermission(context: AuthContext, permission: any): Promise<void> {
    const result = await this.permissionChecker.check(context, permission);
    if (!result.allowed) {
      throw new Error(`Permission denied: ${result.reason}`);
    }
  }
}

/**
 * Create user service
 */
export function createUserService(
  commandBus: CommandBus,
  query: Query,
  permissionChecker: PermissionChecker,
  passwordHasher: PasswordHasher,
  notificationService: NotificationService
): UserService {
  return new DefaultUserService(
    commandBus,
    query,
    permissionChecker,
    passwordHasher,
    notificationService
  );
}
