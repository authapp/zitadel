import { LocalStorage } from './local/storage';
import {
  Storage,
  LocalStorageConfig,
} from './types';

/**
 * Create a local storage instance
 */
export function createLocalStorage(config: LocalStorageConfig): Storage {
  return new LocalStorage(config);
}

/**
 * Create storage configuration from environment variables
 */
export function createStorageConfigFromEnv(): {
  local: LocalStorageConfig;
} {
  return {
    local: {
      basePath: process.env.STORAGE_LOCAL_BASE_PATH ?? './storage',
      createDirectories: process.env.STORAGE_LOCAL_CREATE_DIRECTORIES !== 'false',
      permissions: {
        files: parseInt(process.env.STORAGE_LOCAL_FILE_PERMISSIONS ?? '644', 8),
        directories: parseInt(process.env.STORAGE_LOCAL_DIR_PERMISSIONS ?? '755', 8),
      },
    },
  };
}
