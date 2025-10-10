/**
 * Zitadel Error Types
 * 
 * Error handling following Zitadel patterns
 * Based on: internal/zerrors/*
 */

/**
 * Base Zitadel Error
 */
export class ZitadelError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly grpcCode: number
  ) {
    super(message);
    this.name = 'ZitadelError';
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      httpStatus: this.httpStatus,
      grpcCode: this.grpcCode,
    };
  }
}

/**
 * Invalid Argument Error (400, INVALID_ARGUMENT)
 */
export class InvalidArgumentError extends ZitadelError {
  constructor(message: string, code: string) {
    super(message, code, 400, 3);
    this.name = 'InvalidArgument';
  }
}

/**
 * Not Found Error (404, NOT_FOUND)
 */
export class NotFoundError extends ZitadelError {
  constructor(message: string, code: string) {
    super(message, code, 404, 5);
    this.name = 'NotFound';
  }
}

/**
 * Already Exists Error (409, ALREADY_EXISTS)
 */
export class AlreadyExistsError extends ZitadelError {
  constructor(message: string, code: string) {
    super(message, code, 409, 6);
    this.name = 'AlreadyExists';
  }
}

/**
 * Permission Denied Error (403, PERMISSION_DENIED)
 */
export class PermissionDeniedError extends ZitadelError {
  constructor(message: string, code: string) {
    super(message, code, 403, 7);
    this.name = 'PermissionDenied';
  }
}

/**
 * Precondition Failed Error (412, FAILED_PRECONDITION)
 */
export class PreconditionFailedError extends ZitadelError {
  constructor(message: string, code: string) {
    super(message, code, 412, 9);
    this.name = 'PreconditionFailed';
  }
}

/**
 * Unimplemented Error (501, UNIMPLEMENTED)
 */
export class UnimplementedError extends ZitadelError {
  constructor(message: string, code: string) {
    super(message, code, 501, 12);
    this.name = 'Unimplemented';
  }
}

/**
 * Internal Error (500, INTERNAL)
 */
export class InternalError extends ZitadelError {
  constructor(message: string, code: string) {
    super(message, code, 500, 13);
    this.name = 'Internal';
  }
}

/**
 * Unauthenticated Error (401, UNAUTHENTICATED)
 */
export class UnauthenticatedError extends ZitadelError {
  constructor(message: string, code: string) {
    super(message, code, 401, 16);
    this.name = 'Unauthenticated';
  }
}

// Throwing functions matching Zitadel patterns
// Additional context and cause parameters are accepted but ignored for simplicity

export function throwInvalidArgument(message: string, code: string, _context?: any, _cause?: Error): never {
  throw new InvalidArgumentError(message, code);
}

export function throwNotFound(message: string, code: string, _context?: any, _cause?: Error): never {
  throw new NotFoundError(message, code);
}

export function throwAlreadyExists(message: string, code: string, _context?: any, _cause?: Error): never {
  throw new AlreadyExistsError(message, code);
}

export function throwPermissionDenied(message: string, code: string, _context?: any, _cause?: Error): never {
  throw new PermissionDeniedError(message, code);
}

export function throwPreconditionFailed(message: string, code: string, _context?: any, _cause?: Error): never {
  throw new PreconditionFailedError(message, code);
}

export function throwUnimplemented(message: string, code: string, _context?: any, _cause?: Error): never {
  throw new UnimplementedError(message, code);
}

export function throwInternal(message: string, code: string, _context?: any, _cause?: Error): never {
  throw new InternalError(message, code);
}

export function throwUnauthenticated(message: string, code: string, _context?: any, _cause?: Error): never {
  throw new UnauthenticatedError(message, code);
}

/**
 * Check if error is a Zitadel error
 */
export function isZitadelError(error: any): error is ZitadelError {
  return error instanceof ZitadelError;
}
