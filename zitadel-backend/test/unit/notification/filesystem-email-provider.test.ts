/**
 * FileSystem Email Provider Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileSystemEmailProvider } from '../../../src/lib/notification/filesystem-email-provider';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../../.test-emails');

describe('FileSystemEmailProvider', () => {
  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_OUTPUT_DIR, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(TEST_OUTPUT_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Configuration', () => {
    it('should create provider with output directory', () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
      });

      expect(provider.name).toBe('filesystem');
    });

    it('should throw error without output directory', () => {
      expect(() => {
        new FileSystemEmailProvider({} as any);
      }).toThrow('Output directory is required');
    });

    it('should use default format (JSON)', () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
      });

      expect(provider).toBeDefined();
    });

    it('should accept custom format', () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
        format: 'html',
      });

      expect(provider.name).toBe('filesystem');
    });
  });

  describe('Sending Emails', () => {
    it('should write email as JSON file', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
        format: 'json',
      });

      const result = await provider.sendEmail(
        'test@example.com',
        'Test Subject',
        'Test Body'
      );

      expect(result.messageId).toBeDefined();
      expect(result.messageId).toContain('fs_');

      // Check file was created
      const files = await fs.readdir(TEST_OUTPUT_DIR);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('.json');

      // Read and verify content
      const content = await fs.readFile(
        path.join(TEST_OUTPUT_DIR, files[0]),
        'utf-8'
      );
      const emailData = JSON.parse(content);

      expect(emailData.messageId).toBe(result.messageId);
      expect(emailData.to).toBe('test@example.com');
      expect(emailData.subject).toBe('Test Subject');
      expect(emailData.body).toBe('Test Body');
    });

    it('should write email with all fields', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
      });

      await provider.sendEmail(
        ['test1@example.com', 'test2@example.com'],
        'Test Subject',
        'Test Body',
        '<p>HTML</p>',
        ['cc@example.com'],
        ['bcc@example.com']
      );

      const files = await fs.readdir(TEST_OUTPUT_DIR);
      const content = await fs.readFile(
        path.join(TEST_OUTPUT_DIR, files[0]),
        'utf-8'
      );
      const emailData = JSON.parse(content);

      expect(emailData.to).toEqual(['test1@example.com', 'test2@example.com']);
      expect(emailData.html).toBe('<p>HTML</p>');
      expect(emailData.cc).toEqual(['cc@example.com']);
      expect(emailData.bcc).toEqual(['bcc@example.com']);
    });

    it('should create output directory if it does not exist', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
      });

      await provider.sendEmail('test@example.com', 'Subject', 'Body');

      // Verify directory exists
      const stats = await fs.stat(TEST_OUTPUT_DIR);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('File Formats', () => {
    it('should write as plain text', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
        format: 'text',
      });

      await provider.sendEmail('test@example.com', 'Subject', 'Body');

      const files = await fs.readdir(TEST_OUTPUT_DIR);
      expect(files[0]).toContain('.txt');

      const content = await fs.readFile(
        path.join(TEST_OUTPUT_DIR, files[0]),
        'utf-8'
      );

      expect(content).toContain('To: test@example.com');
      expect(content).toContain('Subject: Subject');
      expect(content).toContain('Body');
    });

    it('should write as HTML', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
        format: 'html',
      });

      await provider.sendEmail(
        'test@example.com',
        'Subject',
        'Body',
        '<h1>HTML Content</h1>'
      );

      const files = await fs.readdir(TEST_OUTPUT_DIR);
      expect(files[0]).toContain('.html');

      const content = await fs.readFile(
        path.join(TEST_OUTPUT_DIR, files[0]),
        'utf-8'
      );

      expect(content).toContain('<h1>HTML Content</h1>');
    });

    it('should write as EML format', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
        format: 'eml',
      });

      await provider.sendEmail('test@example.com', 'Subject', 'Body');

      const files = await fs.readdir(TEST_OUTPUT_DIR);
      expect(files[0]).toContain('.eml');

      const content = await fs.readFile(
        path.join(TEST_OUTPUT_DIR, files[0]),
        'utf-8'
      );

      expect(content).toContain('MIME-Version: 1.0');
      expect(content).toContain('To: test@example.com');
      expect(content).toContain('Subject: Subject');
    });

    it('should pretty print JSON', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
        format: 'json',
        prettyPrint: true,
      });

      await provider.sendEmail('test@example.com', 'Subject', 'Body');

      const files = await fs.readdir(TEST_OUTPUT_DIR);
      const content = await fs.readFile(
        path.join(TEST_OUTPUT_DIR, files[0]),
        'utf-8'
      );

      // Pretty printed JSON should have newlines and indentation
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });

    it('should minify JSON when prettyPrint is false', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
        format: 'json',
        prettyPrint: false,
      });

      await provider.sendEmail('test@example.com', 'Subject', 'Body');

      const files = await fs.readdir(TEST_OUTPUT_DIR);
      const content = await fs.readFile(
        path.join(TEST_OUTPUT_DIR, files[0]),
        'utf-8'
      );

      // Minified JSON should be single line
      expect(content.split('\n').length).toBe(1);
    });
  });

  describe('File Management', () => {
    it('should list email files', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
      });

      await provider.sendEmail('test1@example.com', 'Subject 1', 'Body 1');
      await provider.sendEmail('test2@example.com', 'Subject 2', 'Body 2');
      await provider.sendEmail('test3@example.com', 'Subject 3', 'Body 3');

      const emails = await provider.listEmails();
      expect(emails.length).toBe(3);
    });

    it('should clear all emails', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
      });

      await provider.sendEmail('test1@example.com', 'Subject 1', 'Body 1');
      await provider.sendEmail('test2@example.com', 'Subject 2', 'Body 2');

      const emailsBefore = await provider.listEmails();
      expect(emailsBefore.length).toBe(2);

      await provider.clearEmails();

      const emailsAfter = await provider.listEmails();
      expect(emailsAfter.length).toBe(0);
    });

    it('should handle empty directory when listing', async () => {
      const provider = new FileSystemEmailProvider({
        outputDir: TEST_OUTPUT_DIR,
      });

      const emails = await provider.listEmails();
      expect(emails).toEqual([]);
    });
  });
});
