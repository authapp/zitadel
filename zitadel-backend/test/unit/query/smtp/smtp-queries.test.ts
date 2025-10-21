/**
 * Unit tests for SMTP Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SMTPQueries } from '../../../../src/lib/query/smtp/smtp-queries';
import { SMTPConfigState } from '../../../../src/lib/query/smtp/smtp-types';
import { DatabasePool } from '../../../../src/lib/database';

describe('SMTPQueries', () => {
  let queries: SMTPQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';
  const TEST_ORG_ID = 'test-org-456';
  const TEST_CONFIG_ID = 'smtp-config-789';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new SMTPQueries(mockDatabase);
  });

  describe('getActiveSMTPConfig', () => {
    it('should return active SMTP config when it exists', async () => {
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        description: 'Production SMTP',
        state: SMTPConfigState.ACTIVE,
        tls: true,
        sender_address: 'noreply@example.com',
        sender_name: 'Example App',
        reply_to_address: 'support@example.com',
        host: 'smtp.example.com',
        smtp_user: 'smtp-user',
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getActiveSMTPConfig(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(config).toBeTruthy();
      expect(config!.id).toBe(TEST_CONFIG_ID);
      expect(config!.state).toBe(SMTPConfigState.ACTIVE);
      expect(config!.senderAddress).toBe('noreply@example.com');
      expect(config!.tls).toBe(true);
    });

    it('should return null when no active config exists', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const config = await queries.getActiveSMTPConfig(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(config).toBeNull();
    });
  });

  describe('getSMTPConfig', () => {
    it('should return SMTP config by organization', async () => {
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        description: 'Org SMTP Config',
        state: SMTPConfigState.ACTIVE,
        tls: true,
        sender_address: 'org@example.com',
        sender_name: 'Organization',
        reply_to_address: 'reply@example.com',
        host: 'mail.example.com',
        smtp_user: 'org-user',
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getSMTPConfig(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(config).toBeTruthy();
      expect(config!.resourceOwner).toBe(TEST_ORG_ID);
      expect(config!.senderAddress).toBe('org@example.com');
    });

    it('should return null when config does not exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const config = await queries.getSMTPConfig(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(config).toBeNull();
    });
  });

  describe('getSMTPConfigByID', () => {
    it('should return SMTP config by ID', async () => {
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        description: 'Test Config',
        state: SMTPConfigState.ACTIVE,
        tls: false,
        sender_address: 'test@example.com',
        sender_name: 'Test',
        reply_to_address: '',
        host: 'localhost',
        smtp_user: 'testuser',
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getSMTPConfigByID(TEST_INSTANCE_ID, TEST_CONFIG_ID);

      expect(config).toBeTruthy();
      expect(config!.id).toBe(TEST_CONFIG_ID);
      expect(config!.host).toBe('localhost');
      expect(config!.tls).toBe(false);
    });

    it('should return null when config ID does not exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const config = await queries.getSMTPConfigByID(TEST_INSTANCE_ID, 'nonexistent');

      expect(config).toBeNull();
    });
  });

  describe('field mapping', () => {
    it('should correctly map all fields from database', async () => {
      const now = new Date();
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: now,
        change_date: now,
        sequence: 42,
        description: 'Full Config',
        state: SMTPConfigState.ACTIVE,
        tls: true,
        sender_address: 'sender@example.com',
        sender_name: 'Sender Name',
        reply_to_address: 'reply@example.com',
        host: 'smtp.example.com',
        smtp_user: 'smtp-username',
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getSMTPConfigByID(TEST_INSTANCE_ID, TEST_CONFIG_ID);

      expect(config!.id).toBe(TEST_CONFIG_ID);
      expect(config!.instanceID).toBe(TEST_INSTANCE_ID);
      expect(config!.resourceOwner).toBe(TEST_ORG_ID);
      expect(config!.creationDate).toBe(now);
      expect(config!.changeDate).toBe(now);
      expect(config!.sequence).toBe(42);
      expect(config!.description).toBe('Full Config');
      expect(config!.state).toBe(SMTPConfigState.ACTIVE);
      expect(config!.tls).toBe(true);
      expect(config!.senderAddress).toBe('sender@example.com');
      expect(config!.senderName).toBe('Sender Name');
      expect(config!.replyToAddress).toBe('reply@example.com');
      expect(config!.host).toBe('smtp.example.com');
      expect(config!.user).toBe('smtp-username');
    });

    it('should handle null/empty values', async () => {
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        description: null,
        state: null,
        tls: null,
        sender_address: null,
        sender_name: null,
        reply_to_address: null,
        host: null,
        smtp_user: null,
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getSMTPConfigByID(TEST_INSTANCE_ID, TEST_CONFIG_ID);

      expect(config!.description).toBe('');
      expect(config!.state).toBe(SMTPConfigState.INACTIVE);
      expect(config!.tls).toBe(false);
      expect(config!.senderAddress).toBe('');
      expect(config!.senderName).toBe('');
      expect(config!.replyToAddress).toBe('');
      expect(config!.host).toBe('');
      expect(config!.user).toBe('');
    });
  });
});
