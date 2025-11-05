import { ObjectDetails, UserState, Gender } from './common';

export interface User {
  id: string;
  state: UserState;
  username: string;
  loginNames: string[];
  preferredLoginName: string;
  human?: HumanUser;
  machine?: MachineUser;
  details: ObjectDetails;
}

export interface HumanUser {
  profile: Profile;
  email: Email;
  phone?: Phone;
}

export interface Profile {
  firstName: string;
  lastName: string;
  nickName?: string;
  displayName: string;
  preferredLanguage?: string;
  gender?: Gender;
  avatarUrl?: string;
}

export interface Email {
  email: string;
  isEmailVerified: boolean;
}

export interface Phone {
  phone: string;
  isPhoneVerified: boolean;
}

export interface MachineUser {
  name: string;
  description?: string;
}

// Request types
export interface AddHumanUserRequest {
  username: string;
  organization: {
    orgId: string;
  };
  profile: {
    firstName: string;
    lastName: string;
    nickName?: string;
    displayName?: string;
    preferredLanguage?: string;
    gender?: Gender;
  };
  email: {
    email: string;
    isEmailVerified?: boolean;
  };
  phone?: {
    phone: string;
    isPhoneVerified?: boolean;
  };
  password?: string;
  passwordChangeRequired?: boolean;
}

export interface UpdateUserNameRequest {
  userId: string;
  username: string;
}

export interface ListUsersRequest {
  query?: {
    offset?: number;
    limit?: number;
    asc?: boolean;
  };
  queries?: any[];
}

// Response types
export interface AddHumanUserResponse {
  userId: string;
  details: ObjectDetails;
}

export interface GetUserByIdResponse {
  user: User;
}

export interface ListUsersResponse {
  details: {
    totalResult: string;
    processedSequence: string;
    viewTimestamp: string;
  };
  result: User[];
}
