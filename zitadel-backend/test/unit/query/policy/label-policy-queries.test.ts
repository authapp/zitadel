/**
 * Unit tests for Label Policy Queries
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LabelPolicyQueries } from '../../../../src/lib/query/policy/label-policy-queries';
import { DatabasePool } from '../../../../src/lib/database';
import { DEFAULT_LABEL_POLICY, ThemeMode } from '../../../../src/lib/query/policy/label-policy-types';

describe('LabelPolicyQueries', () => {
  let queries: LabelPolicyQueries;
  let mockDatabase: jest.Mocked<DatabasePool>;

  const TEST_INSTANCE_ID = 'inst-123';
  const TEST_ORG_ID = 'org-456';

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      queryOne: jest.fn(),
    } as any;

    queries = new LabelPolicyQueries(mockDatabase);
  });

  describe('getActiveLabelPolicy', () => {
    it('should return active label policy with activateUsers', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        primary_color: '#ff0000',
        background_color: '#ffffff',
        warn_color: '#ff3b5b',
        font_color: '#000000',
        primary_color_dark: '#cc0000',
        background_color_dark: '#111827',
        warn_color_dark: '#ff3b5b',
        font_color_dark: '#ffffff',
        logo_url: null,
        icon_url: null,
        logo_url_dark: null,
        icon_url_dark: null,
        font_url: null,
        hide_login_name_suffix: false,
        error_msg_popup: false,
        disable_watermark: false,
        theme_mode: 'auto',
        is_default: false,
        resource_owner: TEST_ORG_ID,
      });

      const policy = await queries.getActiveLabelPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.activateUsers).toBe(true);
      expect(policy.primaryColor).toBe('#ff0000');
    });
  });

  describe('getLabelPolicy', () => {
    it('should return org policy when it exists', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        primary_color: '#custom',
        background_color: '#ffffff',
        warn_color: '#ff3b5b',
        font_color: '#000000',
        primary_color_dark: '#custom-dark',
        background_color_dark: '#111827',
        warn_color_dark: '#ff3b5b',
        font_color_dark: '#ffffff',
        logo_url: 'https://example.com/logo.png',
        icon_url: 'https://example.com/icon.png',
        logo_url_dark: null,
        icon_url_dark: null,
        font_url: null,
        hide_login_name_suffix: true,
        error_msg_popup: true,
        disable_watermark: true,
        theme_mode: 'light',
        is_default: false,
        resource_owner: TEST_ORG_ID,
      });

      const policy = await queries.getLabelPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.primaryColor).toBe('#custom');
      expect(policy.logoURL).toBe('https://example.com/logo.png');
      expect(policy.hideLoginNameSuffix).toBe(true);
      expect(policy.themeMode).toBe(ThemeMode.LIGHT);
    });

    it('should fall back to instance default when org policy does not exist', async () => {
      // First call for org policy returns null
      mockDatabase.queryOne.mockResolvedValueOnce(null);
      
      // Second call for instance default
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        primary_color: '#5469d4',
        background_color: '#ffffff',
        warn_color: '#ff3b5b',
        font_color: '#000000',
        primary_color_dark: '#2073c4',
        background_color_dark: '#111827',
        warn_color_dark: '#ff3b5b',
        font_color_dark: '#ffffff',
        logo_url: null,
        icon_url: null,
        logo_url_dark: null,
        icon_url_dark: null,
        font_url: null,
        hide_login_name_suffix: false,
        error_msg_popup: false,
        disable_watermark: false,
        theme_mode: 'auto',
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getLabelPolicy(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.isDefault).toBe(true);
      expect(policy.primaryColor).toBe('#5469d4');
    });
  });

  describe('getLabelPolicyByOrg', () => {
    it('should return policy for specific organization', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        organization_id: TEST_ORG_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        primary_color: '#org-color',
        background_color: '#ffffff',
        warn_color: '#ff3b5b',
        font_color: '#000000',
        primary_color_dark: '#org-dark',
        background_color_dark: '#111827',
        warn_color_dark: '#ff3b5b',
        font_color_dark: '#ffffff',
        logo_url: null,
        icon_url: null,
        logo_url_dark: null,
        icon_url_dark: null,
        font_url: null,
        hide_login_name_suffix: false,
        error_msg_popup: false,
        disable_watermark: false,
        theme_mode: 'auto',
        is_default: false,
        resource_owner: TEST_ORG_ID,
      });

      const policy = await queries.getLabelPolicyByOrg(TEST_INSTANCE_ID, TEST_ORG_ID);

      expect(policy.organizationID).toBe(TEST_ORG_ID);
      expect(policy.primaryColor).toBe('#org-color');
    });
  });

  describe('getDefaultLabelPolicy', () => {
    it('should return instance default policy', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-default',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        primary_color: '#instance-color',
        background_color: '#ffffff',
        warn_color: '#ff3b5b',
        font_color: '#000000',
        primary_color_dark: '#instance-dark',
        background_color_dark: '#111827',
        warn_color_dark: '#ff3b5b',
        font_color_dark: '#ffffff',
        logo_url: null,
        icon_url: null,
        logo_url_dark: null,
        icon_url_dark: null,
        font_url: null,
        hide_login_name_suffix: false,
        error_msg_popup: false,
        disable_watermark: false,
        theme_mode: 'auto',
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getDefaultLabelPolicy(TEST_INSTANCE_ID);

      expect(policy.isDefault).toBe(true);
      expect(policy.instanceID).toBe(TEST_INSTANCE_ID);
      expect(policy.primaryColor).toBe('#instance-color');
    });

    it('should return built-in default when no instance policy exists', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce(null);

      const policy = await queries.getDefaultLabelPolicy(TEST_INSTANCE_ID);

      expect(policy.id).toBe('built-in-default');
      expect(policy.primaryColor).toBe(DEFAULT_LABEL_POLICY.primaryColor);
      expect(policy.backgroundColor).toBe(DEFAULT_LABEL_POLICY.backgroundColor);
      expect(policy.themeMode).toBe(DEFAULT_LABEL_POLICY.themeMode);
    });
  });

  describe('Branding Settings', () => {
    it('should handle all color settings', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        primary_color: '#custom1',
        background_color: '#custom2',
        warn_color: '#custom3',
        font_color: '#custom4',
        primary_color_dark: '#dark1',
        background_color_dark: '#dark2',
        warn_color_dark: '#dark3',
        font_color_dark: '#dark4',
        logo_url: null,
        icon_url: null,
        logo_url_dark: null,
        icon_url_dark: null,
        font_url: null,
        hide_login_name_suffix: false,
        error_msg_popup: false,
        disable_watermark: false,
        theme_mode: 'auto',
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getDefaultLabelPolicy(TEST_INSTANCE_ID);

      expect(policy.primaryColor).toBe('#custom1');
      expect(policy.backgroundColor).toBe('#custom2');
      expect(policy.warnColor).toBe('#custom3');
      expect(policy.fontColor).toBe('#custom4');
      expect(policy.primaryColorDark).toBe('#dark1');
      expect(policy.backgroundColorDark).toBe('#dark2');
      expect(policy.warnColorDark).toBe('#dark3');
      expect(policy.fontColorDark).toBe('#dark4');
    });

    it('should handle logo and icon URLs', async () => {
      mockDatabase.queryOne.mockResolvedValueOnce({
        id: 'policy-1',
        instance_id: TEST_INSTANCE_ID,
        creation_date: new Date('2024-01-01'),
        change_date: new Date('2024-01-01'),
        sequence: '1',
        primary_color: '#5469d4',
        background_color: '#ffffff',
        warn_color: '#ff3b5b',
        font_color: '#000000',
        primary_color_dark: '#2073c4',
        background_color_dark: '#111827',
        warn_color_dark: '#ff3b5b',
        font_color_dark: '#ffffff',
        logo_url: 'https://example.com/logo.png',
        icon_url: 'https://example.com/icon.png',
        logo_url_dark: 'https://example.com/logo-dark.png',
        icon_url_dark: 'https://example.com/icon-dark.png',
        font_url: 'https://fonts.googleapis.com/css?family=Roboto',
        hide_login_name_suffix: false,
        error_msg_popup: false,
        disable_watermark: false,
        theme_mode: 'auto',
        is_default: true,
        resource_owner: TEST_INSTANCE_ID,
      });

      const policy = await queries.getDefaultLabelPolicy(TEST_INSTANCE_ID);

      expect(policy.logoURL).toBe('https://example.com/logo.png');
      expect(policy.iconURL).toBe('https://example.com/icon.png');
      expect(policy.logoURLDark).toBe('https://example.com/logo-dark.png');
      expect(policy.iconURLDark).toBe('https://example.com/icon-dark.png');
      expect(policy.fontURL).toBe('https://fonts.googleapis.com/css?family=Roboto');
    });

    it('should handle theme modes', async () => {
      for (const mode of ['auto', 'light', 'dark']) {
        mockDatabase.queryOne.mockResolvedValueOnce({
          id: 'policy-1',
          instance_id: TEST_INSTANCE_ID,
          creation_date: new Date('2024-01-01'),
          change_date: new Date('2024-01-01'),
          sequence: '1',
          primary_color: '#5469d4',
          background_color: '#ffffff',
          warn_color: '#ff3b5b',
          font_color: '#000000',
          primary_color_dark: '#2073c4',
          background_color_dark: '#111827',
          warn_color_dark: '#ff3b5b',
          font_color_dark: '#ffffff',
          logo_url: null,
          icon_url: null,
          logo_url_dark: null,
          icon_url_dark: null,
          font_url: null,
          hide_login_name_suffix: false,
          error_msg_popup: false,
          disable_watermark: false,
          theme_mode: mode,
          is_default: true,
          resource_owner: TEST_INSTANCE_ID,
        });

        const policy = await queries.getDefaultLabelPolicy(TEST_INSTANCE_ID);
        expect(policy.themeMode).toBe(mode);
      }
    });
  });
});
