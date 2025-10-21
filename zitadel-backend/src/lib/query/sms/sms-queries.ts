/**
 * SMS Configuration Queries
 * Handles SMS delivery configuration queries
 * Based on Zitadel Go internal/query/sms.go
 */

import { DatabasePool } from '../../database';
import { SMSConfig, SMSConfigState, SMSProviderType } from './sms-types';

export class SMSQueries {
  constructor(private readonly database: DatabasePool) {}

  /**
   * Get active SMS configuration for resource owner
   * Returns the currently active SMS config for sending messages
   * 
   * @param instanceID - Instance ID
   * @param resourceOwner - Resource owner (typically org or instance ID)
   * @returns Active SMS configuration or null
   */
  async getActiveSMSConfig(
    instanceID: string,
    resourceOwner: string
  ): Promise<SMSConfig | null> {
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
        provider_type,
        twilio_sid,
        twilio_sender_number,
        twilio_verify_service_sid,
        http_endpoint
      FROM projections.sms_configs
      WHERE instance_id = $1 
        AND resource_owner = $2 
        AND state = $3
      LIMIT 1
    `;

    const result = await this.database.queryOne(query, [
      instanceID,
      resourceOwner,
      SMSConfigState.ACTIVE,
    ]);

    if (!result) {
      return null;
    }

    return this.mapToConfig(result);
  }

  /**
   * Get SMS configuration by organization
   * 
   * @param instanceID - Instance ID
   * @param organizationID - Organization ID
   * @returns SMS configuration or null
   */
  async getSMSConfig(
    instanceID: string,
    organizationID: string
  ): Promise<SMSConfig | null> {
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
        provider_type,
        twilio_sid,
        twilio_sender_number,
        twilio_verify_service_sid,
        http_endpoint
      FROM projections.sms_configs
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
   * Get SMS configuration by ID
   * 
   * @param instanceID - Instance ID
   * @param configID - Configuration ID
   * @returns SMS configuration or null
   */
  async getSMSConfigByID(
    instanceID: string,
    configID: string
  ): Promise<SMSConfig | null> {
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
        provider_type,
        twilio_sid,
        twilio_sender_number,
        twilio_verify_service_sid,
        http_endpoint
      FROM projections.sms_configs
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
   * Map database result to SMSConfig
   */
  private mapToConfig(row: any): SMSConfig {
    const config: SMSConfig = {
      id: row.id,
      instanceID: row.instance_id,
      resourceOwner: row.resource_owner,
      creationDate: row.creation_date,
      changeDate: row.change_date,
      sequence: Number(row.sequence),
      description: row.description || '',
      state: row.state || SMSConfigState.INACTIVE,
      providerType: row.provider_type || SMSProviderType.TWILIO,
    };

    // Add provider-specific fields
    if (config.providerType === SMSProviderType.TWILIO) {
      config.twilioSID = row.twilio_sid || '';
      config.twilioSenderNumber = row.twilio_sender_number || '';
      config.twilioVerifyServiceSID = row.twilio_verify_service_sid || '';
    } else if (config.providerType === SMSProviderType.HTTP) {
      config.httpEndpoint = row.http_endpoint || '';
    }

    return config;
  }
}
