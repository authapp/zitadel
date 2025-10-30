/**
 * API Layer Exports
 * 
 * Main exports for the Zitadel API layer
 * Includes both gRPC and REST API implementations
 */

// gRPC API
export * from './server';
export * from './grpc/org/v2';

// Proto types
export * from './grpc/proto/org/v2/org';
export * from './grpc/proto/org/v2/org_service';
export * from './grpc/proto/object/v2/object';
export * from './grpc/proto/user/v2/user';

// REST API
export * from './rest';
