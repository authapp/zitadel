/**
 * Label Policy Queries
 * Based on Zitadel Go internal/query/label_policy.go
 */

import { DatabasePool } from '../../database';
import {
  LabelPolicy,
  ActiveLabelPolicy,
  DEFAULT_LABEL_POLICY,
  ThemeMode,
} from './label-policy-types';

export class LabelPolicyQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get active label policy (combines policy with activation settings)
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID (optional)
   * @returns Active label policy
   */
  async getActiveLabelPolicy(
    instanceID: string,
    organizationID?: string
  ): Promise<ActiveLabelPolicy> {
    const policy = await this.getLabelPolicy(instanceID, organizationID);
    
    // For now, default activateUsers to true
    // In full implementation, this would come from login policy
    return {
      ...policy,
      activateUsers: true,
    };
  }

  /**
   * Get label policy for an organization
   * Falls back to instance default if org policy doesn't exist
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID (optional)
   * @returns Label policy
   */
  async getLabelPolicy(
    instanceID: string,
    organizationID?: string
  ): Promise<LabelPolicy> {
    // Try to get org-specific policy first
    if (organizationID) {
      const orgPolicy = await this.getOrgLabelPolicy(instanceID, organizationID);
      if (orgPolicy) {
        return orgPolicy;
      }
    }

    // Fall back to instance default
    return this.getDefaultLabelPolicy(instanceID);
  }

  /**
   * Get label policy by organization
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns Label policy or falls back to default
   */
  async getLabelPolicyByOrg(
    instanceID: string,
    organizationID: string
  ): Promise<LabelPolicy> {
    return this.getLabelPolicy(instanceID, organizationID);
  }

  /**
   * Get default (instance-level) label policy
   * 
   * @param instanceID - Instance ID
   * @returns Default label policy
   */
  async getDefaultLabelPolicy(instanceID: string): Promise<LabelPolicy> {
    const query = `
      SELECT 
        id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        primary_color,
        background_color,
        warn_color,
        font_color,
        primary_color_dark,
        background_color_dark,
        warn_color_dark,
        font_color_dark,
        logo_url,
        icon_url,
        logo_url_dark,
        icon_url_dark,
        font_url,
        hide_login_name_suffix,
        error_msg_popup,
        disable_watermark,
        theme_mode,
        is_default,
        resource_owner
      FROM projections.label_policies
      WHERE instance_id = $1 AND is_default = true
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID]);

    if (!result) {
      // Return built-in default if no instance policy exists
      return this.getBuiltInDefault(instanceID);
    }

    return this.mapToPolicy(result);
  }

  /**
   * Get organization-specific label policy
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns Organization policy or null
   */
  private async getOrgLabelPolicy(
    instanceID: string,
    organizationID: string
  ): Promise<LabelPolicy | null> {
    const query = `
      SELECT 
        id,
        instance_id,
        organization_id,
        creation_date,
        change_date,
        sequence,
        primary_color,
        background_color,
        warn_color,
        font_color,
        primary_color_dark,
        background_color_dark,
        warn_color_dark,
        font_color_dark,
        logo_url,
        icon_url,
        logo_url_dark,
        icon_url_dark,
        font_url,
        hide_login_name_suffix,
        error_msg_popup,
        disable_watermark,
        theme_mode,
        is_default,
        resource_owner
      FROM projections.label_policies
      WHERE instance_id = $1 AND organization_id = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, organizationID]);

    if (!result) {
      return null;
    }

    return this.mapToPolicy(result);
  }

  /**
   * Get built-in default policy when no instance policy exists
   */
  private getBuiltInDefault(instanceID: string): LabelPolicy {
    return {
      id: 'built-in-default',
      instanceID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: BigInt(0),
      primaryColor: DEFAULT_LABEL_POLICY.primaryColor!,
      backgroundColor: DEFAULT_LABEL_POLICY.backgroundColor!,
      warnColor: DEFAULT_LABEL_POLICY.warnColor!,
      fontColor: DEFAULT_LABEL_POLICY.fontColor!,
      primaryColorDark: DEFAULT_LABEL_POLICY.primaryColorDark!,
      backgroundColorDark: DEFAULT_LABEL_POLICY.backgroundColorDark!,
      warnColorDark: DEFAULT_LABEL_POLICY.warnColorDark!,
      fontColorDark: DEFAULT_LABEL_POLICY.fontColorDark!,
      hideLoginNameSuffix: DEFAULT_LABEL_POLICY.hideLoginNameSuffix!,
      errorMsgPopup: DEFAULT_LABEL_POLICY.errorMsgPopup!,
      disableWatermark: DEFAULT_LABEL_POLICY.disableWatermark!,
      themeMode: DEFAULT_LABEL_POLICY.themeMode!,
      isDefault: true,
      resourceOwner: instanceID,
    };
  }

  /**
   * Map database row to LabelPolicy
   */
  private mapToPolicy(row: any): LabelPolicy {
    return {
      id: row.id,
      instanceID: row.instance_id,
      organizationID: row.organization_id,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: BigInt(row.sequence),
      primaryColor: row.primary_color,
      backgroundColor: row.background_color,
      warnColor: row.warn_color,
      fontColor: row.font_color,
      primaryColorDark: row.primary_color_dark,
      backgroundColorDark: row.background_color_dark,
      warnColorDark: row.warn_color_dark,
      fontColorDark: row.font_color_dark,
      logoURL: row.logo_url,
      iconURL: row.icon_url,
      logoURLDark: row.logo_url_dark,
      iconURLDark: row.icon_url_dark,
      fontURL: row.font_url,
      hideLoginNameSuffix: row.hide_login_name_suffix,
      errorMsgPopup: row.error_msg_popup,
      disableWatermark: row.disable_watermark,
      themeMode: row.theme_mode as ThemeMode,
      isDefault: row.is_default,
      resourceOwner: row.resource_owner,
    };
  }
}
