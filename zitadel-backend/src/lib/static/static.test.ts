import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LocalStorage } from './local/storage';
import {
  LocalStorageConfig,
  FileNotFoundError,
  FileAlreadyExistsError,
} from './types';

describe('LocalStorage', () => {
  let storage: LocalStorage;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zitadel-storage-test-'));
    
    const config: LocalStorageConfig = {
      basePath: tempDir,
      createDirectories: true,
      permissions: {
        files: 0o644,
        directories: 0o755,
      },
    };
    
    storage = new LocalStorage(config);
  });

  afterEach(async () => {
    await storage.close();
    
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('basic operations', () => {
    it('should upload and download files', async () => {
      const testData = Buffer.from('Hello, World!');
      const filePath = 'test/file.txt';

      // Upload file
      const metadata = await storage.upload(filePath, testData);
      expect(metadata.name).toBe('file.txt');
      expect(metadata.size).toBe(testData.length);
      expect(metadata.contentType).toBe('text/plain');

      // Download file
      const downloadedData = await storage.download(filePath);
      expect(Buffer.compare(testData, downloadedData)).toBe(0);
    });

    it('should check file existence', async () => {
      const filePath = 'test/exists.txt';
      
      expect(await storage.exists(filePath)).toBe(false);
      
      await storage.upload(filePath, 'test content');
      expect(await storage.exists(filePath)).toBe(true);
    });

    it('should delete files', async () => {
      const filePath = 'test/delete.txt';
      
      await storage.upload(filePath, 'test content');
      expect(await storage.exists(filePath)).toBe(true);
      
      const deleted = await storage.delete(filePath);
      expect(deleted).toBe(true);
      expect(await storage.exists(filePath)).toBe(false);
      
      // Deleting non-existent file should return false
      const deletedAgain = await storage.delete(filePath);
      expect(deletedAgain).toBe(false);
    });

    it('should get file metadata', async () => {
      const testData = Buffer.from('Test metadata content');
      const filePath = 'test/metadata.txt';

      await storage.upload(filePath, testData);
      
      const metadata = await storage.metadata(filePath);
      expect(metadata).not.toBeNull();
      expect(metadata!.name).toBe('metadata.txt');
      expect(metadata!.size).toBe(testData.length);
      expect(metadata!.contentType).toBe('text/plain');
      expect(metadata!.etag).toBeDefined();
    });

    it('should return null metadata for non-existent files', async () => {
      const metadata = await storage.metadata('non-existent.txt');
      expect(metadata).toBeNull();
    });
  });

  describe('file operations', () => {
    it('should copy files', async () => {
      const testData = Buffer.from('Copy test content');
      const sourcePath = 'source/file.txt';
      const destPath = 'dest/file.txt';

      await storage.upload(sourcePath, testData);
      
      const metadata = await storage.copy(sourcePath, destPath);
      expect(metadata.name).toBe('file.txt');
      
      // Both files should exist
      expect(await storage.exists(sourcePath)).toBe(true);
      expect(await storage.exists(destPath)).toBe(true);
      
      // Content should be the same
      const sourceData = await storage.download(sourcePath);
      const destData = await storage.download(destPath);
      expect(Buffer.compare(sourceData, destData)).toBe(0);
    });

    it('should move files', async () => {
      const testData = Buffer.from('Move test content');
      const sourcePath = 'source/move.txt';
      const destPath = 'dest/move.txt';

      await storage.upload(sourcePath, testData);
      
      const metadata = await storage.move(sourcePath, destPath);
      expect(metadata.name).toBe('move.txt');
      
      // Source should not exist, destination should exist
      expect(await storage.exists(sourcePath)).toBe(false);
      expect(await storage.exists(destPath)).toBe(true);
      
      // Content should be preserved
      const destData = await storage.download(destPath);
      expect(Buffer.compare(testData, destData)).toBe(0);
    });

    it('should throw error when copying non-existent file', async () => {
      await expect(
        storage.copy('non-existent.txt', 'dest.txt')
      ).rejects.toThrow(FileNotFoundError);
    });

    it('should throw error when moving non-existent file', async () => {
      await expect(
        storage.move('non-existent.txt', 'dest.txt')
      ).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('upload options', () => {
    it('should respect overwrite option', async () => {
      const filePath = 'test/overwrite.txt';
      
      await storage.upload(filePath, 'original content');
      
      // Should throw error when overwrite is false
      await expect(
        storage.upload(filePath, 'new content', { overwrite: false })
      ).rejects.toThrow(FileAlreadyExistsError);
      
      // Should succeed when overwrite is true
      await storage.upload(filePath, 'new content', { overwrite: true });
      
      const data = await storage.download(filePath);
      expect(data.toString()).toBe('new content');
    });

    it('should use custom content type', async () => {
      const filePath = 'test/custom.bin';
      const customContentType = 'application/custom';
      
      const metadata = await storage.upload(filePath, 'test', {
        contentType: customContentType,
      });
      
      expect(metadata.contentType).toBe(customContentType);
    });
  });

  describe('download options', () => {
    it('should support range downloads', async () => {
      const testData = Buffer.from('0123456789');
      const filePath = 'test/range.txt';
      
      await storage.upload(filePath, testData);
      
      // Download range
      const rangeData = await storage.download(filePath, {
        range: { start: 2, end: 5 }
      });
      
      expect(rangeData.toString()).toBe('2345');
    });

    it('should support range downloads without end', async () => {
      const testData = Buffer.from('0123456789');
      const filePath = 'test/range2.txt';
      
      await storage.upload(filePath, testData);
      
      // Download from start position to end
      const rangeData = await storage.download(filePath, {
        range: { start: 5 }
      });
      
      expect(rangeData.toString()).toBe('56789');
    });
  });

  describe('listing files', () => {
    it('should list files', async () => {
      await storage.upload('dir1/file1.txt', 'content1');
      await storage.upload('dir1/file2.txt', 'content2');
      await storage.upload('dir2/file3.txt', 'content3');
      
      const allFiles = await storage.list();
      expect(allFiles).toHaveLength(3);
      
      const fileNames = allFiles.map(f => f.name).sort();
      expect(fileNames).toEqual(['file1.txt', 'file2.txt', 'file3.txt']);
    });

    it('should list files with prefix', async () => {
      await storage.upload('dir1/file1.txt', 'content1');
      await storage.upload('dir1/file2.txt', 'content2');
      await storage.upload('dir2/file3.txt', 'content3');
      
      const dir1Files = await storage.list('dir1');
      expect(dir1Files).toHaveLength(2);
      
      const fileNames = dir1Files.map(f => f.name).sort();
      expect(fileNames).toEqual(['file1.txt', 'file2.txt']);
    });

    it('should respect limit', async () => {
      await storage.upload('file1.txt', 'content1');
      await storage.upload('file2.txt', 'content2');
      await storage.upload('file3.txt', 'content3');
      
      const limitedFiles = await storage.list('', 2);
      expect(limitedFiles).toHaveLength(2);
    });
  });

  describe('statistics', () => {
    it('should return storage statistics', async () => {
      await storage.upload('file1.txt', 'content1');
      await storage.upload('file2.txt', 'content2');
      
      const stats = await storage.stats();
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(16); // 8 + 8 bytes
      expect(stats.availableSpace).toBeGreaterThan(0);
    });
  });

  describe('health check', () => {
    it('should return true for healthy storage', async () => {
      const healthy = await storage.health();
      expect(healthy).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw FileNotFoundError for non-existent files', async () => {
      await expect(
        storage.download('non-existent.txt')
      ).rejects.toThrow(FileNotFoundError);
    });
  });
});
