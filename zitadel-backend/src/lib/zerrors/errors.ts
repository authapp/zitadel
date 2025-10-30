/**
 * Error codes used throughout the Zitadel backend
 * These codes provide consistent error identification across modules
 */
export enum ErrorCode {
  // General errors (1xxx)
  INTERNAL = 'INTERNAL',
  UNKNOWN = 'UNKNOWN',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PRECONDITION_FAILED = 'PRECONDITION_FAILED',
  UNAVAILABLE = 'UNAVAILABLE',
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED',

  // Authentication errors (2xxx)
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // User errors (3xxx)
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_INACTIVE = 'USER_INACTIVE',
  USER_LOCKED = 'USER_LOCKED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',

  // Organization errors (4xxx)
  ORG_NOT_FOUND = 'ORG_NOT_FOUND',
  ORG_ALREADY_EXISTS = 'ORG_ALREADY_EXISTS',

  // Project errors (5xxx)
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  PROJECT_ALREADY_EXISTS = 'PROJECT_ALREADY_EXISTS',

  // Application errors (6xxx)
  APP_NOT_FOUND = 'APP_NOT_FOUND',
  APP_ALREADY_EXISTS = 'APP_ALREADY_EXISTS',

  // Event store errors (7xxx)
  EVENTSTORE_PUSH_FAILED = 'EVENTSTORE_PUSH_FAILED',
  EVENTSTORE_QUERY_FAILED = 'EVENTSTORE_QUERY_FAILED',
  AGGREGATE_NOT_FOUND = 'AGGREGATE_NOT_FOUND',
  CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT',

  // Database errors (8xxx)
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_TRANSACTION_FAILED = 'DATABASE_TRANSACTION_FAILED',

  // Validation errors (9xxx)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT = 'INVALID_FORMAT',
  VALUE_OUT_OF_RANGE = 'VALUE_OUT_OF_RANGE',

  // Instance/Feature errors (10xxx)
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

/**
 * HTTP status codes mapped to error types
 */
export const ErrorHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.INTERNAL]: 500,
  [ErrorCode.UNKNOWN]: 500,
  [ErrorCode.INVALID_ARGUMENT]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.PRECONDITION_FAILED]: 412,
  [ErrorCode.UNAVAILABLE]: 503,
  [ErrorCode.DEADLINE_EXCEEDED]: 504,
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.PERMISSION_DENIED]: 403,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.USER_ALREADY_EXISTS]: 409,
  [ErrorCode.USER_INACTIVE]: 403,
  [ErrorCode.USER_LOCKED]: 403,
  [ErrorCode.USER_SUSPENDED]: 403,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.PASSWORD_TOO_WEAK]: 400,
  [ErrorCode.ORG_NOT_FOUND]: 404,
  [ErrorCode.ORG_ALREADY_EXISTS]: 409,
  [ErrorCode.PROJECT_NOT_FOUND]: 404,
  [ErrorCode.PROJECT_ALREADY_EXISTS]: 409,
  [ErrorCode.APP_NOT_FOUND]: 404,
  [ErrorCode.APP_ALREADY_EXISTS]: 409,
  [ErrorCode.EVENTSTORE_PUSH_FAILED]: 500,
  [ErrorCode.EVENTSTORE_QUERY_FAILED]: 500,
  [ErrorCode.AGGREGATE_NOT_FOUND]: 404,
  [ErrorCode.CONCURRENCY_CONFLICT]: 409,
  [ErrorCode.DATABASE_CONNECTION_FAILED]: 503,
  [ErrorCode.DATABASE_QUERY_FAILED]: 500,
  [ErrorCode.DATABASE_TRANSACTION_FAILED]: 500,
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.REQUIRED_FIELD_MISSING]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.VALUE_OUT_OF_RANGE]: 400,
  [ErrorCode.FEATURE_DISABLED]: 403,
  [ErrorCode.QUOTA_EXCEEDED]: 429,
};

/**
 * Base error class for all Zitadel errors
 */
export class ZitadelError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly id: string;
  public readonly parent?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    parent?: Error,
  ) {
    super(message);
    this.name = 'ZitadelError';
    this.code = code;
    this.httpStatus = ErrorHttpStatus[code];
    this.details = details;
    this.timestamp = new Date();
    this.id = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.parent = parent;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Include parent stack trace if available
    if (parent?.stack) {
      this.stack = `${this.stack}\nCaused by: ${parent.stack}`;
    }
  }

  /**
   * Convert error to JSON for logging and API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      ...(this.parent && { cause: this.parent.message }),
    };
  }

  /**
   * Check if error is of a specific code
   */
  is(code: ErrorCode): boolean {
    return this.code === code;
  }
}

/**
 * Throw an internal error
 */
export function throwInternal(
  message: string,
  id: string,
  details: Record<string, unknown> = {},
  parent?: Error,
): never {
  throw new ZitadelError(ErrorCode.INTERNAL, `${id}: ${message}`, details, parent);
}

/**
 * Throw an invalid argument error
 */
export function throwInvalidArgument(
  message: string,
  id: string,
  details: Record<string, unknown> = {},
): never {
  throw new ZitadelError(ErrorCode.INVALID_ARGUMENT, `${id}: ${message}`, details);
}

/**
 * Throw a not found error
 */
export function throwNotFound(
  message: string,
  id: string,
  details: Record<string, unknown> = {},
): never {
  throw new ZitadelError(ErrorCode.NOT_FOUND, `${id}: ${message}`, details);
}

/**
 * Throw an already exists error
 */
export function throwAlreadyExists(
  message: string,
  id: string,
  details: Record<string, unknown> = {},
): never {
  throw new ZitadelError(ErrorCode.ALREADY_EXISTS, `${id}: ${message}`, details);
}

/**
 * Throw a precondition failed error
 */
export function throwPreconditionFailed(
  message: string,
  id: string,
  details: Record<string, unknown> = {},
): never {
  throw new ZitadelError(ErrorCode.PRECONDITION_FAILED, `${id}: ${message}`, details);
}

/**
 * Throw an unauthenticated error
 */
export function throwUnauthenticated(
  message: string,
  id: string,
  details: Record<string, unknown> = {},
): never {
  throw new ZitadelError(ErrorCode.UNAUTHENTICATED, `${id}: ${message}`, details);
}

/**
 * Throw a permission denied error
 */
export function throwPermissionDenied(
  message: string,
  id: string,
  details: Record<string, unknown> = {},
): never {
  throw new ZitadelError(ErrorCode.PERMISSION_DENIED, `${id}: ${message}`, details);
}

/**
 * Wrap an unknown error into a ZitadelError
 */
export function wrapError(error: unknown, defaultMessage = 'An error occurred'): ZitadelError {
  if (error instanceof ZitadelError) {
    return error;
  }

  if (error instanceof Error) {
    return new ZitadelError(ErrorCode.INTERNAL, error.message, {}, error);
  }

  return new ZitadelError(ErrorCode.UNKNOWN, defaultMessage, {
    originalError: String(error),
  });
}

/**
 * Check if an error is a ZitadelError
 */
export function isZitadelError(error: unknown): error is ZitadelError {
  return error instanceof ZitadelError;
}

/**
 * Check if an error has a specific error code
 */
export function hasErrorCode(error: unknown, code: ErrorCode): boolean {
  return isZitadelError(error) && error.code === code;
}
