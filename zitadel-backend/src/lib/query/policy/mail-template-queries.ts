/**
 * Mail Template Queries
 * Handles mail template queries with 2-level inheritance
 * Based on Zitadel Go internal/query/mail_template.go
 */

import { DatabasePool } from '../../database';
import { MailTemplate } from './mail-template-types';

export class MailTemplateQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get mail template with inheritance (org → instance → built-in)
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Optional organization ID for org-specific template
   * @returns Mail template (org-specific, instance, or built-in default)
   */
  async getMailTemplate(
    instanceID: string,
    organizationID?: string
  ): Promise<MailTemplate> {
    if (organizationID) {
      // Try org-specific template first
      const orgTemplate = await this.getOrgMailTemplate(instanceID, organizationID);
      if (orgTemplate) {
        return orgTemplate;
      }
    }

    // Fall back to instance template or built-in default
    return this.getDefaultMailTemplate(instanceID);
  }

  /**
   * Get default (instance-level) mail template
   * 
   * @param instanceID - Instance ID
   * @returns Default mail template
   */
  async getDefaultMailTemplate(instanceID: string): Promise<MailTemplate> {
    const query = `
      SELECT 
        aggregate_id,
        instance_id,
        creation_date,
        change_date,
        sequence,
        template,
        is_default
      FROM projections.mail_templates
      WHERE instance_id = $1 AND is_default = true
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID]);

    if (!result) {
      // Return built-in default if no instance template exists
      return this.getBuiltInDefault(instanceID);
    }

    return this.mapToTemplate(result);
  }

  /**
   * Get organization-specific mail template
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns Organization template or null
   */
  private async getOrgMailTemplate(
    instanceID: string,
    organizationID: string
  ): Promise<MailTemplate | null> {
    const query = `
      SELECT 
        aggregate_id,
        instance_id,
        organization_id,
        creation_date,
        change_date,
        sequence,
        template,
        is_default
      FROM projections.mail_templates
      WHERE instance_id = $1 AND organization_id = $2 AND is_default = false
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, organizationID]);

    if (!result) {
      return null;
    }

    return this.mapToTemplate(result);
  }

  /**
   * Get built-in default mail template
   * Basic HTML template when no custom template is configured
   */
  private getBuiltInDefault(instanceID: string): MailTemplate {
    const defaultTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{.Title}}</title>
</head>
<body>
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1>{{.Title}}</h1>
    <p>{{.PreHeader}}</p>
    <div>{{.Content}}</div>
    <hr>
    <p style="color: #666; font-size: 12px;">{{.Footer}}</p>
  </div>
</body>
</html>
    `.trim();

    return {
      aggregateID: 'built-in-default',
      instanceID,
      creationDate: new Date(),
      changeDate: new Date(),
      sequence: 0,
      template: defaultTemplate,
      isDefault: true,
    };
  }

  /**
   * Map database result to MailTemplate
   */
  private mapToTemplate(row: any): MailTemplate {
    return {
      aggregateID: row.aggregate_id,
      instanceID: row.instance_id,
      organizationID: row.organization_id || undefined,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      template: row.template || '',
      isDefault: row.is_default,
    };
  }
}
