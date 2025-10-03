import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  Storage,
  FileMetadata,
  UploadOptions,
  DownloadOptions,
  StorageStats,
  LocalStorageConfig,
  StorageError,
  FileNotFoundError,
  FileAlreadyExistsError,
} from '../types';

/**
 * Local filesystem storage implementation
 */
export class LocalStorage implements Storage {
  private config: Required<LocalStorageConfig>;

  constructor(config: LocalStorageConfig) {
    this.config = {
      basePath: config.basePath,
      createDirectories: config.createDirectories ?? true,
      permissions: {
        files: config.permissions?.files ?? 0o644,
        directories: config.permissions?.directories ?? 0o755,
      },
    };
  }

  async upload(filePath: string, data: Buffer | Uint8Array | string, options?: UploadOptions): Promise<FileMetadata> {
    const fullPath = this.getFullPath(filePath);
    
    // Check if file exists and overwrite is not allowed
    if (!options?.overwrite && await this.exists(filePath)) {
      throw new FileAlreadyExistsError(filePath);
    }

    // Ensure directory exists
    if (this.config.createDirectories) {
      await this.ensureDirectory(path.dirname(fullPath));
    }

    // Convert data to Buffer
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    try {
      // Write file
      await fs.writeFile(fullPath, buffer, { mode: this.config.permissions.files });

      // Get file stats
      const stats = await fs.stat(fullPath);
      
      // Generate ETag
      const etag = crypto.createHash('md5').update(buffer).digest('hex');

      return {
        name: path.basename(filePath),
        size: stats.size,
        contentType: options?.contentType ?? this.getContentType(filePath),
        lastModified: stats.mtime,
        etag,
      };
    } catch (error) {
      throw new StorageError(`Failed to upload file ${filePath}: ${error}`, 'UPLOAD_FAILED');
    }
  }

  async download(filePath: string, options?: DownloadOptions): Promise<Buffer> {
    const fullPath = this.getFullPath(filePath);

    try {
      if (options?.range) {
        // Read file with range
        const fileHandle = await fs.open(fullPath, 'r');
        const { start, end } = options.range;
        const length = end ? end - start + 1 : undefined;
        
        const buffer = Buffer.alloc(length || (await fileHandle.stat()).size - start);
        await fileHandle.read(buffer, 0, buffer.length, start);
        await fileHandle.close();
        
        return buffer;
      } else {
        // Read entire file
        return await fs.readFile(fullPath);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new FileNotFoundError(filePath);
      }
      throw new StorageError(`Failed to download file ${filePath}: ${error}`, 'DOWNLOAD_FAILED');
    }
  }

  async delete(filePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(filePath);

    try {
      await fs.unlink(fullPath);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw new StorageError(`Failed to delete file ${filePath}: ${error}`, 'DELETE_FAILED');
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(filePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async metadata(filePath: string): Promise<FileMetadata | null> {
    const fullPath = this.getFullPath(filePath);

    try {
      const stats = await fs.stat(fullPath);
      
      // Generate ETag by reading file and hashing
      const data = await fs.readFile(fullPath);
      const etag = crypto.createHash('md5').update(data).digest('hex');

      return {
        name: path.basename(filePath),
        size: stats.size,
        contentType: this.getContentType(filePath),
        lastModified: stats.mtime,
        etag,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new StorageError(`Failed to get metadata for ${filePath}: ${error}`, 'METADATA_FAILED');
    }
  }

  async list(prefix = '', limit = 1000): Promise<FileMetadata[]> {
    const searchPath = path.join(this.config.basePath, prefix);
    const files: FileMetadata[] = [];

    try {
      await this.listRecursive(searchPath, this.config.basePath, files, limit);
      return files.slice(0, limit);
    } catch (error) {
      throw new StorageError(`Failed to list files with prefix ${prefix}: ${error}`, 'LIST_FAILED');
    }
  }

  async copy(sourcePath: string, destinationPath: string): Promise<FileMetadata> {
    const sourceFullPath = this.getFullPath(sourcePath);
    const destFullPath = this.getFullPath(destinationPath);

    try {
      // Ensure destination directory exists
      if (this.config.createDirectories) {
        await this.ensureDirectory(path.dirname(destFullPath));
      }

      // Copy file
      await fs.copyFile(sourceFullPath, destFullPath);

      // Set permissions
      await fs.chmod(destFullPath, this.config.permissions.files!);

      // Return metadata of destination file
      return await this.metadata(destinationPath) as FileMetadata;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new FileNotFoundError(sourcePath);
      }
      throw new StorageError(`Failed to copy ${sourcePath} to ${destinationPath}: ${error}`, 'COPY_FAILED');
    }
  }

  async move(sourcePath: string, destinationPath: string): Promise<FileMetadata> {
    const sourceFullPath = this.getFullPath(sourcePath);
    const destFullPath = this.getFullPath(destinationPath);

    try {
      // Ensure destination directory exists
      if (this.config.createDirectories) {
        await this.ensureDirectory(path.dirname(destFullPath));
      }

      // Move file
      await fs.rename(sourceFullPath, destFullPath);

      // Return metadata of destination file
      return await this.metadata(destinationPath) as FileMetadata;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new FileNotFoundError(sourcePath);
      }
      throw new StorageError(`Failed to move ${sourcePath} to ${destinationPath}: ${error}`, 'MOVE_FAILED');
    }
  }

  async stats(): Promise<StorageStats> {
    try {
      const files = await this.list();
      const totalFiles = files.length;
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      // Get available space
      const stats = await fs.statfs(this.config.basePath);
      const availableSpace = stats.bavail * stats.bsize;

      return {
        totalFiles,
        totalSize,
        availableSpace,
      };
    } catch (error) {
      throw new StorageError(`Failed to get storage stats: ${error}`, 'STATS_FAILED');
    }
  }

  async health(): Promise<boolean> {
    try {
      // Test write/read/delete operations
      const testPath = path.join(this.config.basePath, '.health-check');
      const testData = Buffer.from('health-check');

      await fs.writeFile(testPath, testData);
      const readData = await fs.readFile(testPath);
      await fs.unlink(testPath);

      return Buffer.compare(testData, readData) === 0;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // No connections to close for local storage
  }

  // Private helper methods

  private getFullPath(filePath: string): string {
    // Normalize and join paths to prevent directory traversal
    const normalizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.config.basePath, normalizedPath);
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { 
        recursive: true, 
        mode: this.config.permissions.directories 
      });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async listRecursive(
    currentPath: string, 
    basePath: string, 
    files: FileMetadata[], 
    limit: number
  ): Promise<void> {
    if (files.length >= limit) {
      return;
    }

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= limit) {
          break;
        }

        const fullPath = path.join(currentPath, entry.name);

        if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          files.push({
            name: entry.name,
            size: stats.size,
            contentType: this.getContentType(entry.name),
            lastModified: stats.mtime,
          });
        } else if (entry.isDirectory()) {
          await this.listRecursive(fullPath, basePath, files, limit);
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
