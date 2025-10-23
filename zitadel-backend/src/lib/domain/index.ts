/**
 * Domain Module Exports
 * 
 * Central export point for all domain objects, aggregates, services, and policies
 */

// Core types
export * from './types';

// Value objects
export * from './value-objects';

// Entities
export * from './entities/organization';
export * from './entities/user';
export * from './entities/project';
export * from './entities/application';
export * from './entities/instance';
export * from './entities/session';

// Aggregates
export * from './aggregates/organization-aggregate';
export * from './aggregates/user-aggregate';
export * from './aggregates/project-aggregate';

// Policies
export * from './policies';

// Mappers
export * from './mappers/object-details-mapper';
export * from './mappers/entity-mapper';

// Legacy exports (for backward compatibility)
// Note: Some legacy exports commented out to avoid conflicts with new entity exports
// export * from './permission';  // Conflicts with value-objects (Role) and entities/user (UserGrant)
export * from './phone';
export * from './validators';
// export * from './user';  // Conflicts with entities/user
// export * from './project';  // Conflicts with entities/project
// export * from './organization';  // Conflicts with entities/organization
// export * from './session';  // Conflicts with entities/session
