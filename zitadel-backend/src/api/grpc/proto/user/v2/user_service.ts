/**
 * User Service Protocol Buffer Types (v2)
 * 
 * TypeScript definitions for user service gRPC messages
 * Based on: proto/zitadel/user/v2/user_service.proto
 */

import { Details, ListQuery } from '../../object/v2/object';

// User Types
export interface User {
  userId: string;
  state: UserState;
  username: string;
  loginNames: string[];
  preferredLoginName: string;
  type: UserType;
  human?: HumanUser;
  machine?: MachineUser;
}

export enum UserState {
  USER_STATE_UNSPECIFIED = 0,
  USER_STATE_ACTIVE = 1,
  USER_STATE_INACTIVE = 2,
  USER_STATE_DELETED = 3,
  USER_STATE_LOCKED = 4,
}

export enum UserType {
  USER_TYPE_UNSPECIFIED = 0,
  USER_TYPE_HUMAN = 1,
  USER_TYPE_MACHINE = 2,
}

export interface HumanUser {
  profile?: HumanProfile;
  email?: HumanEmail;
  phone?: HumanPhone;
}

export interface HumanProfile {
  givenName: string;
  familyName: string;
  nickName?: string;
  displayName?: string;
  preferredLanguage?: string;
  gender?: Gender;
  avatarUrl?: string;
}

export enum Gender {
  GENDER_UNSPECIFIED = 0,
  GENDER_FEMALE = 1,
  GENDER_MALE = 2,
  GENDER_DIVERSE = 3,
}

export interface HumanEmail {
  email: string;
  isVerified: boolean;
}

export interface HumanPhone {
  phone: string;
  isVerified: boolean;
}

export interface MachineUser {
  name: string;
  description?: string;
}

// Request/Response Types

export interface GetUserByIDRequest {
  userId: string;
}

export interface GetUserByIDResponse {
  user: User;
  details?: Details;
}

export interface ListUsersRequest {
  limit?: number;
  offset?: number;
  queries?: ListQuery[];
  sortingColumn?: string;
}

export interface ListUsersResponse {
  details?: {
    totalResult: number;
    processedSequence: number;
    timestamp: Date;
  };
  sortingColumn?: string;
  result: User[];
}

export interface UpdateUserNameRequest {
  userId: string;
  userName: string;
}

export interface UpdateUserNameResponse {
  details?: Details;
}

export interface DeactivateUserRequest {
  userId: string;
}

export interface DeactivateUserResponse {
  details?: Details;
}

export interface ReactivateUserRequest {
  userId: string;
}

export interface ReactivateUserResponse {
  details?: Details;
}

export interface RemoveUserRequest {
  userId: string;
}

export interface RemoveUserResponse {
  details?: Details;
}

export interface LockUserRequest {
  userId: string;
}

export interface LockUserResponse {
  details?: Details;
}

export interface UnlockUserRequest {
  userId: string;
}

export interface UnlockUserResponse {
  details?: Details;
}

// Profile Management

export interface SetUserProfileRequest {
  userId: string;
  givenName?: string;
  familyName?: string;
  nickName?: string;
  displayName?: string;
  preferredLanguage?: string;
  gender?: Gender;
}

export interface SetUserProfileResponse {
  details?: Details;
}

export interface SetUserEmailRequest {
  userId: string;
  email: string;
  isEmailVerified?: boolean;
}

export interface SetUserEmailResponse {
  details?: Details;
}

export interface VerifyEmailRequest {
  userId: string;
  verificationCode: string;
}

export interface VerifyEmailResponse {
  details?: Details;
}

export interface SetUserPhoneRequest {
  userId: string;
  phone: string;
  isPhoneVerified?: boolean;
}

export interface SetUserPhoneResponse {
  details?: Details;
}

export interface VerifyPhoneRequest {
  userId: string;
  verificationCode: string;
}

export interface VerifyPhoneResponse {
  details?: Details;
}

export interface RemoveUserPhoneRequest {
  userId: string;
}

export interface RemoveUserPhoneResponse {
  details?: Details;
}

export interface ResendEmailCodeRequest {
  userId: string;
}

export interface ResendEmailCodeResponse {
  details?: Details;
}

export interface ResendPhoneCodeRequest {
  userId: string;
}

export interface ResendPhoneCodeResponse {
  details?: Details;
}

// Auth Factors - OTP SMS

export interface AddOTPSMSRequest {
  userId: string;
}

export interface AddOTPSMSResponse {
  details?: Details;
}

export interface RemoveOTPSMSRequest {
  userId: string;
}

export interface RemoveOTPSMSResponse {
  details?: Details;
}

// Auth Factors - OTP Email

export interface AddOTPEmailRequest {
  userId: string;
}

export interface AddOTPEmailResponse {
  details?: Details;
}

export interface RemoveOTPEmailRequest {
  userId: string;
}

export interface RemoveOTPEmailResponse {
  details?: Details;
}

// Auth Factors - TOTP

export interface AddTOTPRequest {
  userId: string;
}

export interface AddTOTPResponse {
  uri: string;
  secret: string;
  details?: Details;
}

export interface VerifyTOTPRequest {
  userId: string;
  code: string;
}

export interface VerifyTOTPResponse {
  details?: Details;
}

export interface RemoveTOTPRequest {
  userId: string;
}

export interface RemoveTOTPResponse {
  details?: Details;
}

// Auth Factors - U2F

export interface AddU2FRequest {
  userId: string;
}

export interface AddU2FResponse {
  keyId: string;
  publicKeyCredentialCreationOptions: string; // JSON string
  details?: Details;
}

export interface VerifyU2FRequest {
  userId: string;
  keyId: string;
  publicKeyCredential: string; // JSON string
  tokenName: string;
}

export interface VerifyU2FResponse {
  details?: Details;
}

export interface RemoveU2FRequest {
  userId: string;
  u2fTokenId: string;
}

export interface RemoveU2FResponse {
  details?: Details;
}

// Auth Factors - Passwordless

export interface AddPasswordlessRequest {
  userId: string;
}

export interface AddPasswordlessResponse {
  keyId: string;
  publicKeyCredentialCreationOptions: string; // JSON string
  details?: Details;
}

export interface VerifyPasswordlessRequest {
  userId: string;
  keyId: string;
  publicKeyCredential: string; // JSON string
  tokenName: string;
}

export interface VerifyPasswordlessResponse {
  details?: Details;
}

export interface RemovePasswordlessRequest {
  userId: string;
  passwordlessTokenId: string;
}

export interface RemovePasswordlessResponse {
  details?: Details;
}

// ====================================================================
// User Metadata Types
// ====================================================================

export interface SetUserMetadataRequest {
  userId: string;
  key: string;
  value: string; // Base64 encoded bytes or string
}

export interface SetUserMetadataResponse {
  details?: Details;
}

export interface BulkSetUserMetadataRequest {
  userId: string;
  metadata: MetadataEntry[];
}

export interface MetadataEntry {
  key: string;
  value: string; // Base64 encoded bytes or string
}

export interface BulkSetUserMetadataResponse {
  details?: Details;
}

export interface ListUserMetadataRequest {
  userId: string;
  queries?: MetadataQuery[];
}

export interface MetadataQuery {
  keyQuery?: string; // Filter by key pattern
}

export interface ListUserMetadataResponse {
  details?: {
    totalResult: number;
    processedSequence: number;
    viewTimestamp: Date;
  };
  result: Metadata[];
}

export interface Metadata {
  key: string;
  value: string; // Base64 encoded bytes or string
  creationDate?: Date;
  changeDate?: Date;
}

export interface GetUserMetadataRequest {
  userId: string;
  key: string;
}

export interface GetUserMetadataResponse {
  metadata?: Metadata;
}

export interface RemoveUserMetadataRequest {
  userId: string;
  key: string;
}

export interface RemoveUserMetadataResponse {
  details?: Details;
}

// ====================================================================
// User Grants Types
// ====================================================================

export interface AddUserGrantRequest {
  userId: string;
  projectId: string;
  projectGrantId?: string; // For cross-org grants
  roleKeys: string[];
}

export interface AddUserGrantResponse {
  userGrantId: string;
  details?: Details;
}

export interface UpdateUserGrantRequest {
  userId: string;
  grantId: string;
  roleKeys: string[];
}

export interface UpdateUserGrantResponse {
  details?: Details;
}

export interface RemoveUserGrantRequest {
  userId: string;
  grantId: string;
}

export interface RemoveUserGrantResponse {
  details?: Details;
}

export interface ListUserGrantsRequest {
  userId: string;
  queries?: UserGrantQuery[];
}

export interface UserGrantQuery {
  projectIdQuery?: string;
}

export interface ListUserGrantsResponse {
  details?: {
    totalResult: number;
    processedSequence: number;
    viewTimestamp: Date;
  };
  result: UserGrant[];
}

export interface UserGrant {
  id: string;
  userId: string;
  projectId: string;
  projectGrantId?: string;
  roles: string[];
  orgId: string;
  orgName?: string;
  projectName?: string;
  creationDate?: Date;
  changeDate?: Date;
}
