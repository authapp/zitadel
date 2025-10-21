/**
 * SMTP Configuration Queries
 * Handles SMTP email delivery configuration queries
 * Based on Zitadel Go internal/query/smtp.go
 */

import { DatabasePool } from '../../database';
import { SMTPConfig, SMTPConfigState } from './smtp-types';

export class SMTPQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get active SMTP configuration for resource owner
   * Returns the currently active SMTP config for sending emails
   * 
   * @param instanceID - Instance ID
   * @param resourceOwner - Resource owner (typically org or instance ID)
   * @returns Active SMTP configuration or null
   */
  async getActiveSMTPConfig(
    instanceID: string,
    resourceOwner: string
  ): Promise<SMTPConfig | null> {
    const query = `
      SELECT 
        id,
        instance_id,
        resource_owner,
        creation_date,
        change_date,
        sequence,
        description,
        state,
        tls,
        sender_address,
        sender_name,
        reply_to_address,
        host,
        smtp_user
      FROM projections.smtp_configs
      WHERE instance_id = $1 
        AND resource_owner = $2 
        AND state = $3
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [
      instanceID,
      resourceOwner,
      SMTPConfigState.ACTIVE,
    ]);

    if (!result) {
      return null;
    }

    return this.mapToConfig(result);
  }

  /**
   * Get SMTP configuration by organization
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns SMTP configuration or null
   */
  async getSMTPConfig(
    instanceID: string,
    organizationID: string
  ): Promise<SMTPConfig | null> {
    const query = `
      SELECT 
        id,
        instance_id,
        resource_owner,
        creation_date,
        change_date,
        sequence,
        description,
        state,
        tls,
        sender_address,
        sender_name,
        reply_to_address,
        host,
        smtp_user
      FROM projections.smtp_configs
      WHERE instance_id = $1 AND resource_owner = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, organizationID]);

    if (!result) {
      return null;
    }

    return this.mapToConfig(result);
  }

  /**
   * Get SMTP configuration by ID
   * 
   * @param instanceID - Instance ID
   * @param configID - Configuration ID
   * @returns SMTP configuration or null
   */
  async getSMTPConfigByID(
    instanceID: string,
    configID: string
  ): Promise<SMTPConfig | null> {
    const query = `
      SELECT 
        id,
        instance_id,
        resource_owner,
        creation_date,
        change_date,
        sequence,
        description,
        state,
        tls,
        sender_address,
        sender_name,
        reply_to_address,
        host,
        smtp_user
      FROM projections.smtp_configs
      WHERE instance_id = $1 AND id = $2
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [instanceID, configID]);

    if (!result) {
      return null;
    }

    return this.mapToConfig(result);
  }

  /**
   * Map database result to SMTPConfig
   */
  private mapToConfig(row: any): SMTPConfig {
    return {
      id: row.id,
      instanceID: row.instance_id,
      resourceOwner: row.resource_owner,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      description: row.description || '',
      state: row.state || SMTPConfigState.INACTIVE,
      tls: row.tls || false,
      senderAddress: row.sender_address || '',
      senderName: row.sender_name || '',
      replyToAddress: row.reply_to_address || '',
      host: row.host || '',
      user: row.smtp_user || '',
    };
  }
}
