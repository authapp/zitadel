/**
 * User service types
 */

import { User, UserState } from '../../domain/user';
import { AuthContext } from '../../authz/types';
import { MfaType } from '../../auth/types';

/**
 * Create user request
 */
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  orgId?: string;
  roles?: string[];
  metadata?: Record<string, any>;
}

/**
 * Update user request
 */
export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

/**
 * Change password request
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Reset password request
 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * Setup MFA request
 */
export interface SetupMfaRequest {
  type: MfaType;
  code?: string;
}

/**
 * User search filters
 */
export interface UserSearchFilters {
  username?: string;
  email?: string;
  orgId?: string;
  state?: UserState;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * User list options
 */
export interface UserListOptions {
  filters?: UserSearchFilters;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * User service interface
 */
export interface UserService {
  /**
   * Create new user
   */
  create(context: AuthContext, request: CreateUserRequest): Promise<User>;

  /**
   * Get user by ID
   */
  getById(context: AuthContext, userId: string): Promise<User | null>;

  /**
   * Get user by username
   */
  getByUsername(context: AuthContext, username: string): Promise<User | null>;

  /**
   * Get user by email
   */
  getByEmail(context: AuthContext, email: string): Promise<User | null>;

  /**
   * List users
   */
  list(context: AuthContext, options?: UserListOptions): Promise<User[]>;

  /**
   * Update user
   */
  update(context: AuthContext, userId: string, request: UpdateUserRequest): Promise<User>;

  /**
   * Delete user
   */
  delete(context: AuthContext, userId: string): Promise<void>;

  /**
   * Activate user
   */
  activate(context: AuthContext, userId: string): Promise<User>;

  /**
   * Deactivate user
   */
  deactivate(context: AuthContext, userId: string): Promise<User>;

  /**
   * Change user password
   */
  changePassword(context: AuthContext, userId: string, request: ChangePasswordRequest): Promise<void>;

  /**
   * Request password reset
   */
  requestPasswordReset(email: string): Promise<void>;

  /**
   * Reset password with token
   */
  resetPassword(request: ResetPasswordRequest): Promise<void>;

  /**
   * Setup MFA for user
   */
  setupMfa(context: AuthContext, userId: string, request: SetupMfaRequest): Promise<{ secret: string }>;

  /**
   * Verify MFA setup
   */
  verifyMfa(context: AuthContext, userId: string, code: string): Promise<void>;

  /**
   * Disable MFA
   */
  disableMfa(context: AuthContext, userId: string): Promise<void>;

  /**
   * Assign role to user
   */
  assignRole(context: AuthContext, userId: string, roleId: string): Promise<void>;

  /**
   * Remove role from user
   */
  removeRole(context: AuthContext, userId: string, roleId: string): Promise<void>;
}

/**
 * User service errors
 */
export class UserServiceError extends Error {
  constructor(message: string, public code: string = 'USER_SERVICE_ERROR') {
    super(message);
    this.name = 'UserServiceError';
  }
}

export class UserNotFoundError extends UserServiceError {
  constructor(userId: string) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
  }
}

export class UserAlreadyExistsError extends UserServiceError {
  constructor(identifier: string) {
    super(`User already exists: ${identifier}`, 'USER_ALREADY_EXISTS');
    this.name = 'UserAlreadyExistsError';
  }
}

export class InvalidPasswordError extends UserServiceError {
  constructor(message: string = 'Invalid password') {
    super(message, 'INVALID_PASSWORD');
    this.name = 'InvalidPasswordError';
  }
}
