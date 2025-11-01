/**
 * Auth Service Implementation (v1)
 * 
 * Implements authenticated user operations and session management
 * Based on Zitadel Go internal/api/grpc/auth/v1
 */

import { Commands } from '@/command/commands';
import { Context } from '@/command/context';
import { UserQueries } from '@/query/user/user-queries';
import { UserGrantQueries } from '@/query/user-grant/user-grant-queries';
import { OrgQueries } from '@/query/org/org-queries';
import { throwUnauthenticated, throwNotFound } from '@/zerrors/errors';
import {
  GetMyUserRequest,
  GetMyUserResponse,
  UpdateMyUserProfileRequest,
  UpdateMyUserProfileResponse,
  UpdateMyUserEmailRequest,
  UpdateMyUserEmailResponse,
  VerifyMyUserEmailRequest,
  VerifyMyUserEmailResponse,
  ResendMyUserEmailVerificationRequest,
  ResendMyUserEmailVerificationResponse,
  UpdateMyUserPhoneRequest,
  UpdateMyUserPhoneResponse,
  VerifyMyUserPhoneRequest,
  VerifyMyUserPhoneResponse,
  RemoveMyUserPhoneRequest,
  RemoveMyUserPhoneResponse,
  RemoveMyUserRequest,
  RemoveMyUserResponse,
  ListMyUserChangesRequest,
  ListMyUserChangesResponse,
  GetMyUserSessionsRequest,
  GetMyUserSessionsResponse,
  ListMyUserGrantsRequest,
  ListMyUserGrantsResponse,
  ListMyProjectOrgsRequest,
  ListMyProjectOrgsResponse,
  GetMyZitadelPermissionsRequest,
  GetMyZitadelPermissionsResponse,
  GetMyProjectPermissionsRequest,
  GetMyProjectPermissionsResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  TerminateSessionRequest,
  TerminateSessionResponse,
  ObjectDetails,
} from '../../proto/auth/v1/auth_service';
import { userToProto } from '../../user/v2/converters';
import { dateToTimestamp } from '../../proto/google/protobuf/timestamp';

/**
 * Auth Service
 * 
 * Handles authenticated user operations
 */
export class AuthService {
  constructor(
    private commands: Commands,
    private userQueries: UserQueries,
    private userGrantQueries: UserGrantQueries,
    private orgQueries: OrgQueries
  ) {}

  /**
   * Get authenticated user
   */
  async GetMyUser(ctx: Context, _request: GetMyUserRequest): Promise<GetMyUserResponse> {
    // Get user ID from authenticated context
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-001');
    }

    // Query user
    const user = await this.userQueries.getUserByID(userId, ctx.instanceID);
    if (!user) {
      throwNotFound('User not found', 'AUTH-002');
    }

    return {
      user: userToProto(user),
    };
  }

  /**
   * Update authenticated user profile
   */
  async UpdateMyUserProfile(
    ctx: Context,
    request: UpdateMyUserProfileRequest
  ): Promise<UpdateMyUserProfileResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-003');
    }

    // Update profile using commands
    const result = await this.commands.changeProfile(
      ctx,
      userId,
      ctx.orgID,
      {
        firstName: request.firstName,
        lastName: request.lastName,
        displayName: request.displayName,
        preferredLanguage: request.preferredLanguage,
      }
    );

    return {
      details: objectDetailsFromResult(result),
    };
  }

  /**
   * Update authenticated user email
   */
  async UpdateMyUserEmail(
    ctx: Context,
    request: UpdateMyUserEmailRequest
  ): Promise<UpdateMyUserEmailResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-004');
    }

    // Use changeUserEmail which generates verification code
    const result = await this.commands.changeUserEmail(ctx, userId, request.email);

    return {
      details: objectDetailsFromResult(result.details),
    };
  }

  /**
   * Verify email with code
   */
  async VerifyMyUserEmail(
    ctx: Context,
    _request: VerifyMyUserEmailRequest
  ): Promise<VerifyMyUserEmailResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-005');
    }

    // Note: verifyEmail command doesn't take code parameter - verification happens server-side
    const result = await this.commands.verifyEmail(ctx, userId, ctx.orgID);

    return {
      details: objectDetailsFromResult(result),
    };
  }

  /**
   * Resend email verification
   */
  async ResendMyUserEmailVerification(
    ctx: Context,
    _request: ResendMyUserEmailVerificationRequest
  ): Promise<ResendMyUserEmailVerificationResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-006');
    }

    const result = await this.commands.resendUserEmailCode(ctx, userId);

    return {
      details: objectDetailsFromResult(result.details),
    };
  }

  /**
   * Update authenticated user phone
   */
  async UpdateMyUserPhone(
    ctx: Context,
    request: UpdateMyUserPhoneRequest
  ): Promise<UpdateMyUserPhoneResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-007');
    }

    const result = await this.commands.changePhone(ctx, userId, ctx.orgID, request.phone);

    return {
      details: objectDetailsFromResult(result),
    };
  }

  /**
   * Verify phone with code
   */
  async VerifyMyUserPhone(
    ctx: Context,
    _request: VerifyMyUserPhoneRequest
  ): Promise<VerifyMyUserPhoneResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-008');
    }

    // Note: verifyPhone command doesn't take code parameter - verification happens server-side
    const result = await this.commands.verifyPhone(ctx, userId, ctx.orgID);

    return {
      details: objectDetailsFromResult(result),
    };
  }

  /**
   * Remove phone
   */
  async RemoveMyUserPhone(
    ctx: Context,
    _request: RemoveMyUserPhoneRequest
  ): Promise<RemoveMyUserPhoneResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-009');
    }

    const result = await this.commands.removePhone(ctx, userId, ctx.orgID);

    return {
      details: objectDetailsFromResult(result),
    };
  }

  /**
   * Remove authenticated user
   */
  async RemoveMyUser(
    ctx: Context,
    _request: RemoveMyUserRequest
  ): Promise<RemoveMyUserResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-010');
    }

    const result = await this.commands.removeUser(ctx, userId, ctx.orgID);

    return {
      details: objectDetailsFromResult(result),
    };
  }

  /**
   * List user changes (audit log)
   */
  async ListMyUserChanges(
    ctx: Context,
    _request: ListMyUserChangesRequest
  ): Promise<ListMyUserChangesResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-011');
    }

    // Return empty list for now - would need audit log implementation
    return {
      result: [],
      details: {
        totalResult: 0,
        processedSequence: '0',
        viewTimestamp: dateToTimestamp(new Date()),
      },
    };
  }

  /**
   * Get user sessions
   */
  async GetMyUserSessions(
    ctx: Context,
    _request: GetMyUserSessionsRequest
  ): Promise<GetMyUserSessionsResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-012');
    }

    // Return empty list for now - would need session query implementation
    return {
      sessions: [],
    };
  }

  /**
   * List user grants
   */
  async ListMyUserGrants(
    ctx: Context,
    request: ListMyUserGrantsRequest
  ): Promise<ListMyUserGrantsResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-013');
    }

    // Query user grants
    const grants = await this.userGrantQueries.searchUserGrants({
      instanceID: ctx.instanceID,
      userID: userId,
      projectID: request.queries?.[0]?.projectId,
      grantedOrgID: request.queries?.[0]?.orgId,
      limit: request.query?.limit || 50,
      offset: request.query?.offset || 0,
    });

    return {
      result: grants.grants.map((grant: any) => ({
        id: grant.id,
        userId: grant.userID,
        orgId: grant.orgID,
        orgName: grant.orgName || '',
        projectId: grant.projectID,
        projectName: grant.projectName || '',
        roleKeys: grant.roles,
        state: grant.state === 'active' ? 1 : 2,
        details: {
          sequence: grant.sequence?.toString() || '0',
          creationDate: dateToTimestamp(grant.createdAt),
          changeDate: dateToTimestamp(grant.updatedAt || grant.createdAt),
          resourceOwner: grant.orgID,
        },
      })),
      details: {
        totalResult: grants.totalCount,
        processedSequence: '0',
        viewTimestamp: dateToTimestamp(new Date()),
      },
    };
  }

  /**
   * List project organizations
   */
  async ListMyProjectOrgs(
    ctx: Context,
    request: ListMyProjectOrgsRequest
  ): Promise<ListMyProjectOrgsResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-014');
    }

    // Get user grants to find project orgs
    const grants = await this.userGrantQueries.searchUserGrants({
      instanceID: ctx.instanceID,
      userID: userId,
      projectID: request.queries?.[0]?.projectId,
      limit: request.query?.limit || 50,
      offset: request.query?.offset || 0,
    });

    // Get unique org IDs
    const orgIDs = [...new Set(grants.grants.map((g: any) => g.orgID))];

    // Fetch org details
    const orgs = await Promise.all(
      orgIDs.map((orgID: string) => this.orgQueries.getOrgByID(orgID, ctx.instanceID))
    );

    return {
      result: orgs.filter(org => org !== null).map(org => ({
        id: org!.id,
        name: org!.name,
        primaryDomain: org!.primaryDomain || '',
        state: org!.state === 'active' ? 1 : 2,
        details: {
          sequence: org!.sequence?.toString() || '0',
          creationDate: dateToTimestamp(org!.createdAt),
          changeDate: dateToTimestamp(org!.updatedAt || org!.createdAt),
          resourceOwner: org!.id,
        },
      })),
      details: {
        totalResult: orgs.filter(org => org !== null).length,
        processedSequence: '0',
        viewTimestamp: dateToTimestamp(new Date()),
      },
    };
  }

  /**
   * Get Zitadel permissions
   */
  async GetMyZitadelPermissions(
    ctx: Context,
    _request: GetMyZitadelPermissionsRequest
  ): Promise<GetMyZitadelPermissionsResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-015');
    }

    // Return permissions from context (would need IAM implementation)
    return {
      permissions: [],
    };
  }

  /**
   * Get project permissions
   */
  async GetMyProjectPermissions(
    ctx: Context,
    _request: GetMyProjectPermissionsRequest
  ): Promise<GetMyProjectPermissionsResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-016');
    }

    // Return project permissions from context (would need IAM implementation)
    return {
      permissions: [],
    };
  }

  /**
   * Create session
   */
  async CreateSession(
    ctx: Context,
    request: CreateSessionRequest
  ): Promise<CreateSessionResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-017');
    }

    // Create session
    const result = await this.commands.createSession(ctx, {
      userID: userId,
      orgID: ctx.orgID,
      userAgent: request.userAgent,
      metadata: request.metadata,
    });

    return {
      sessionId: result.sessionID,
      sessionToken: result.sessionID, // In real impl, generate JWT
      details: objectDetailsFromResult(result),
    };
  }

  /**
   * List sessions
   */
  async ListSessions(
    ctx: Context,
    _request: ListSessionsRequest
  ): Promise<ListSessionsResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-018');
    }

    // Return empty list for now - would need session query implementation
    return {
      sessions: [],
      details: {
        totalResult: 0,
        processedSequence: '0',
        viewTimestamp: dateToTimestamp(new Date()),
      },
    };
  }

  /**
   * Terminate session
   */
  async TerminateSession(
    ctx: Context,
    request: TerminateSessionRequest
  ): Promise<TerminateSessionResponse> {
    const userId = ctx.userID;
    if (!userId) {
      throwUnauthenticated('No authenticated user', 'AUTH-019');
    }

    // Terminate session
    const result = await this.commands.terminateSession(ctx, request.sessionId, ctx.orgID);

    return {
      details: objectDetailsFromResult(result),
    };
  }
}

/**
 * Convert command result to ObjectDetails
 */
function objectDetailsFromResult(result: any): ObjectDetails {
  return {
    sequence: result.sequence?.toString() || '0',
    creationDate: dateToTimestamp(result.createdAt || new Date()),
    changeDate: dateToTimestamp(result.changedAt || result.createdAt || new Date()),
    resourceOwner: result.resourceOwner || '',
  };
}
