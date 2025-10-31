/**
 * User Service Converters (v2)
 * 
 * Convert between internal domain models and gRPC proto types
 */

import { User, UserState, UserType, GetUserByIDResponse, ListUsersRequest, ListUsersResponse, HumanUser, Gender, MachineUser } from '../../proto/user/v2/user_service';
import { Details } from '../../proto/object/v2/object';

/**
 * Convert internal user query result to gRPC User
 */
export function userToProto(user: any): User {
  const userType = (user.userType || user.user_type || 'human').toLowerCase();
  const isMachine = userType === 'machine';
  
  return {
    userId: user.id,
    state: mapUserState(user.state),
    username: user.username || '',
    loginNames: user.loginNames || user.login_names || [],
    preferredLoginName: user.preferredLoginName || user.preferred_login_name || user.username || '',
    type: isMachine ? UserType.USER_TYPE_MACHINE : UserType.USER_TYPE_HUMAN,
    human: !isMachine ? mapHumanUser(user) : undefined,
    machine: isMachine ? mapMachineUser(user) : undefined,
  };
}

/**
 * Map user state from internal to proto
 */
function mapUserState(state: string | number): UserState {
  if (typeof state === 'number') {
    return state as UserState;
  }
  
  switch (state?.toLowerCase()) {
    case 'active':
      return UserState.USER_STATE_ACTIVE;
    case 'inactive':
      return UserState.USER_STATE_INACTIVE;
    case 'deleted':
      return UserState.USER_STATE_DELETED;
    case 'locked':
      return UserState.USER_STATE_LOCKED;
    default:
      return UserState.USER_STATE_UNSPECIFIED;
  }
}

/**
 * Map human user details
 */
function mapHumanUser(user: any): HumanUser {
  return {
    profile: {
      givenName: user.firstName || user.first_name || '',
      familyName: user.lastName || user.last_name || '',
      nickName: user.nickname,
      displayName: user.displayName || user.display_name,
      preferredLanguage: user.preferredLanguage || user.preferred_language,
      gender: mapGender(user.gender),
      avatarUrl: user.avatarUrl || user.avatar_url,
    },
    email: user.email ? {
      email: user.email,
      isVerified: user.emailVerified || user.email_verified || false,
    } : undefined,
    phone: user.phone ? {
      phone: user.phone,
      isVerified: user.phoneVerified || user.phone_verified || false,
    } : undefined,
  };
}

/**
 * Map gender from internal to proto
 */
function mapGender(gender?: string): Gender {
  switch (gender?.toLowerCase()) {
    case 'female':
      return Gender.GENDER_FEMALE;
    case 'male':
      return Gender.GENDER_MALE;
    case 'diverse':
      return Gender.GENDER_DIVERSE;
    default:
      return Gender.GENDER_UNSPECIFIED;
  }
}

/**
 * Map machine user details
 */
function mapMachineUser(user: any): MachineUser {
  return {
    name: user.username || '',
    description: user.description,
  };
}

/**
 * Convert user to GetUserByIDResponse
 */
export function userToGetUserResponse(user: any): GetUserByIDResponse {
  return {
    user: userToProto(user),
    details: {
      sequence: Number(user.sequence || 0),
      changeDate: user.changeDate || user.change_date || user.updatedAt || user.updated_at,
      resourceOwner: user.resourceOwner || user.resource_owner || user.instanceId || user.instance_id,
    },
  };
}

/**
 * Convert user list to ListUsersResponse
 */
export function userListToListUsersResponse(
  result: { users: any[]; total: number },
  request: ListUsersRequest
): ListUsersResponse {
  return {
    details: {
      totalResult: result.total,
      processedSequence: result.users.length,
      timestamp: new Date(),
    },
    sortingColumn: request.sortingColumn,
    result: result.users.map(userToProto),
  };
}

/**
 * Convert object details to proto Details
 */
export function objectDetailsToDetailsProto(details: {
  sequence: number;
  changeDate: Date;
  resourceOwner: string;
}): Details {
  return {
    sequence: details.sequence,
    changeDate: details.changeDate,
    resourceOwner: details.resourceOwner,
  };
}
