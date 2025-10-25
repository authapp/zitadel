/**
 * Domain and Label Policy Projection - materializes domain and label policy events
 * Manages domain settings and branding/theming policies
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class DomainLabelPolicyProjection extends Projection {
  readonly name = 'domain_label_policy_projection';
  readonly tables = ['domain_policies', 'label_policies'];

  async init(): Promise<void> {
    // Create domain_policies table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.domain_policies (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        organization_id TEXT,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        user_login_must_be_domain BOOLEAN NOT NULL DEFAULT false,
        validate_org_domains BOOLEAN NOT NULL DEFAULT false,
        smtp_sender_address_matches_instance_domain BOOLEAN NOT NULL DEFAULT false,
        is_default BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create label_policies table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.label_policies (
        id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        organization_id TEXT,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        resource_owner TEXT NOT NULL,
        primary_color TEXT NOT NULL DEFAULT '#5469d4',
        background_color TEXT NOT NULL DEFAULT '#ffffff',
        warn_color TEXT NOT NULL DEFAULT '#ff3b5b',
        font_color TEXT NOT NULL DEFAULT '#000000',
        primary_color_dark TEXT NOT NULL DEFAULT '#2073c4',
        background_color_dark TEXT NOT NULL DEFAULT '#111827',
        warn_color_dark TEXT NOT NULL DEFAULT '#ff3b5b',
        font_color_dark TEXT NOT NULL DEFAULT '#ffffff',
        logo_url TEXT,
        icon_url TEXT,
        logo_url_dark TEXT,
        icon_url_dark TEXT,
        font_url TEXT,
        hide_login_name_suffix BOOLEAN NOT NULL DEFAULT false,
        error_msg_popup BOOLEAN NOT NULL DEFAULT false,
        disable_watermark BOOLEAN NOT NULL DEFAULT false,
        theme_mode TEXT NOT NULL DEFAULT 'auto',
        is_default BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (instance_id, id)
      )`,
      []
    );

    // Create indexes for domain_policies
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_domain_policies_org 
       ON projections.domain_policies(organization_id, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_domain_policies_default 
       ON projections.domain_policies(is_default, instance_id)`,
      []
    );

    // Create indexes for label_policies
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_label_policies_org 
       ON projections.label_policies(organization_id, instance_id)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_label_policies_default 
       ON projections.label_policies(is_default, instance_id)`,
      []
    );
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      case 'org.domain.policy.added':
      case 'instance.domain.policy.added':
        await this.handleDomainPolicyAdded(event);
        break;

      case 'org.domain.policy.changed':
      case 'instance.domain.policy.changed':
        await this.handleDomainPolicyChanged(event);
        break;

      case 'org.label.policy.added':
      case 'instance.label.policy.added':
        await this.handleLabelPolicyAdded(event);
        break;

      case 'org.label.policy.changed':
      case 'instance.label.policy.changed':
        await this.handleLabelPolicyChanged(event);
        break;

      case 'org.removed':
        await this.handleOrgRemoved(event);
        break;

      case 'instance.removed':
        await this.handleInstanceRemoved(event);
        break;

      default:
        // Unknown event type, ignore
        break;
    }
  }

  private async handleDomainPolicyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const isDefault = event.eventType.includes('instance.');
    const policyID = event.aggregateID;
    const organizationID = isDefault ? null : event.owner;

    await this.query(
      `INSERT INTO projections.domain_policies (
        id, instance_id, organization_id, creation_date, change_date, sequence, resource_owner,
        user_login_must_be_domain, validate_org_domains, smtp_sender_address_matches_instance_domain, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        user_login_must_be_domain = EXCLUDED.user_login_must_be_domain,
        validate_org_domains = EXCLUDED.validate_org_domains,
        smtp_sender_address_matches_instance_domain = EXCLUDED.smtp_sender_address_matches_instance_domain`,
      [
        policyID,
        event.instanceID,
        organizationID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.userLoginMustBeDomain || false,
        payload.validateOrgDomains || false,
        payload.smtpSenderAddressMatchesInstanceDomain || false,
        isDefault,
      ]
    );
  }

  private async handleDomainPolicyChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = event.aggregateID;

    await this.query(
      `UPDATE projections.domain_policies SET
        change_date = $1,
        sequence = $2,
        user_login_must_be_domain = COALESCE($3, user_login_must_be_domain),
        validate_org_domains = COALESCE($4, validate_org_domains),
        smtp_sender_address_matches_instance_domain = COALESCE($5, smtp_sender_address_matches_instance_domain)
      WHERE instance_id = $6 AND id = $7`,
      [
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        payload.userLoginMustBeDomain,
        payload.validateOrgDomains,
        payload.smtpSenderAddressMatchesInstanceDomain,
        event.instanceID,
        policyID,
      ]
    );
  }

  private async handleLabelPolicyAdded(event: Event): Promise<void> {
    const payload = event.payload || {};
    const isDefault = event.eventType.includes('instance.');
    const policyID = event.aggregateID;
    const organizationID = isDefault ? null : event.owner;

    await this.query(
      `INSERT INTO projections.label_policies (
        id, instance_id, organization_id, creation_date, change_date, sequence, resource_owner,
        primary_color, background_color, warn_color, font_color,
        primary_color_dark, background_color_dark, warn_color_dark, font_color_dark,
        logo_url, icon_url, logo_url_dark, icon_url_dark, font_url,
        hide_login_name_suffix, error_msg_popup, disable_watermark, theme_mode, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (instance_id, id) DO UPDATE SET
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence,
        primary_color = EXCLUDED.primary_color,
        background_color = EXCLUDED.background_color,
        warn_color = EXCLUDED.warn_color,
        font_color = EXCLUDED.font_color,
        primary_color_dark = EXCLUDED.primary_color_dark,
        background_color_dark = EXCLUDED.background_color_dark,
        warn_color_dark = EXCLUDED.warn_color_dark,
        font_color_dark = EXCLUDED.font_color_dark,
        logo_url = EXCLUDED.logo_url,
        icon_url = EXCLUDED.icon_url,
        logo_url_dark = EXCLUDED.logo_url_dark,
        icon_url_dark = EXCLUDED.icon_url_dark,
        font_url = EXCLUDED.font_url,
        hide_login_name_suffix = EXCLUDED.hide_login_name_suffix,
        error_msg_popup = EXCLUDED.error_msg_popup,
        disable_watermark = EXCLUDED.disable_watermark,
        theme_mode = EXCLUDED.theme_mode`,
      [
        policyID,
        event.instanceID,
        organizationID,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion || 1n),
        event.owner,
        payload.primaryColor || '#5469d4',
        payload.backgroundColor || '#ffffff',
        payload.warnColor || '#ff3b5b',
        payload.fontColor || '#000000',
        payload.primaryColorDark || '#2073c4',
        payload.backgroundColorDark || '#111827',
        payload.warnColorDark || '#ff3b5b',
        payload.fontColorDark || '#ffffff',
        payload.logoURL || null,
        payload.iconURL || null,
        payload.logoURLDark || null,
        payload.iconURLDark || null,
        payload.fontURL || null,
        payload.hideLoginNameSuffix || false,
        payload.errorMsgPopup || false,
        payload.disableWatermark || false,
        payload.themeMode || 'auto',
        isDefault,
      ]
    );
  }

  private async handleLabelPolicyChanged(event: Event): Promise<void> {
    const payload = event.payload || {};
    const policyID = event.aggregateID;

    const updates: string[] = ['change_date = $1', 'sequence = $2'];
    const values: any[] = [event.createdAt, Number(event.aggregateVersion || 1n)];
    let paramIndex = 3;

    // Only update fields that are provided in the payload
    const fieldMappings: [string, string, any][] = [
      ['primaryColor', 'primary_color', payload.primaryColor],
      ['backgroundColor', 'background_color', payload.backgroundColor],
      ['warnColor', 'warn_color', payload.warnColor],
      ['fontColor', 'font_color', payload.fontColor],
      ['primaryColorDark', 'primary_color_dark', payload.primaryColorDark],
      ['backgroundColorDark', 'background_color_dark', payload.backgroundColorDark],
      ['warnColorDark', 'warn_color_dark', payload.warnColorDark],
      ['fontColorDark', 'font_color_dark', payload.fontColorDark],
      ['logoURL', 'logo_url', payload.logoURL],
      ['iconURL', 'icon_url', payload.iconURL],
      ['logoURLDark', 'logo_url_dark', payload.logoURLDark],
      ['iconURLDark', 'icon_url_dark', payload.iconURLDark],
      ['fontURL', 'font_url', payload.fontURL],
      ['hideLoginNameSuffix', 'hide_login_name_suffix', payload.hideLoginNameSuffix],
      ['errorMsgPopup', 'error_msg_popup', payload.errorMsgPopup],
      ['disableWatermark', 'disable_watermark', payload.disableWatermark],
      ['themeMode', 'theme_mode', payload.themeMode],
    ];

    for (const [_, dbField, value] of fieldMappings) {
      if (value !== undefined) {
        updates.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    values.push(event.instanceID, policyID);

    await this.query(
      `UPDATE projections.label_policies SET
        ${updates.join(', ')}
      WHERE instance_id = $${paramIndex} AND id = $${paramIndex + 1}`,
      values
    );
  }

  private async handleOrgRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.domain_policies 
       WHERE instance_id = $1 AND organization_id = $2`,
      [event.instanceID, event.aggregateID]
    );

    await this.query(
      `DELETE FROM projections.label_policies 
       WHERE instance_id = $1 AND organization_id = $2`,
      [event.instanceID, event.aggregateID]
    );
  }

  private async handleInstanceRemoved(event: Event): Promise<void> {
    await this.query(
      `DELETE FROM projections.domain_policies 
       WHERE instance_id = $1`,
      [event.instanceID]
    );

    await this.query(
      `DELETE FROM projections.label_policies 
       WHERE instance_id = $1`,
      [event.instanceID]
    );
  }
}

/**
 * Create projection config
 */
export function createDomainLabelPolicyProjectionConfig() {
  return {
    name: 'domain_label_policy_projection',
    tables: ['domain_policies', 'label_policies'],
    eventTypes: [
      'org.domain.policy.added',
      'org.domain.policy.changed',
      'instance.domain.policy.added',
      'instance.domain.policy.changed',
      'org.label.policy.added',
      'org.label.policy.changed',
      'instance.label.policy.added',
      'instance.label.policy.changed',
      'org.removed',
      'instance.removed',
    ],
    interval: 1000,
  };
}
