/**
 * Error Mapper: Zitadel Errors → SCIM Errors
 * Maps command/query errors to appropriate SCIM error responses
 */

import { SCIMErrors } from '../middleware/scim-error-handler';

/**
 * Map Zitadel error to SCIM error response
 */
export function mapZitadelErrorToSCIM(error: any): any {
  // If it's already a SCIM error, return as-is
  if (error.schemas && error.schemas.includes('urn:ietf:params:scim:api:messages:2.0:Error')) {
    return error;
  }

  const errorMessage = error.message || error.toString();
  const errorCode = error.code || '';

  // Map Zitadel error codes to SCIM errors
  
  // Already Exists / Uniqueness violations
  if (errorCode.includes('AlreadyExists') || errorMessage.includes('already taken') || errorMessage.includes('already exists')) {
    return SCIMErrors.uniqueness(errorMessage);
  }

  // Not Found errors
  if (errorCode.includes('NotFound') || errorMessage.includes('not found')) {
    return SCIMErrors.notFound(errorMessage);
  }

  // Invalid Argument / Validation errors
  if (errorCode.includes('InvalidArgument') || 
      errorCode.includes('COMMAND-') || 
      errorMessage.includes('is required') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('does not meet')) {
    return SCIMErrors.invalidValue(errorMessage);
  }

  // Permission / Precondition errors
  if (errorCode.includes('PermissionDenied') || errorCode.includes('Precondition')) {
    return SCIMErrors.forbidden(errorMessage);
  }

  // Password validation errors
  if (errorMessage.includes('password') && 
      (errorMessage.includes('length') || 
       errorMessage.includes('complexity') ||
       errorMessage.includes('policy'))) {
    return SCIMErrors.invalidValue(`Password validation failed: ${errorMessage}`);
  }

  // Email validation errors
  if (errorMessage.includes('email') && errorMessage.includes('invalid')) {
    return SCIMErrors.invalidValue(`Invalid email format: ${errorMessage}`);
  }

  // Username validation errors
  if (errorMessage.includes('username') && 
      (errorMessage.includes('invalid') || errorMessage.includes('format'))) {
    return SCIMErrors.invalidValue(`Invalid username: ${errorMessage}`);
  }

  // Default to invalidValue for unknown errors with descriptive message
  return SCIMErrors.invalidValue(errorMessage || 'An error occurred processing the request');
}

/**
 * Wrap async SCIM handler with error mapping
 */
export function withErrorMapping(
  handler: (req: any, res: any, next: any) => Promise<void>
) {
  return async (req: any, res: any, next: any) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      // Map the error and pass to error handler
      const mappedError = mapZitadelErrorToSCIM(error);
      next(mappedError);
    }
  };
}
