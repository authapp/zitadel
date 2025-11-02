/**
 * SCIM Error Handler Middleware
 * RFC 7644 Section 3.12 - Error Response
 */

import { Request, Response, NextFunction } from 'express';
import { SCIM_SCHEMAS, SCIMError } from '../types';

export class SCIMErrorResponse extends Error {
  constructor(
    public status: number,
    public scimType?: string,
    public detail?: string
  ) {
    super(detail || scimType);
    this.name = 'SCIMErrorResponse';
  }

  toJSON(): SCIMError {
    return {
      schemas: [SCIM_SCHEMAS.ERROR],
      status: this.status,
      scimType: this.scimType,
      detail: this.detail,
    };
  }
}

/**
 * Create a SCIM error response
 */
export function createSCIMError(
  status: number,
  scimType?: string,
  detail?: string
): SCIMErrorResponse {
  return new SCIMErrorResponse(status, scimType, detail);
}

/**
 * SCIM error handler middleware
 */
export function scimErrorHandler(
  error: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response already sent, delegate to default error handler
  if (res.headersSent) {
    return next(error);
  }

  // Handle SCIM errors
  if (error instanceof SCIMErrorResponse) {
    res.status(error.status).json(error.toJSON());
    return;
  }

  // Handle other errors
  const status = error.status || error.statusCode || 500;
  const detail = error.message || 'Internal server error';

  const scimError: SCIMError = {
    schemas: [SCIM_SCHEMAS.ERROR],
    status,
    detail,
  };

  // Map common HTTP errors to SCIM types
  if (status === 400) {
    scimError.scimType = 'invalidValue';
  } else if (status === 401) {
    scimError.scimType = 'unauthorized';
  } else if (status === 403) {
    scimError.scimType = 'forbidden';
  } else if (status === 404) {
    scimError.scimType = 'notFound';
  } else if (status === 409) {
    scimError.scimType = 'uniqueness';
  } else if (status === 413) {
    scimError.scimType = 'tooLarge';
  }

  res.status(status).json(scimError);
}

/**
 * Common SCIM error types for convenience
 */
export const SCIMErrors = {
  invalidValue: (detail?: string) => createSCIMError(400, 'invalidValue', detail),
  unauthorized: (detail?: string) => createSCIMError(401, 'unauthorized', detail),
  forbidden: (detail?: string) => createSCIMError(403, 'forbidden', detail),
  notFound: (detail?: string) => createSCIMError(404, 'notFound', detail),
  uniqueness: (detail?: string) => createSCIMError(409, 'uniqueness', detail),
  tooLarge: (detail?: string) => createSCIMError(413, 'tooLarge', detail),
  internalError: (detail?: string) => createSCIMError(500, undefined, detail),
};
