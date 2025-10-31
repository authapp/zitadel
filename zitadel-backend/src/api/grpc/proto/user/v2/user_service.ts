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
