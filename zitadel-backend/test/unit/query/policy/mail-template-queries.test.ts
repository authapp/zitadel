/**
 * Unit tests for Mail Template Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MailTemplateQueries } from '../../../../src/lib/query/policy/mail-template-queries';
import { DatabasePool } from '../../../../src/lib/database';

describe('MailTemplateQueries', () => {
  let queries: MailTemplateQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'test-instance-123';
  const TEST_ORG_ID = 'test-org-456';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new MailTemplateQueries(mockDatabase);
  });

  describe('getBuiltInDefault', () => {
    it('should return built-in default HTML template when no templates exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const template = await queries.getDefaultMailTemplate(TEST_INSTANCE_ID);

      expect(template.aggregateID).toBe('built-in-default');
      expect(template.template).toContain('<!DOCTYPE html>');
      expect(template.template).toContain('{{.Title}}');
      expect(template.template).toContain('{{.Content}}');
      expect(template.isDefault).toBe(true);
    });
  });

  describe('getDefaultMailTemplate', () => {
    it('should return instance-level template', async () => {
      const mockTemplate = {
        aggregate_id: 'template-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        template: '<html><body>Custom Template</body></html>',
        is_default: true,
      };

      mockDatabase.queryOne.mockResolvedValue(mockTemplate);

      const template = await queries.getDefaultMailTemplate(TEST_INSTANCE_ID);

      expect(template.aggregateID).toBe('template-1');
      expect(template.template).toBe('<html><body>Custom Template</body></html>');
      expect(template.isDefault).toBe(true);
    });
  });

  describe('getMailTemplate (2-level inheritance)', () => {
    it('should return org-specific template when it exists', async () => {
      const mockOrgTemplate = {
        aggregate_id: 'org-template-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        template: '<html><body>Org Custom Template</body></html>',
        is_default: false,
      };

      mockDatabase.queryOne.mockResolvedValue(mockOrgTemplate);

      const template = await queries.getMailTemplate(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(template.aggregateID).toBe('org-template-1');
      expect(template.organizationID).toBe(TEST_ORG_ID);
      expect(template.template).toBe('<html><body>Org Custom Template</body></html>');
      expect(template.isDefault).toBe(false);
    });

    it('should fall back to instance template when no org template exists', async () => {
      const mockInstanceTemplate = {
        aggregate_id: 'instance-template-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date(),
        change_date: new Date(),
        sequence: 1,
        template: '<html><body>Instance Template</body></html>',
        is_default: true,
      };

      mockDatabase.queryOne
        .mockResolvedValueOnce(null) // No org template
        .mockResolvedValueOnce(mockInstanceTemplate); // Instance template

      const template = await queries.getMailTemplate(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(template.aggregateID).toBe('instance-template-1');
      expect(template.organizationID).toBeUndefined();
      expect(template.template).toBe('<html><body>Instance Template</body></html>');
      expect(template.isDefault).toBe(true);
    });

    it('should fall back to built-in default when no templates exist', async () => {
      mockDatabase.queryOne.mockResolvedValue(null);

      const template = await queries.getMailTemplate(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(template.aggregateID).toBe('built-in-default');
      expect(template.template).toContain('<!DOCTYPE html>');
      expect(template.isDefault).toBe(true);
    });
  });

  describe('field mapping', () => {
    it('should correctly map all fields from database', async () => {
      const now = new Date();
      const mockTemplate = {
        aggregate_id: 'template-123',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: now,
        change_date: now,
        sequence: 42,
        template: '<html><body>Test Template with {{.Variable}}</body></html>',
        is_default: false,
      };

      mockDatabase.queryOne.mockResolvedValue(mockTemplate);

      const template = await queries.getMailTemplate(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(template.aggregateID).toBe('template-123');
      expect(template.instanceID).toBe(TEST_INSTANCE_ID);
      expect(template.organizationID).toBe(TEST_ORG_ID);
      expect(template.creationDate).toBe(now);
      expect(template.changeDate).toBe(now);
      expect(template.sequence).toBe(42);
      expect(template.template).toBe('<html><body>Test Template with {{.Variable}}</body></html>');
      expect(template.isDefault).toBe(false);
    });
  });
});
