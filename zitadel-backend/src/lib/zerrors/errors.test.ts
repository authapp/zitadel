import {
  ZitadelError,
  ErrorCode,
  ErrorHttpStatus,
  throwInternal,
  throwInvalidArgument,
  throwNotFound,
  throwAlreadyExists,
  throwPreconditionFailed,
  throwUnauthenticated,
  throwPermissionDenied,
  wrapError,
  isZitadelError,
  hasErrorCode,
} from './errors';

describe('ZitadelError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new ZitadelError(ErrorCode.NOT_FOUND, 'Resource not found');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ZitadelError);
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe('Resource not found');
      expect(error.httpStatus).toBe(404);
      expect(error.details).toEqual({});
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.id).toMatch(/^ERR-\d+-[a-z0-9]+$/);
    });

    it('should create error with details', () => {
      const details = { userId: '123', reason: 'inactive' };
      const error = new ZitadelError(ErrorCode.USER_INACTIVE, 'User is inactive', details);

      expect(error.details).toEqual(details);
    });

    it('should create error with parent error', () => {
      const parentError = new Error('Database connection failed');
      const error = new ZitadelError(
        ErrorCode.INTERNAL,
        'Failed to fetch user',
        {},
        parentError,
      );

      expect(error.parent).toBe(parentError);
      expect(error.stack).toContain('Caused by:');
      expect(error.stack).toContain('Database connection failed');
    });

    it('should map error codes to correct HTTP status', () => {
      expect(new ZitadelError(ErrorCode.NOT_FOUND, 'test').httpStatus).toBe(404);
      expect(new ZitadelError(ErrorCode.ALREADY_EXISTS, 'test').httpStatus).toBe(409);
      expect(new ZitadelError(ErrorCode.UNAUTHENTICATED, 'test').httpStatus).toBe(401);
      expect(new ZitadelError(ErrorCode.PERMISSION_DENIED, 'test').httpStatus).toBe(403);
      expect(new ZitadelError(ErrorCode.INTERNAL, 'test').httpStatus).toBe(500);
      expect(new ZitadelError(ErrorCode.INVALID_ARGUMENT, 'test').httpStatus).toBe(400);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const error = new ZitadelError(ErrorCode.NOT_FOUND, 'User not found', {
        userId: '123',
      });

      const json = error.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('code', ErrorCode.NOT_FOUND);
      expect(json).toHaveProperty('message', 'User not found');
      expect(json).toHaveProperty('details', { userId: '123' });
      expect(json).toHaveProperty('timestamp');
      expect(typeof json.timestamp).toBe('string');
    });

    it('should include parent error in JSON', () => {
      const parentError = new Error('Original error');
      const error = new ZitadelError(ErrorCode.INTERNAL, 'Wrapped error', {}, parentError);

      const json = error.toJSON();

      expect(json).toHaveProperty('cause', 'Original error');
    });
  });

  describe('is', () => {
    it('should check if error has specific code', () => {
      const error = new ZitadelError(ErrorCode.NOT_FOUND, 'Not found');

      expect(error.is(ErrorCode.NOT_FOUND)).toBe(true);
      expect(error.is(ErrorCode.INTERNAL)).toBe(false);
    });
  });
});

describe('Error throwing functions', () => {
  describe('throwInternal', () => {
    it('should throw internal error', () => {
      expect(() => {
        throwInternal('Something went wrong', 'INT-001');
      }).toThrow(ZitadelError);

      try {
        throwInternal('Something went wrong', 'INT-001', { detail: 'test' });
      } catch (error) {
        expect(error).toBeInstanceOf(ZitadelError);
        expect((error as ZitadelError).code).toBe(ErrorCode.INTERNAL);
        expect((error as ZitadelError).message).toContain('INT-001');
        expect((error as ZitadelError).message).toContain('Something went wrong');
        expect((error as ZitadelError).details).toEqual({ detail: 'test' });
      }
    });

    it('should include parent error', () => {
      const parentError = new Error('Database error');

      try {
        throwInternal('Failed to save', 'INT-002', {}, parentError);
      } catch (error) {
        expect((error as ZitadelError).parent).toBe(parentError);
      }
    });
  });

  describe('throwInvalidArgument', () => {
    it('should throw invalid argument error', () => {
      expect(() => {
        throwInvalidArgument('Invalid email format', 'VAL-001');
      }).toThrow(ZitadelError);

      try {
        throwInvalidArgument('Invalid email format', 'VAL-001', { email: 'invalid' });
      } catch (error) {
        expect((error as ZitadelError).code).toBe(ErrorCode.INVALID_ARGUMENT);
        expect((error as ZitadelError).httpStatus).toBe(400);
      }
    });
  });

  describe('throwNotFound', () => {
    it('should throw not found error', () => {
      expect(() => {
        throwNotFound('User not found', 'USER-404');
      }).toThrow(ZitadelError);

      try {
        throwNotFound('User not found', 'USER-404', { userId: '123' });
      } catch (error) {
        expect((error as ZitadelError).code).toBe(ErrorCode.NOT_FOUND);
        expect((error as ZitadelError).httpStatus).toBe(404);
      }
    });
  });

  describe('throwAlreadyExists', () => {
    it('should throw already exists error', () => {
      expect(() => {
        throwAlreadyExists('User already exists', 'USER-409');
      }).toThrow(ZitadelError);

      try {
        throwAlreadyExists('User already exists', 'USER-409', { email: 'test@example.com' });
      } catch (error) {
        expect((error as ZitadelError).code).toBe(ErrorCode.ALREADY_EXISTS);
        expect((error as ZitadelError).httpStatus).toBe(409);
      }
    });
  });

  describe('throwPreconditionFailed', () => {
    it('should throw precondition failed error', () => {
      expect(() => {
        throwPreconditionFailed('Email not verified', 'PRE-001');
      }).toThrow(ZitadelError);

      try {
        throwPreconditionFailed('Email not verified', 'PRE-001');
      } catch (error) {
        expect((error as ZitadelError).code).toBe(ErrorCode.PRECONDITION_FAILED);
        expect((error as ZitadelError).httpStatus).toBe(412);
      }
    });
  });

  describe('throwUnauthenticated', () => {
    it('should throw unauthenticated error', () => {
      expect(() => {
        throwUnauthenticated('Invalid credentials', 'AUTH-401');
      }).toThrow(ZitadelError);

      try {
        throwUnauthenticated('Invalid credentials', 'AUTH-401');
      } catch (error) {
        expect((error as ZitadelError).code).toBe(ErrorCode.UNAUTHENTICATED);
        expect((error as ZitadelError).httpStatus).toBe(401);
      }
    });
  });

  describe('throwPermissionDenied', () => {
    it('should throw permission denied error', () => {
      expect(() => {
        throwPermissionDenied('Access denied', 'PERM-403');
      }).toThrow(ZitadelError);

      try {
        throwPermissionDenied('Access denied', 'PERM-403', { resource: 'user' });
      } catch (error) {
        expect((error as ZitadelError).code).toBe(ErrorCode.PERMISSION_DENIED);
        expect((error as ZitadelError).httpStatus).toBe(403);
      }
    });
  });
});

describe('Error utility functions', () => {
  describe('wrapError', () => {
    it('should return ZitadelError as-is', () => {
      const originalError = new ZitadelError(ErrorCode.NOT_FOUND, 'Not found');
      const wrapped = wrapError(originalError);

      expect(wrapped).toBe(originalError);
    });

    it('should wrap standard Error', () => {
      const originalError = new Error('Something went wrong');
      const wrapped = wrapError(originalError);

      expect(wrapped).toBeInstanceOf(ZitadelError);
      expect(wrapped.code).toBe(ErrorCode.INTERNAL);
      expect(wrapped.message).toBe('Something went wrong');
      expect(wrapped.parent).toBe(originalError);
    });

    it('should wrap unknown error types', () => {
      const wrapped = wrapError('string error');

      expect(wrapped).toBeInstanceOf(ZitadelError);
      expect(wrapped.code).toBe(ErrorCode.UNKNOWN);
      expect(wrapped.details).toHaveProperty('originalError', 'string error');
    });

    it('should use custom default message', () => {
      const wrapped = wrapError('error', 'Custom message');

      expect(wrapped.message).toBe('Custom message');
    });
  });

  describe('isZitadelError', () => {
    it('should return true for ZitadelError', () => {
      const error = new ZitadelError(ErrorCode.INTERNAL, 'Error');
      expect(isZitadelError(error)).toBe(true);
    });

    it('should return false for standard Error', () => {
      const error = new Error('Error');
      expect(isZitadelError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isZitadelError('string')).toBe(false);
      expect(isZitadelError(null)).toBe(false);
      expect(isZitadelError(undefined)).toBe(false);
      expect(isZitadelError({})).toBe(false);
    });
  });

  describe('hasErrorCode', () => {
    it('should return true if error has specific code', () => {
      const error = new ZitadelError(ErrorCode.NOT_FOUND, 'Not found');
      expect(hasErrorCode(error, ErrorCode.NOT_FOUND)).toBe(true);
    });

    it('should return false if error has different code', () => {
      const error = new ZitadelError(ErrorCode.NOT_FOUND, 'Not found');
      expect(hasErrorCode(error, ErrorCode.INTERNAL)).toBe(false);
    });

    it('should return false for non-ZitadelError', () => {
      const error = new Error('Error');
      expect(hasErrorCode(error, ErrorCode.INTERNAL)).toBe(false);
    });
  });
});

describe('ErrorHttpStatus mapping', () => {
  it('should have correct HTTP status for all error codes', () => {
    expect(ErrorHttpStatus[ErrorCode.INTERNAL]).toBe(500);
    expect(ErrorHttpStatus[ErrorCode.UNKNOWN]).toBe(500);
    expect(ErrorHttpStatus[ErrorCode.INVALID_ARGUMENT]).toBe(400);
    expect(ErrorHttpStatus[ErrorCode.NOT_FOUND]).toBe(404);
    expect(ErrorHttpStatus[ErrorCode.ALREADY_EXISTS]).toBe(409);
    expect(ErrorHttpStatus[ErrorCode.PRECONDITION_FAILED]).toBe(412);
    expect(ErrorHttpStatus[ErrorCode.UNAVAILABLE]).toBe(503);
    expect(ErrorHttpStatus[ErrorCode.DEADLINE_EXCEEDED]).toBe(504);
    expect(ErrorHttpStatus[ErrorCode.UNAUTHENTICATED]).toBe(401);
    expect(ErrorHttpStatus[ErrorCode.UNAUTHORIZED]).toBe(401);
    expect(ErrorHttpStatus[ErrorCode.PERMISSION_DENIED]).toBe(403);
  });
});
