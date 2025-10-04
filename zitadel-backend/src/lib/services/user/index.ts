/**
 * User service module
 */

export * from './types';
export * from './user-service';

export type {
  UserService,
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  SetupMfaRequest,
  UserSearchFilters,
  UserListOptions,
} from './types';

export {
  UserServiceError,
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidPasswordError,
} from './types';

export {
  DefaultUserService,
  createUserService,
} from './user-service';
