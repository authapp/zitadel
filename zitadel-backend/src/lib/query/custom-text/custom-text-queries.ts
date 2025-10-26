/**
 * Custom Text Queries
 * Read operations for custom text projection
 */

import { DatabasePool } from '../../database';

export interface CustomText {
  instanceID: string;
  aggregateID: string;
  aggregateType: string;
  language: string;
  key: string;
  text: string;
  creationDate: Date;
  changeDate: Date;
  sequence: number;
}

export class CustomTextQueries {
  constructor(private pool: DatabasePool) {}

  /**
   * Get custom text by key
   */
  async getCustomText(
    aggregateID: string,
    aggregateType: string,
    language: string,
    key: string,
    instanceID: string
  ): Promise<CustomText | null> {
    const result = await this.pool.queryOne<CustomText>(
      `SELECT 
        instance_id as "instanceID",
        aggregate_id as "aggregateID",
        aggregate_type as "aggregateType",
        language,
        key,
        text,
        creation_date as "creationDate",
        change_date as "changeDate",
        sequence
       FROM projections.custom_texts
       WHERE instance_id = $1
         AND aggregate_id = $2
         AND aggregate_type = $3
         AND language = $4
         AND key = $5`,
      [instanceID, aggregateID, aggregateType, language, key]
    );

    return result || null;
  }

  /**
   * Get all custom texts for an aggregate and language
   */
  async getCustomTextsByLanguage(
    aggregateID: string,
    aggregateType: string,
    language: string,
    instanceID: string
  ): Promise<CustomText[]> {
    const results = await this.pool.queryMany<CustomText>(
      `SELECT 
        instance_id as "instanceID",
        aggregate_id as "aggregateID",
        aggregate_type as "aggregateType",
        language,
        key,
        text,
        creation_date as "creationDate",
        change_date as "changeDate",
        sequence
       FROM projections.custom_texts
       WHERE instance_id = $1
         AND aggregate_id = $2
         AND aggregate_type = $3
         AND language = $4
       ORDER BY key ASC`,
      [instanceID, aggregateID, aggregateType, language]
    );

    return results;
  }

  /**
   * Get all custom texts for an aggregate (all languages)
   */
  async getCustomTextsByAggregate(
    aggregateID: string,
    aggregateType: string,
    instanceID: string
  ): Promise<CustomText[]> {
    const results = await this.pool.queryMany<CustomText>(
      `SELECT 
        instance_id as "instanceID",
        aggregate_id as "aggregateID",
        aggregate_type as "aggregateType",
        language,
        key,
        text,
        creation_date as "creationDate",
        change_date as "changeDate",
        sequence
       FROM projections.custom_texts
       WHERE instance_id = $1
         AND aggregate_id = $2
         AND aggregate_type = $3
       ORDER BY language ASC, key ASC`,
      [instanceID, aggregateID, aggregateType]
    );

    return results;
  }

  /**
   * Get message template texts by message type
   */
  async getMessageTemplateTexts(
    aggregateID: string,
    aggregateType: string,
    language: string,
    messageType: string,
    instanceID: string
  ): Promise<CustomText[]> {
    const results = await this.pool.queryMany<CustomText>(
      `SELECT 
        instance_id as "instanceID",
        aggregate_id as "aggregateID",
        aggregate_type as "aggregateType",
        language,
        key,
        text,
        creation_date as "creationDate",
        change_date as "changeDate",
        sequence
       FROM projections.custom_texts
       WHERE instance_id = $1
         AND aggregate_id = $2
         AND aggregate_type = $3
         AND language = $4
         AND key LIKE $5
       ORDER BY key ASC`,
      [instanceID, aggregateID, aggregateType, language, `${messageType}.%`]
    );

    return results;
  }

  /**
   * Check if custom text exists
   */
  async customTextExists(
    aggregateID: string,
    aggregateType: string,
    language: string,
    key: string,
    instanceID: string
  ): Promise<boolean> {
    const result = await this.pool.queryOne<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM projections.custom_texts
        WHERE instance_id = $1
          AND aggregate_id = $2
          AND aggregate_type = $3
          AND language = $4
          AND key = $5
      ) as exists`,
      [instanceID, aggregateID, aggregateType, language, key]
    );

    return result?.exists || false;
  }
}
