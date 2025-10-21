/**
 * Unit tests for Text Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TextQueries } from '../../../../src/lib/query/text/text-queries';
import { DatabasePool } from '../../../../src/lib/database';

describe('TextQueries', () => {
  let queries: TextQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new TextQueries(mockDatabase);
  });

  describe('Custom Text', () => {
    describe('getCustomTextsByTemplate', () => {
      it('should return custom texts for template', async () => {
        const mockTexts = [
          {
            aggregate_id: 'text-1',
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 1,
            language: 'en',
            template: 'Login',
            key: 'title',
            text: 'Custom Login Title',
            is_default: false,
          },
          {
            aggregate_id: 'text-2',
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 2,
            language: 'en',
            template: 'Login',
            key: 'description',
            text: 'Custom description',
            is_default: false,
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockTexts } as any);

        const texts = await queries.getCustomTextsByTemplate(TEST_INSTANCE_ID, 'en', 'Login');

        expect(texts).toHaveLength(2);
        expect(texts[0].key).toBe('title');
        expect(texts[0].text).toBe('Custom Login Title');
        expect(texts[1].key).toBe('description');
      });

      it('should return empty array when no custom texts exist', async () => {
        mockDatabase.query.mockResolvedValue({ rows: [] } as any);

        const texts = await queries.getCustomTextsByTemplate(TEST_INSTANCE_ID, 'en', 'Login');

        expect(texts).toHaveLength(0);
      });
    });

    describe('getDefaultLoginTexts', () => {
      it('should return default login texts', () => {
        const texts = queries.getDefaultLoginTexts('en');

        expect(texts.length).toBeGreaterThan(0);
        expect(texts.find(t => t.key === 'title')).toBeTruthy();
        expect(texts.find(t => t.key === 'loginButton')).toBeTruthy();
        expect(texts.every(t => t.isDefault)).toBe(true);
        expect(texts.every(t => t.template === 'Login')).toBe(true);
      });
    });
  });

  describe('Message Text', () => {
    describe('getCustomMessageText', () => {
      it('should return custom message text when it exists', async () => {
        const mockText = {
          aggregate_id: 'msg-1',
          instance_id: TEST_INSTANCE_ID,
          creation_date: new Date(),
          change_date: new Date(),
          sequence: 1,
          message_type: 'InitCode',
          language: 'en',
          title: 'Custom Init Title',
          pre_header: 'Welcome',
          subject: 'Initialize Your Account',
          greeting: 'Hello User',
          text: 'Your code is {{.Code}}',
          button_text: 'Start Now',
          footer_text: 'Custom footer',
          is_default: false,
        };

        mockDatabase.queryOne.mockResolvedValue(mockText);

        const text = await queries.getCustomMessageText(TEST_INSTANCE_ID, 'InitCode', 'en');

        expect(text).toBeTruthy();
        expect(text!.title).toBe('Custom Init Title');
        expect(text!.greeting).toBe('Hello User');
        expect(text!.isDefault).toBe(false);
      });

      it('should return default when no custom text exists', async () => {
        mockDatabase.queryOne.mockResolvedValue(null);

        const text = await queries.getCustomMessageText(TEST_INSTANCE_ID, 'PasswordReset', 'en');

        expect(text).toBeTruthy();
        expect(text!.messageType).toBe('PasswordReset');
        expect(text!.isDefault).toBe(true);
        expect(text!.title).toContain('Password');
      });
    });

    describe('getDefaultMessageText', () => {
      it('should return default text for InitCode', () => {
        const text = queries.getDefaultMessageText('InitCode', 'en');

        expect(text.messageType).toBe('InitCode');
        expect(text.isDefault).toBe(true);
        expect(text.title).toContain('Initialize');
      });

      it('should return default text for PasswordReset', () => {
        const text = queries.getDefaultMessageText('PasswordReset', 'en');

        expect(text.messageType).toBe('PasswordReset');
        expect(text.title).toContain('Password');
      });

      it('should return default text for all message types', () => {
        const types = queries.listMessageTextTypes();

        types.forEach(type => {
          const text = queries.getDefaultMessageText(type, 'en');
          expect(text.messageType).toBe(type);
          expect(text.isDefault).toBe(true);
        });
      });
    });

    describe('listMessageTextTypes', () => {
      it('should return all message text types', () => {
        const types = queries.listMessageTextTypes();

        expect(types).toContain('InitCode');
        expect(types).toContain('PasswordReset');
        expect(types).toContain('VerifyEmail');
        expect(types.length).toBeGreaterThan(0);
      });
    });

    describe('getAllMessageTexts', () => {
      it('should return all message texts for instance', async () => {
        const mockTexts = [
          {
            aggregate_id: 'msg-1',
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 1,
            message_type: 'InitCode',
            language: 'en',
            title: 'Title 1',
            pre_header: '',
            subject: 'Subject 1',
            greeting: 'Hello',
            text: 'Text 1',
            button_text: 'Button 1',
            footer_text: 'Footer',
            is_default: false,
          },
          {
            aggregate_id: 'msg-2',
            instance_id: TEST_INSTANCE_ID,
            creation_date: new Date(),
            change_date: new Date(),
            sequence: 2,
            message_type: 'PasswordReset',
            language: 'en',
            title: 'Title 2',
            pre_header: '',
            subject: 'Subject 2',
            greeting: 'Hello',
            text: 'Text 2',
            button_text: 'Button 2',
            footer_text: 'Footer',
            is_default: false,
          },
        ];

        mockDatabase.query.mockResolvedValue({ rows: mockTexts } as any);

        const texts = await queries.getAllMessageTexts(TEST_INSTANCE_ID, 'en');

        expect(texts).toHaveLength(2);
        expect(texts[0].messageType).toBe('InitCode');
        expect(texts[1].messageType).toBe('PasswordReset');
      });
    });
  });
});
