/**
 * Static file storage types and interfaces for Zitadel
 */

/**
 * File metadata
 */
export interface FileMetadata {
  name: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag?: string;
}

/**
 * File upload options
 */
export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  overwrite?: boolean;
}

/**
 * File download options
 */
export interface DownloadOptions {
  range?: {
    start: number;
    end?: number;
  };
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  availableSpace?: number;
}

/**
 * Main storage interface
 */
export interface Storage {
  /**
   * Upload a file
   */
  upload(path: string, data: Buffer | Uint8Array | string, options?: UploadOptions): Promise<FileMetadata>;

  /**
   * Download a file
   */
  download(path: string, options?: DownloadOptions): Promise<Buffer>;

  /**
   * Delete a file
   */
  delete(path: string): Promise<boolean>;

  /**
   * Check if a file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  metadata(path: string): Promise<FileMetadata | null>;

  /**
   * List files in a directory
   */
  list(prefix?: string, limit?: number): Promise<FileMetadata[]>;

  /**
   * Copy a file
   */
  copy(sourcePath: string, destinationPath: string): Promise<FileMetadata>;

  /**
   * Move a file
   */
  move(sourcePath: string, destinationPath: string): Promise<FileMetadata>;

  /**
   * Get storage statistics
   */
  stats(): Promise<StorageStats>;

  /**
   * Health check
   */
  health(): Promise<boolean>;

  /**
   * Close storage connections
   */
  close(): Promise<void>;
}

/**
 * Local filesystem storage configuration
 */
export interface LocalStorageConfig {
  basePath: string;
  createDirectories?: boolean;
  permissions?: {
    files?: number;
    directories?: number;
  };
}

/**
 * S3-compatible storage configuration
 */
export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  useSSL?: boolean;
  pathStyle?: boolean;
}

/**
 * Storage error types
 */
export class StorageError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class FileNotFoundError extends StorageError {
  constructor(path: string) {
    super(`File not found: ${path}`, 'FILE_NOT_FOUND');
    this.name = 'FileNotFoundError';
  }
}

export class FileAlreadyExistsError extends StorageError {
  constructor(path: string) {
    super(`File already exists: ${path}`, 'FILE_ALREADY_EXISTS');
    this.name = 'FileAlreadyExistsError';
  }
}

export class InsufficientSpaceError extends StorageError {
  constructor(required: number, available: number) {
    super(`Insufficient space: required ${required} bytes, available ${available} bytes`, 'INSUFFICIENT_SPACE');
    this.name = 'InsufficientSpaceError';
  }
}
