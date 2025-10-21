/**
 * Unit tests for SMS Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SMSQueries } from '../../../../src/lib/query/sms/sms-queries';
import { SMSConfigState, SMSProviderType } from '../../../../src/lib/query/sms/sms-types';
import { DatabasePool } from '../../../../src/lib/database';

describe('SMSQueries', () => {
  let queries: SMSQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';
  const TEST_ORG_ID = 'test-org-456';
  const TEST_CONFIG_ID = 'sms-config-789';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new SMSQueries(mockDatabase);
  });

  describe('getActiveSMSConfig', () => {
    it('should return active SMS config with Twilio provider', async () => {
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        description: 'Production SMS',
        state: SMSConfigState.ACTIVE,
        provider_type: SMSProviderType.TWILIO,
        twilio_sid: 'AC123456',
        twilio_sender_number: '+15551234567',
        twilio_verify_service_sid: 'VA123456',
        http_endpoint: null,
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getActiveSMSConfig(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(config).toBeTruthy();
      expect(config!.id).toBe(TEST_CONFIG_ID);
      expect(config!.state).toBe(SMSConfigState.ACTIVE);
      expect(config!.providerType).toBe(SMSProviderType.TWILIO);
      expect(config!.twilioSID).toBe('AC123456');
      expect(config!.twilioSenderNumber).toBe('+15551234567');
    });

    it('should return active SMS config with HTTP provider', async () => {
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        description: 'HTTP SMS',
        state: SMSConfigState.ACTIVE,
        provider_type: SMSProviderType.HTTP,
        twilio_sid: null,
        twilio_sender_number: null,
        twilio_verify_service_sid: null,
        http_endpoint: 'https://api.sms-provider.com/send',
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getActiveSMSConfig(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(config).toBeTruthy();
      expect(config!.providerType).toBe(SMSProviderType.HTTP);
      expect(config!.httpEndpoint).toBe('https://api.sms-provider.com/send');
    });

    it('should return null when no active config exists', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const config = await queries.getActiveSMSConfig(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(config).toBeNull();
    });
  });

  describe('getSMSConfig', () => {
    it('should return SMS config by organization', async () => {
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        description: 'Org SMS Config',
        state: SMSConfigState.ACTIVE,
        provider_type: SMSProviderType.TWILIO,
        twilio_sid: 'AC789',
        twilio_sender_number: '+15559876543',
        twilio_verify_service_sid: '',
        http_endpoint: null,
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getSMSConfig(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(config).toBeTruthy();
      expect(config!.resourceOwner).toBe(TEST_ORG_ID);
      expect(config!.twilioSenderNumber).toBe('+15559876543');
    });

    it('should return null when config does not exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const config = await queries.getSMSConfig(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(config).toBeNull();
    });
  });

  describe('getSMSConfigByID', () => {
    it('should return SMS config by ID', async () => {
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        description: 'Test Config',
        state: SMSConfigState.INACTIVE,
        provider_type: SMSProviderType.HTTP,
        twilio_sid: null,
        twilio_sender_number: null,
        twilio_verify_service_sid: null,
        http_endpoint: 'https://test.com/sms',
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getSMSConfigByID(TEST_INSTANCE_ID, TEST_CONFIG_ID);

      expect(config).toBeTruthy();
      expect(config!.id).toBe(TEST_CONFIG_ID);
      expect(config!.state).toBe(SMSConfigState.INACTIVE);
      expect(config!.httpEndpoint).toBe('https://test.com/sms');
    });

    it('should return null when config ID does not exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const config = await queries.getSMSConfigByID(TEST_INSTANCE_ID, 'nonexistent');

      expect(config).toBeNull();
    });
  });

  describe('field mapping', () => {
    it('should correctly map all Twilio fields from database', async () => {
      const now = new Date();
      const mockConfig = {
        id: TEST_CONFIG_ID,
        instance_id: TEST_INSTANCE_ID,
        resource_owner: TEST_ORG_ID,
        creation_date: now,
        change_date: now,
        sequence: 42,
        description: 'Full Twilio Config',
        state: SMSConfigState.ACTIVE,
        provider_type: SMSProviderType.TWILIO,
        twilio_sid: 'AC_FULL',
        twilio_sender_number: '+1234567890',
        twilio_verify_service_sid: 'VA_FULL',
        http_endpoint: null,
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getSMSConfigByID(TEST_INSTANCE_ID, TEST_CONFIG_ID);

      expect(config!.id).toBe(TEST_CONFIG_ID);
      expect(config!.instanceID).toBe(TEST_INSTANCE_ID);
      expect(config!.resourceOwner).toBe(TEST_ORG_ID);
      expect(config!.creationDate).toBe(now);
      expect(config!.changeDate).toBe(now);
      expect(config!.sequence).toBe(42);
      expect(config!.description).toBe('Full Twilio Config');
      expect(config!.state).toBe(SMSConfigState.ACTIVE);
      expect(config!.providerType).toBe(SMSProviderType.TWILIO);
      expect(config!.twilioSID).toBe('AC_FULL');
      expect(config!.twilioSenderNumber).toBe('+1234567890');
      expect(config!.twilioVerifyServiceSID).toBe('VA_FULL');
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
        provider_type: null,
        twilio_sid: null,
        twilio_sender_number: null,
        twilio_verify_service_sid: null,
        http_endpoint: null,
      };

      mockDatabase.queryOne.mockResolvedValue(mockConfig);

      const config = await queries.getSMSConfigByID(TEST_INSTANCE_ID, TEST_CONFIG_ID);

      expect(config!.description).toBe('');
      expect(config!.state).toBe(SMSConfigState.INACTIVE);
      expect(config!.providerType).toBe(SMSProviderType.TWILIO);
    });
  });
});
