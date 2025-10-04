/**
 * Admin service module
 */

export * from './types';
export * from './admin-service';

export type {
  AdminService,
  InstanceConfig,
  SystemStats,
  AuditLogEntry,
  UpdateInstanceConfigRequest,
  AuditLogQueryOptions,
} from './types';

export {
  AdminServiceError,
  InsufficientPrivilegesError,
} from './types';

export {
  DefaultAdminService,
  createAdminService,
} from './admin-service';
