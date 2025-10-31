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
  SetUserProfileRequest,
  SetUserProfileResponse,
  SetUserEmailRequest,
  SetUserEmailResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  SetUserPhoneRequest,
  SetUserPhoneResponse,
  VerifyPhoneRequest,
  VerifyPhoneResponse,
  RemoveUserPhoneRequest,
  RemoveUserPhoneResponse,
  ResendEmailCodeRequest,
  ResendEmailCodeResponse,
  ResendPhoneCodeRequest,
  ResendPhoneCodeResponse,
  AddOTPSMSRequest,
  AddOTPSMSResponse,
  RemoveOTPSMSRequest,
  RemoveOTPSMSResponse,
  AddOTPEmailRequest,
  AddOTPEmailResponse,
  RemoveOTPEmailRequest,
  RemoveOTPEmailResponse,
  AddTOTPRequest,
  AddTOTPResponse,
  VerifyTOTPRequest,
  VerifyTOTPResponse,
  RemoveTOTPRequest,
  RemoveTOTPResponse,
  AddU2FRequest,
  AddU2FResponse,
  VerifyU2FRequest,
  VerifyU2FResponse,
  AddPasswordlessRequest,
  AddPasswordlessResponse,
  VerifyPasswordlessRequest,
  VerifyPasswordlessResponse,
  RemovePasswordlessRequest,
  RemovePasswordlessResponse,
  SetUserMetadataRequest,
  SetUserMetadataResponse,
  BulkSetUserMetadataRequest,
  BulkSetUserMetadataResponse,
  ListUserMetadataRequest,
  ListUserMetadataResponse,
  GetUserMetadataRequest,
  GetUserMetadataResponse,
  RemoveUserMetadataRequest,
  RemoveUserMetadataResponse,
  Metadata,
  AddUserGrantRequest,
  AddUserGrantResponse,
  UpdateUserGrantRequest,
  UpdateUserGrantResponse,
  RemoveUserGrantRequest,
  RemoveUserGrantResponse,
  ListUserGrantsRequest,
  ListUserGrantsResponse,
  UserGrant,
} from '../../proto/user/v2/user_service';
import { 
  userToGetUserResponse,
  userListToListUsersResponse,
  objectDetailsToDetailsProto,
} from './converters';
import { throwNotFound, throwInvalidArgument } from '../../../../zerrors/errors';
import { UserMetadataQueries } from '../../../../lib/query/user/user-metadata-queries';
import { UserGrantQueries } from '../../../../lib/query/user-grant/user-grant-queries';

/**
 * User Service
 */
export class UserService {
  private readonly queries: UserQueries;
  private readonly metadataQueries: UserMetadataQueries;
  private readonly grantQueries: UserGrantQueries;

  constructor(
    private readonly commands: Commands,
    pool: DatabasePool
  ) {
    this.queries = new UserQueries(pool);
    this.metadataQueries = new UserMetadataQueries(pool);
    this.grantQueries = new UserGrantQueries(pool);
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

  /**
   * SetUserProfile - Update user profile information
   */
  async setUserProfile(
    ctx: Context,
    request: SetUserProfileRequest
  ): Promise<SetUserProfileResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-010');
    }

    // Build profile data (only include provided fields)
    const profileData: any = {};
    if (request.givenName !== undefined) profileData.firstName = request.givenName;
    if (request.familyName !== undefined) profileData.lastName = request.familyName;
    if (request.nickName !== undefined) profileData.nickname = request.nickName;
    if (request.displayName !== undefined) profileData.displayName = request.displayName;
    if (request.preferredLanguage !== undefined) profileData.preferredLanguage = request.preferredLanguage;
    if (request.gender !== undefined) profileData.gender = this.mapGenderToString(request.gender);

    // Execute command
    await this.commands.changeProfile(ctx, request.userId, ctx.orgID, profileData);

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
   * SetUserEmail - Change user email address
   */
  async setUserEmail(
    ctx: Context,
    request: SetUserEmailRequest
  ): Promise<SetUserEmailResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-011');
    }
    if (!request.email) {
      throwInvalidArgument('email is required', 'USERv2-012');
    }

    // Execute command
    await this.commands.changeEmail(
      ctx,
      request.userId,
      ctx.orgID,
      request.email
    );

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
   * VerifyEmail - Verify user email with code
   */
  async verifyEmail(
    ctx: Context,
    request: VerifyEmailRequest
  ): Promise<VerifyEmailResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-013');
    }
    if (!request.verificationCode) {
      throwInvalidArgument('verificationCode is required', 'USERv2-014');
    }

    // Execute command
    await this.commands.verifyEmail(ctx, request.userId, ctx.orgID);

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
   * SetUserPhone - Change user phone number
   */
  async setUserPhone(
    ctx: Context,
    request: SetUserPhoneRequest
  ): Promise<SetUserPhoneResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-015');
    }
    if (!request.phone) {
      throwInvalidArgument('phone is required', 'USERv2-016');
    }

    // Execute command
    await this.commands.changePhone(
      ctx,
      request.userId,
      ctx.orgID,
      request.phone
    );

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
   * VerifyPhone - Verify user phone with code
   */
  async verifyPhone(
    ctx: Context,
    request: VerifyPhoneRequest
  ): Promise<VerifyPhoneResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-017');
    }
    if (!request.verificationCode) {
      throwInvalidArgument('verificationCode is required', 'USERv2-018');
    }

    // Execute command
    await this.commands.verifyPhone(ctx, request.userId, ctx.orgID);

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
   * RemoveUserPhone - Remove user phone
   */
  async removeUserPhone(
    ctx: Context,
    request: RemoveUserPhoneRequest
  ): Promise<RemoveUserPhoneResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-019');
    }

    // Execute command
    await this.commands.removePhone(ctx, request.userId, ctx.orgID);

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
   * ResendEmailCode - Resend email verification code
   * Note: This is a stub - full implementation requires notification system
   */
  async resendEmailCode(
    ctx: Context,
    request: ResendEmailCodeRequest
  ): Promise<ResendEmailCodeResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-020');
    }

    // TODO: Implement notification system integration
    // For now, just return success
    console.log(`Resend email code requested for user ${request.userId}`);

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * ResendPhoneCode - Resend phone verification code
   * Note: This is a stub - full implementation requires notification system
   */
  async resendPhoneCode(
    ctx: Context,
    request: ResendPhoneCodeRequest
  ): Promise<ResendPhoneCodeResponse> {
    // Validate request
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-021');
    }

    // TODO: Implement notification system integration
    // For now, just return success
    console.log(`Resend phone code requested for user ${request.userId}`);

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  // ====================================================================
  // Auth Factors - OTP SMS
  // ====================================================================

  /**
   * AddOTPSMS - Enable SMS OTP authentication
   */
  async addOTPSMS(
    ctx: Context,
    request: AddOTPSMSRequest
  ): Promise<AddOTPSMSResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-022');
    }

    await this.commands.addHumanOTPSMS(ctx, request.userId, ctx.orgID);

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * RemoveOTPSMS - Disable SMS OTP authentication
   */
  async removeOTPSMS(
    ctx: Context,
    request: RemoveOTPSMSRequest
  ): Promise<RemoveOTPSMSResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-023');
    }

    await this.commands.removeHumanOTPSMS(ctx, request.userId, ctx.orgID);

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  // ====================================================================
  // Auth Factors - OTP Email
  // ====================================================================

  /**
   * AddOTPEmail - Enable Email OTP authentication
   */
  async addOTPEmail(
    ctx: Context,
    request: AddOTPEmailRequest
  ): Promise<AddOTPEmailResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-024');
    }

    await this.commands.addHumanOTPEmail(ctx, request.userId, ctx.orgID);

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * RemoveOTPEmail - Disable Email OTP authentication
   */
  async removeOTPEmail(
    ctx: Context,
    request: RemoveOTPEmailRequest
  ): Promise<RemoveOTPEmailResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-025');
    }

    await this.commands.removeHumanOTPEmail(ctx, request.userId, ctx.orgID);

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  // ====================================================================
  // Auth Factors - TOTP
  // ====================================================================

  /**
   * AddTOTP - Register TOTP authenticator (generates secret)
   */
  async addTOTP(
    ctx: Context,
    request: AddTOTPRequest
  ): Promise<AddTOTPResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-026');
    }

    const result = await this.commands.addHumanTOTP(ctx, request.userId, ctx.orgID);

    return {
      uri: result.uri,
      secret: result.secret,
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * VerifyTOTP - Verify TOTP setup with code
   */
  async verifyTOTP(
    ctx: Context,
    request: VerifyTOTPRequest
  ): Promise<VerifyTOTPResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-027');
    }
    if (!request.code) {
      throwInvalidArgument('code is required', 'USERv2-028');
    }

    await this.commands.humanCheckMFATOTPSetup(ctx, request.userId, ctx.orgID, request.code);

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * RemoveTOTP - Remove TOTP authenticator
   */
  async removeTOTP(
    ctx: Context,
    request: RemoveTOTPRequest
  ): Promise<RemoveTOTPResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-029');
    }

    await this.commands.humanRemoveTOTP(ctx, request.userId, ctx.orgID);

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  // ====================================================================
  // Auth Factors - U2F
  // ====================================================================

  /**
   * AddU2F - Begin U2F registration
   */
  async addU2F(
    ctx: Context,
    request: AddU2FRequest
  ): Promise<AddU2FResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-030');
    }

    const result = await this.commands.humanAddU2FSetup(ctx, request.userId, ctx.orgID);

    // Serialize token data for WebAuthn client
    const credentialOptions = {
      challenge: result.challenge,
      rp: { id: result.rpID, name: 'Zitadel' },
      user: { id: request.userId, name: request.userId, displayName: request.userId },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      timeout: 60000,
      attestation: 'direct'
    };

    return {
      keyId: String(result.keyID || result.webAuthNTokenID),
      publicKeyCredentialCreationOptions: JSON.stringify(credentialOptions),
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * VerifyU2F - Complete U2F registration
   */
  async verifyU2F(
    ctx: Context,
    request: VerifyU2FRequest
  ): Promise<VerifyU2FResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-031');
    }
    if (!request.keyId) {
      throwInvalidArgument('keyId is required', 'USERv2-032');
    }
    if (!request.publicKeyCredential) {
      throwInvalidArgument('publicKeyCredential is required', 'USERv2-033');
    }

    // Parse and convert publicKeyCredential from JSON string to Uint8Array
    const credentialData = new Uint8Array(Buffer.from(JSON.parse(request.publicKeyCredential).response.attestationObject, 'base64'));
    
    await this.commands.humanVerifyU2FSetup(
      ctx,
      request.userId,
      ctx.orgID,
      request.tokenName,
      credentialData
    );

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

// ====================================================================
// Auth Factors - Passwordless
// ====================================================================

/**
 * AddPasswordless - Begin passwordless registration
 */
async addPasswordless(
  ctx: Context,
  request: AddPasswordlessRequest
): Promise<AddPasswordlessResponse> {
  if (!request.userId) {
    throwInvalidArgument('userId is required', 'USERv2-037');
  }

  const result = await this.commands.humanAddPasswordlessSetup(ctx, request.userId, ctx.orgID);

  // Serialize token data for WebAuthn client
  const credentialOptions = {
    challenge: result.challenge,
    rp: { id: result.rpID, name: 'Zitadel' },
    user: { id: request.userId, name: request.userId, displayName: request.userId },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    authenticatorSelection: { userVerification: 'required', residentKey: 'required' },
    timeout: 60000,
    attestation: 'direct'
  };

    return {
      keyId: String(result.keyID || result.webAuthNTokenID),
      publicKeyCredentialCreationOptions: JSON.stringify(credentialOptions),
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * VerifyPasswordless - Complete passwordless registration
   */
  async verifyPasswordless(
    ctx: Context,
    request: VerifyPasswordlessRequest
  ): Promise<VerifyPasswordlessResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-038');
    }
    if (!request.keyId) {
      throwInvalidArgument('keyId is required', 'USERv2-039');
    }
    if (!request.publicKeyCredential) {
      throwInvalidArgument('publicKeyCredential is required', 'USERv2-040');
    }

    // Parse and convert publicKeyCredential from JSON string to Uint8Array
    const credentialData = new Uint8Array(Buffer.from(JSON.parse(request.publicKeyCredential).response.attestationObject, 'base64'));
    
    await this.commands.humanHumanPasswordlessSetup(
      ctx,
      request.userId,
      ctx.orgID,
      request.tokenName,
      credentialData
    );

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * RemovePasswordless - Remove passwordless token
   */
  async removePasswordless(
    ctx: Context,
    request: RemovePasswordlessRequest
  ): Promise<RemovePasswordlessResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-042');
    }
    if (!request.passwordlessTokenId) {
      throwInvalidArgument('passwordlessTokenId is required', 'USERv2-043');
    }

    await this.commands.humanRemovePasswordless(
      ctx,
      request.userId,
      ctx.orgID,
      request.passwordlessTokenId
    );

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  // ====================================================================
  // User Metadata
  // ====================================================================

  /**
   * SetUserMetadata - Set single metadata key-value
   */
  async setUserMetadata(
    ctx: Context,
    request: SetUserMetadataRequest
  ): Promise<SetUserMetadataResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-044');
    }
    if (!request.key) {
      throwInvalidArgument('key is required', 'USERv2-045');
    }
    if (!request.value) {
      throwInvalidArgument('value is required', 'USERv2-046');
    }

    await this.commands.setUserMetadata(
      ctx,
      request.userId,
      ctx.orgID,
      {
        key: request.key,
        value: request.value,
      }
    );

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * BulkSetUserMetadata - Set multiple metadata key-values
   */
  async bulkSetUserMetadata(
    ctx: Context,
    request: BulkSetUserMetadataRequest
  ): Promise<BulkSetUserMetadataResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-047');
    }
    if (!request.metadata || request.metadata.length === 0) {
      throwInvalidArgument('metadata is required', 'USERv2-048');
    }

    // Validate all metadata entries
    for (const entry of request.metadata) {
      if (!entry.key) {
        throwInvalidArgument('metadata key is required', 'USERv2-049');
      }
      if (!entry.value) {
        throwInvalidArgument('metadata value is required', 'USERv2-050');
      }
    }

    await this.commands.bulkSetUserMetadata(
      ctx,
      request.userId,
      ctx.orgID,
      request.metadata
    );

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * ListUserMetadata - List all metadata for a user
   */
  async listUserMetadata(
    ctx: Context,
    request: ListUserMetadataRequest
  ): Promise<ListUserMetadataResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-051');
    }

    // Get all metadata for user
    const metadataList = await this.metadataQueries.getUserMetadataList(
      request.userId,
      ctx.instanceID
    );

    // Filter by query if provided
    let filteredList = metadataList;
    if (request.queries && request.queries.length > 0) {
      const keyQuery = request.queries[0]?.keyQuery;
      if (keyQuery) {
        filteredList = metadataList.filter(m => 
          m.metadataKey.includes(keyQuery)
        );
      }
    }

    // Convert to proto format
    const result: Metadata[] = filteredList.map(m => ({
      key: m.metadataKey,
      value: typeof m.metadataValue === 'string' 
        ? m.metadataValue 
        : JSON.stringify(m.metadataValue),
      creationDate: m.createdAt,
      changeDate: m.updatedAt,
    }));

    return {
      details: {
        totalResult: result.length,
        processedSequence: 0,
        viewTimestamp: new Date(),
      },
      result,
    };
  }

  /**
   * GetUserMetadata - Get specific metadata by key
   */
  async getUserMetadata(
    ctx: Context,
    request: GetUserMetadataRequest
  ): Promise<GetUserMetadataResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-052');
    }
    if (!request.key) {
      throwInvalidArgument('key is required', 'USERv2-053');
    }

    const metadata = await this.metadataQueries.getUserMetadata(
      request.userId,
      ctx.instanceID,
      request.key
    );

    if (!metadata) {
      throwNotFound('Metadata not found', 'USERv2-054');
    }

    return {
      metadata: {
        key: metadata.metadataKey,
        value: typeof metadata.metadataValue === 'string'
          ? metadata.metadataValue
          : JSON.stringify(metadata.metadataValue),
        creationDate: metadata.createdAt,
        changeDate: metadata.updatedAt,
      },
    };
  }

  /**
   * RemoveUserMetadata - Remove metadata by key
   */
  async removeUserMetadata(
    ctx: Context,
    request: RemoveUserMetadataRequest
  ): Promise<RemoveUserMetadataResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-055');
    }
    if (!request.key) {
      throwInvalidArgument('key is required', 'USERv2-056');
    }

    await this.commands.removeUserMetadata(
      ctx,
      request.userId,
      ctx.orgID,
      request.key
    );

    return {
      details: objectDetailsToDetailsProto({
        sequence: 0,
        changeDate: new Date(),
        resourceOwner: ctx.orgID || ctx.instanceID,
      }),
    };
  }

  // ====================================================================
  // User Grants
  // ====================================================================

  /**
   * AddUserGrant - Grant user access to a project
   */
  async addUserGrant(
    ctx: Context,
    request: AddUserGrantRequest
  ): Promise<AddUserGrantResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-057');
    }
    if (!request.projectId) {
      throwInvalidArgument('projectId is required', 'USERv2-058');
    }
    if (!request.roleKeys || request.roleKeys.length === 0) {
      throwInvalidArgument('roleKeys is required', 'USERv2-059');
    }

    const result = await this.commands.addUserGrant(ctx, {
      userID: request.userId,
      projectID: request.projectId,
      projectGrantID: request.projectGrantId,
      roleKeys: request.roleKeys,
    });

    return {
      userGrantId: result.grantID,
      details: objectDetailsToDetailsProto({
        sequence: Number(result.sequence || 0),
        changeDate: result.eventDate || new Date(),
        resourceOwner: result.resourceOwner || ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * UpdateUserGrant - Update user grant roles
   */
  async updateUserGrant(
    ctx: Context,
    request: UpdateUserGrantRequest
  ): Promise<UpdateUserGrantResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-060');
    }
    if (!request.grantId) {
      throwInvalidArgument('grantId is required', 'USERv2-061');
    }
    if (!request.roleKeys || request.roleKeys.length === 0) {
      throwInvalidArgument('roleKeys is required', 'USERv2-062');
    }

    const result = await this.commands.changeUserGrant(ctx, {
      grantID: request.grantId,
      roleKeys: request.roleKeys,
    });

    return {
      details: objectDetailsToDetailsProto({
        sequence: Number(result.sequence || 0),
        changeDate: result.eventDate || new Date(),
        resourceOwner: result.resourceOwner || ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * RemoveUserGrant - Remove user grant
   */
  async removeUserGrant(
    ctx: Context,
    request: RemoveUserGrantRequest
  ): Promise<RemoveUserGrantResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-063');
    }
    if (!request.grantId) {
      throwInvalidArgument('grantId is required', 'USERv2-064');
    }

    const result = await this.commands.removeUserGrant(ctx, request.grantId);

    return {
      details: objectDetailsToDetailsProto({
        sequence: Number(result.sequence || 0),
        changeDate: result.eventDate || new Date(),
        resourceOwner: result.resourceOwner || ctx.orgID || ctx.instanceID,
      }),
    };
  }

  /**
   * ListUserGrants - List grants for a user
   */
  async listUserGrants(
    ctx: Context,
    request: ListUserGrantsRequest
  ): Promise<ListUserGrantsResponse> {
    if (!request.userId) {
      throwInvalidArgument('userId is required', 'USERv2-065');
    }

    // Build search query
    let projectID: string | undefined;
    if (request.queries && request.queries.length > 0) {
      projectID = request.queries[0]?.projectIdQuery;
    }

    // Get user grants
    const grants = await this.grantQueries.getUserGrantsByUserID(
      request.userId,
      ctx.instanceID
    );

    // Filter by project if specified
    let filteredGrants = grants;
    if (projectID) {
      filteredGrants = grants.filter(g => g.projectID === projectID);
    }

    // Convert to proto format
    const result: UserGrant[] = filteredGrants.map(g => ({
      id: g.id,
      userId: g.userID,
      projectId: g.projectID,
      projectGrantId: g.projectGrantID,
      roles: g.roles,
      orgId: g.resourceOwner,
      orgName: g.orgName,
      projectName: g.projectName,
      creationDate: g.creationDate,
      changeDate: g.changeDate,
    }));

    return {
      details: {
        totalResult: result.length,
        processedSequence: Number(grants[0]?.sequence || 0),
        viewTimestamp: new Date(),
      },
      result,
    };
  }

  /**
   * Helper: Map Gender enum to string
   */
  private mapGenderToString(gender: number): string {
    switch (gender) {
      case 1: return 'female';
      case 2: return 'male';
      case 3: return 'diverse';
      default: return 'unspecified';
    }
  }
}
