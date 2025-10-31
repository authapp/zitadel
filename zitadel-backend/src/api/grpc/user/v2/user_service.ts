/**
 * User Service Implementation (v2)
 * 
 * gRPC service handlers for user management
 * Based on: internal/api/grpc/user/v2/user.go
 */

import { Commands } from '../../../../lib/command/commands';
import { Context } from '../../../../lib/command/context';
import { UserQueries } from '../../../../lib/query/user/user-queries';
import { DatabasePool } from '../../../../lib/database';
import { 
  GetUserByIDRequest,
  GetUserByIDResponse,
  ListUsersRequest,
  ListUsersResponse,
  UpdateUserNameRequest,
  UpdateUserNameResponse,
  DeactivateUserRequest,
  DeactivateUserResponse,
  ReactivateUserRequest,
  ReactivateUserResponse,
  RemoveUserRequest,
  RemoveUserResponse,
  LockUserRequest,
  LockUserResponse,
  UnlockUserRequest,
  UnlockUserResponse,
} from '../../proto/user/v2/user_service';
import { 
  userToGetUserResponse,
  userListToListUsersResponse,
  objectDetailsToDetailsProto,
} from './converters';
import { throwNotFound, throwInvalidArgument } from '../../../../zerrors/errors';

/**
 * User Service
 */
export class UserService {
  private readonly queries: UserQueries;

  constructor(
    private readonly commands: Commands,
    pool: DatabasePool
  ) {
    this.queries = new UserQueries(pool);
  }

  /**
   * GetUserByID - Get user by ID
   */
  async getUserByID(
    ctx: Context,
    request: GetUserByIDRequest
  ): Promise<GetUserByIDResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-001');
    }

    // Query user
    const user = await this.queries.getUserByID(request.userId, ctx.instanceID);
    
    if (!user) {
      throwNotFound(`user ${request.userId} not found`, 'USERv2-002');
    }

    // Convert to response
    return userToGetUserResponse(user);
  }

  /**
   * ListUsers - Search for users
   */
  async listUsers(
    ctx: Context,
    request: ListUsersRequest
  ): Promise<ListUsersResponse> {
    // Build query options
    const limit = request.limit || 50;
    const offset = request.offset || 0;

    // Query users
    const result = await this.queries.searchUsers({
      limit,
      offset,
      // TODO: Parse request.queries to build filter
      filter: undefined,
    }, ctx.instanceID);

    // Convert to response
    return userListToListUsersResponse(result, request);
  }

  /**
   * UpdateUserName - Update user username
   */
  async updateUserName(
    ctx: Context,
    request: UpdateUserNameRequest
  ): Promise<UpdateUserNameResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-003');
    }

    if (!request.userName || request.userName.trim().length === 0) {
      throwInvalidArgument('userName is required', 'USERv2-004');
    }

    // Execute command
    await this.commands.changeUsername(ctx, request.userId, ctx.orgID, request.userName);

    // Return success response
    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * DeactivateUser - Deactivate user account
   */
  async deactivateUser(
    ctx: Context,
    request: DeactivateUserRequest
  ): Promise<DeactivateUserResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-005');
    }

    // Execute command
    await this.commands.deactivateUser(ctx, request.userId, ctx.orgID);

    // Return success response
    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * ReactivateUser - Reactivate user account
   */
  async reactivateUser(
    ctx: Context,
    request: ReactivateUserRequest
  ): Promise<ReactivateUserResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-006');
    }

    // Execute command
    await this.commands.reactivateUser(ctx, request.userId, ctx.orgID);

    // Return success response
    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * RemoveUser - Remove user account
   */
  async removeUser(
    ctx: Context,
    request: RemoveUserRequest
  ): Promise<RemoveUserResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-007');
    }

    // Execute command
    await this.commands.removeUser(ctx, request.userId, ctx.orgID);

    // Return success response
    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * LockUser - Lock user account
   */
  async lockUser(
    ctx: Context,
    request: LockUserRequest
  ): Promise<LockUserResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-008');
    }

    // Execute command
    await this.commands.lockUser(ctx, request.userId, ctx.orgID);

    // Return success response
    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * UnlockUser - Unlock user account
   */
  async unlockUser(
    ctx: Context,
    request: UnlockUserRequest
  ): Promise<UnlockUserResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-009');
    }

    // Execute command
    await this.commands.unlockUser(ctx, request.userId, ctx.orgID);

    // Return success response
    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }
}
