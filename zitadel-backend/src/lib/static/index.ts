/**
 * Static file storage module - File storage implementation for Zitadel
 * 
 * This module provides file storage capabilities including:
 * - Local filesystem storage
 * - S3-compatible storage (future)
 * - File upload, download, and management
 * - Metadata and statistics
 * - Health checks and monitoring
 */

export * from './types';
export { LocalStorage } from './local/storage';

// Re-export commonly used types for convenience
export type {
  Storage,
  FileMetadata,
  UploadOptions,
  DownloadOptions,
  StorageStats,
  LocalStorageConfig,
} from './types';

export {
  StorageError,
  FileNotFoundError,
  FileAlreadyExistsError,
  InsufficientSpaceError,
} from './types';
