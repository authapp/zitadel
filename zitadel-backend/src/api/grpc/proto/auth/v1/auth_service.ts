/**
 * Auth Service Proto Definitions (v1)
 * 
 * TypeScript equivalents of Zitadel Go proto/zitadel/auth/v1/auth_service.proto
 * Provides authenticated user operations and session management
 */

import { Timestamp } from '../../google/protobuf/timestamp';
import { User } from '../../user/v2/user_service';

/**
 * Request: Get authenticated user
 */
export interface GetMyUserRequest {
  // No fields - uses authenticated context
}

/**
 * Response: Authenticated user
 */
export interface GetMyUserResponse {
  user: User;
}

/**
 * Request: Update authenticated user profile
 */
export interface UpdateMyUserProfileRequest {
  firstName?: string;
  lastName?: string;
  nickName?: string;
  displayName?: string;
  preferredLanguage?: string;
  gender?: Gender;
}

/**
 * Response: Update profile
 */
export interface UpdateMyUserProfileResponse {
  details: ObjectDetails;
}

/**
 * Request: Update authenticated user email
 */
export interface UpdateMyUserEmailRequest {
  email: string;
}

/**
 * Response: Update email
 */
export interface UpdateMyUserEmailResponse {
  details: ObjectDetails;
}

/**
 * Request: Verify email with code
 */
export interface VerifyMyUserEmailRequest {
  code: string;
}

/**
 * Response: Verify email
 */
export interface VerifyMyUserEmailResponse {
  details: ObjectDetails;
}

/**
 * Request: Resend email verification
 */
export interface ResendMyUserEmailVerificationRequest {
  // No fields
}

/**
 * Response: Resend email verification
 */
export interface ResendMyUserEmailVerificationResponse {
  details: ObjectDetails;
}

/**
 * Request: Update authenticated user phone
 */
export interface UpdateMyUserPhoneRequest {
  phone: string;
}

/**
 * Response: Update phone
 */
export interface UpdateMyUserPhoneResponse {
  details: ObjectDetails;
}

/**
 * Request: Verify phone with code
 */
export interface VerifyMyUserPhoneRequest {
  code: string;
}

/**
 * Response: Verify phone
 */
export interface VerifyMyUserPhoneResponse {
  details: ObjectDetails;
}

/**
 * Request: Remove phone
 */
export interface RemoveMyUserPhoneRequest {
  // No fields
}

/**
 * Response: Remove phone
 */
export interface RemoveMyUserPhoneResponse {
  details: ObjectDetails;
}

/**
 * Request: Remove authenticated user
 */
export interface RemoveMyUserRequest {
  // No fields - uses authenticated context
}

/**
 * Response: Remove user
 */
export interface RemoveMyUserResponse {
  details: ObjectDetails;
}

/**
 * Request: List user changes
 */
export interface ListMyUserChangesRequest {
  query?: ListQuery;
}

/**
 * Response: User changes
 */
export interface ListMyUserChangesResponse {
  result: Change[];
  details: ListDetails;
}

/**
 * Request: Get user sessions
 */
export interface GetMyUserSessionsRequest {
  // No fields
}

/**
 * Response: User sessions
 */
export interface GetMyUserSessionsResponse {
  sessions: Session[];
}

/**
 * Request: List user grants
 */
export interface ListMyUserGrantsRequest {
  query?: ListQuery;
  queries?: UserGrantQuery[];
}

/**
 * Response: User grants
 */
export interface ListMyUserGrantsResponse {
  result: UserGrant[];
  details: ListDetails;
}

/**
 * Request: List project organizations
 */
export interface ListMyProjectOrgsRequest {
  query?: ListQuery;
  queries?: ProjectQuery[];
}

/**
 * Response: Project organizations
 */
export interface ListMyProjectOrgsResponse {
  result: Org[];
  details: ListDetails;
}

/**
 * Request: Get Zitadel permissions
 */
export interface GetMyZitadelPermissionsRequest {
  // No fields
}

/**
 * Response: Zitadel permissions
 */
export interface GetMyZitadelPermissionsResponse {
  permissions: string[];
}

/**
 * Request: Get project permissions
 */
export interface GetMyProjectPermissionsRequest {
  // No fields
}

/**
 * Response: Project permissions
 */
export interface GetMyProjectPermissionsResponse {
  permissions: string[];
}

/**
 * Request: Create session
 */
export interface CreateSessionRequest {
  userAgent?: string;
  metadata?: Record<string, string>;
}

/**
 * Response: Create session
 */
export interface CreateSessionResponse {
  sessionId: string;
  sessionToken: string;
  details: ObjectDetails;
}

/**
 * Request: List sessions
 */
export interface ListSessionsRequest {
  query?: ListQuery;
}

/**
 * Response: List sessions
 */
export interface ListSessionsResponse {
  sessions: Session[];
  details: ListDetails;
}

/**
 * Request: Terminate session
 */
export interface TerminateSessionRequest {
  sessionId: string;
}

/**
 * Response: Terminate session
 */
export interface TerminateSessionResponse {
  details: ObjectDetails;
}

// Supporting Types

/**
 * Gender enum
 */
export enum Gender {
  GENDER_UNSPECIFIED = 0,
  GENDER_FEMALE = 1,
  GENDER_MALE = 2,
  GENDER_DIVERSE = 3,
}

/**
 * Object details (change tracking)
 */
export interface ObjectDetails {
  sequence: string;
  creationDate: Timestamp;
  changeDate: Timestamp;
  resourceOwner: string;
}

/**
 * List query
 */
export interface ListQuery {
  offset?: number;
  limit?: number;
  asc?: boolean;
}

/**
 * List details (pagination)
 */
export interface ListDetails {
  totalResult: number;
  processedSequence: string;
  viewTimestamp: Timestamp;
}

/**
 * Change record
 */
export interface Change {
  changeDate: Timestamp;
  eventType: string;
  sequence: string;
  editorId: string;
  editor: string;
  data: any;
}

/**
 * Session
 */
export interface Session {
  sessionId: string;
  userId: string;
  creationDate: Timestamp;
  changeDate: Timestamp;
  sequence: string;
  userAgent?: string;
  clientIP?: string;
  metadata?: Record<string, string>;
}

/**
 * User grant
 */
export interface UserGrant {
  id: string;
  userId: string;
  orgId: string;
  orgName: string;
  projectId: string;
  projectName: string;
  roleKeys: string[];
  state: UserGrantState;
  details: ObjectDetails;
}

/**
 * User grant state
 */
export enum UserGrantState {
  USER_GRANT_STATE_UNSPECIFIED = 0,
  USER_GRANT_STATE_ACTIVE = 1,
  USER_GRANT_STATE_INACTIVE = 2,
}

/**
 * User grant query
 */
export interface UserGrantQuery {
  // Add specific query fields as needed
  projectId?: string;
  orgId?: string;
}

/**
 * Organization
 */
export interface Org {
  id: string;
  name: string;
  primaryDomain: string;
  state: OrgState;
  details: ObjectDetails;
}

/**
 * Org state
 */
export enum OrgState {
  ORG_STATE_UNSPECIFIED = 0,
  ORG_STATE_ACTIVE = 1,
  ORG_STATE_INACTIVE = 2,
}

/**
 * Project query
 */
export interface ProjectQuery {
  projectId?: string;
  withGrantedRoles?: boolean;
}
