/**
 * Error Interceptor for gRPC
 * 
 * Handles errors and maps them to appropriate gRPC status codes
 */

import * as grpc from '@grpc/grpc-js';
import { ZitadelError, ErrorCode } from '../../../lib/zerrors';

/**
 * Map Zitadel error codes to gRPC status codes
 */
function mapErrorToGrpcStatus(code: ErrorCode): grpc.status {
  switch (code) {
    case ErrorCode.NOT_FOUND:
    case ErrorCode.USER_NOT_FOUND:
    case ErrorCode.ORG_NOT_FOUND:
    case ErrorCode.PROJECT_NOT_FOUND:
    case ErrorCode.APP_NOT_FOUND:
    case ErrorCode.AGGREGATE_NOT_FOUND:
      return grpc.status.NOT_FOUND;

    case ErrorCode.ALREADY_EXISTS:
    case ErrorCode.USER_ALREADY_EXISTS:
    case ErrorCode.ORG_ALREADY_EXISTS:
    case ErrorCode.PROJECT_ALREADY_EXISTS:
    case ErrorCode.APP_ALREADY_EXISTS:
    case ErrorCode.CONCURRENCY_CONFLICT:
      return grpc.status.ALREADY_EXISTS;

    case ErrorCode.INVALID_ARGUMENT:
    case ErrorCode.VALIDATION_FAILED:
    case ErrorCode.REQUIRED_FIELD_MISSING:
    case ErrorCode.INVALID_FORMAT:
    case ErrorCode.VALUE_OUT_OF_RANGE:
    case ErrorCode.PASSWORD_TOO_WEAK:
      return grpc.status.INVALID_ARGUMENT;

    case ErrorCode.UNAUTHENTICATED:
    case ErrorCode.TOKEN_EXPIRED:
    case ErrorCode.TOKEN_INVALID:
    case ErrorCode.SESSION_EXPIRED:
    case ErrorCode.INVALID_CREDENTIALS:
      return grpc.status.UNAUTHENTICATED;

    case ErrorCode.PERMISSION_DENIED:
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.USER_INACTIVE:
    case ErrorCode.USER_LOCKED:
    case ErrorCode.USER_SUSPENDED:
    case ErrorCode.FEATURE_DISABLED:
      return grpc.status.PERMISSION_DENIED;

    case ErrorCode.PRECONDITION_FAILED:
      return grpc.status.FAILED_PRECONDITION;

    case ErrorCode.UNAVAILABLE:
    case ErrorCode.DATABASE_CONNECTION_FAILED:
      return grpc.status.UNAVAILABLE;

    case ErrorCode.DEADLINE_EXCEEDED:
      return grpc.status.DEADLINE_EXCEEDED;

    case ErrorCode.QUOTA_EXCEEDED:
      return grpc.status.RESOURCE_EXHAUSTED;

    case ErrorCode.INTERNAL:
    case ErrorCode.UNKNOWN:
    case ErrorCode.EVENTSTORE_PUSH_FAILED:
    case ErrorCode.EVENTSTORE_QUERY_FAILED:
    case ErrorCode.DATABASE_QUERY_FAILED:
    case ErrorCode.DATABASE_TRANSACTION_FAILED:
    default:
      return grpc.status.INTERNAL;
  }
}

/**
 * Create error interceptor
 */
export function createErrorInterceptor() {
  return (
    options: any,
    nextCall: (options: any) => grpc.InterceptingCall
  ): grpc.InterceptingCall => {
    const requester = {
      start: (metadata: grpc.Metadata, listener: grpc.Listener, next: (metadata: grpc.Metadata, listener: grpc.Listener) => void) => {
        const newListener: grpc.Listener = {
          ...listener,
          onReceiveStatus: (status: grpc.StatusObject, next: (status: grpc.StatusObject) => void) => {
            // Intercept errors and map to gRPC status codes
            if (status.code !== grpc.status.OK && status.metadata) {
              const errorJson = status.metadata.get('error-details')[0] as string | undefined;
              
              if (errorJson) {
                try {
                  const error = JSON.parse(errorJson);
                  
                  if (error.code) {
                    const grpcStatus = mapErrorToGrpcStatus(error.code as ErrorCode);
                    status = {
                      ...status,
                      code: grpcStatus,
                      details: error.message || status.details,
                    };
                  }
                } catch (e) {
                  // Failed to parse error, use original status
                }
              }
            }
            
            next(status);
          },
        };

        next(metadata, newListener);
      },
    };

    return new grpc.InterceptingCall(nextCall(options), requester);
  };
}

/**
 * Convert error to gRPC error
 */
export function toGrpcError(error: Error): grpc.ServiceError {
  if (error instanceof ZitadelError) {
    const status = mapErrorToGrpcStatus(error.code);
    
    const grpcError: grpc.ServiceError = {
      name: 'ServiceError',
      message: error.message,
      code: status,
      details: error.message,
      metadata: new grpc.Metadata(),
    };

    // Add error details to metadata
    grpcError.metadata!.set('error-details', JSON.stringify({
      code: error.code,
      message: error.message,
      details: error.details,
    }));

    return grpcError;
  }

  // Unknown error
  return {
    name: 'ServiceError',
    message: error.message || 'Internal server error',
    code: grpc.status.INTERNAL,
    details: error.message || 'Internal server error',
    metadata: new grpc.Metadata(),
  };
}
