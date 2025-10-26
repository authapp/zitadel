/**
 * Custom Text Projection - materializes custom text events
 * Manages organization and instance level text customizations for UI and messages
 */

import { Projection } from '../projection/projection';
import { Event } from '../../eventstore/types';

export class CustomTextProjection extends Projection {
  readonly name = 'custom_text_projection';
  readonly tables = ['custom_texts'];

  async init(): Promise<void> {
    // Create custom_texts table
    await this.query(
      `CREATE TABLE IF NOT EXISTS projections.custom_texts (
        instance_id TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        language TEXT NOT NULL,
        key TEXT NOT NULL,
        text TEXT NOT NULL,
        creation_date TIMESTAMPTZ NOT NULL,
        change_date TIMESTAMPTZ NOT NULL,
        sequence BIGINT NOT NULL,
        PRIMARY KEY (instance_id, aggregate_id, aggregate_type, language, key)
      )`,
      []
    );

    // Create indexes for efficient queries
    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_custom_texts_aggregate 
       ON projections.custom_texts(instance_id, aggregate_id, aggregate_type)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_custom_texts_language 
       ON projections.custom_texts(instance_id, language)`,
      []
    );

    await this.query(
      `CREATE INDEX IF NOT EXISTS idx_custom_texts_key 
       ON projections.custom_texts(instance_id, key)`,
      []
    );
  }

  async reduce(event: Event): Promise<void> {
    switch (event.eventType) {
      // Organization custom text events
      case 'org.custom.text.set':
        await this.handleCustomTextSet(event, 'org');
        break;

      case 'org.custom.text.reset':
        await this.handleCustomTextReset(event, 'org');
        break;

      case 'org.custom.message.text.set':
        await this.handleCustomMessageTextSet(event, 'org');
        break;

      case 'org.custom.message.text.reset':
        await this.handleCustomMessageTextReset(event, 'org');
        break;

      // Instance custom text events
      case 'instance.login.custom.text.set':
        await this.handleCustomTextSet(event, 'instance');
        break;

      case 'instance.login.custom.text.reset':
        await this.handleCustomTextReset(event, 'instance');
        break;

      case 'instance.init.message.text.set':
        await this.handleInitMessageTextSet(event);
        break;

      case 'instance.custom.message.text.set':
        await this.handleCustomMessageTextSet(event, 'instance');
        break;

      case 'instance.custom.message.text.reset':
        await this.handleCustomMessageTextReset(event, 'instance');
        break;
    }
  }

  private async handleCustomTextSet(event: Event, aggregateType: string): Promise<void> {
    const payload = event.payload;
    if (!payload) return;

    // For login text with both screen and key, combine them
    let keyValue = payload.key || payload.screen || 'default';
    if (payload.screen && payload.key) {
      keyValue = `${payload.screen}.${payload.key}`;
    }

    await this.query(
      `INSERT INTO projections.custom_texts (
        instance_id, aggregate_id, aggregate_type, language, key, text,
        creation_date, change_date, sequence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (instance_id, aggregate_id, aggregate_type, language, key)
      DO UPDATE SET
        text = EXCLUDED.text,
        change_date = EXCLUDED.change_date,
        sequence = EXCLUDED.sequence`,
      [
        event.instanceID,
        event.aggregateID,
        aggregateType,
        payload.language,
        keyValue,
        payload.text,
        event.createdAt,
        event.createdAt,
        Number(event.aggregateVersion),
      ]
    );
  }

  private async handleCustomTextReset(event: Event, aggregateType: string): Promise<void> {
    const payload = event.payload;
    if (!payload) return;

    // Delete all custom texts for this language
    await this.query(
      `DELETE FROM projections.custom_texts
       WHERE instance_id = $1
         AND aggregate_id = $2
         AND aggregate_type = $3
         AND language = $4`,
      [event.instanceID, event.aggregateID, aggregateType, payload.language]
    );
  }

  private async handleInitMessageTextSet(event: Event): Promise<void> {
    const payload = event.payload;
    if (!payload) return;

    // Store init message template as multiple text entries
    const fields = [
      { key: 'init.title', text: payload.title },
      { key: 'init.preHeader', text: payload.preHeader },
      { key: 'init.subject', text: payload.subject },
      { key: 'init.greeting', text: payload.greeting },
      { key: 'init.text', text: payload.text },
      { key: 'init.buttonText', text: payload.buttonText },
    ];

    for (const field of fields) {
      if (field.text) {
        await this.query(
          `INSERT INTO projections.custom_texts (
            instance_id, aggregate_id, aggregate_type, language, key, text,
            creation_date, change_date, sequence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (instance_id, aggregate_id, aggregate_type, language, key)
          DO UPDATE SET
            text = EXCLUDED.text,
            change_date = EXCLUDED.change_date,
            sequence = EXCLUDED.sequence`,
          [
            event.instanceID,
            event.aggregateID,
            'instance',
            payload.language,
            field.key,
            field.text,
            event.createdAt,
            event.createdAt,
            Number(event.aggregateVersion),
          ]
        );
      }
    }
  }

  private async handleCustomMessageTextSet(event: Event, aggregateType: string): Promise<void> {
    const payload = event.payload;
    if (!payload) return;

    const messageType = payload.messageType || 'default';
    
    // Store message template fields
    const fields = [
      { key: `${messageType}.title`, text: payload.title },
      { key: `${messageType}.preHeader`, text: payload.preHeader },
      { key: `${messageType}.subject`, text: payload.subject },
      { key: `${messageType}.greeting`, text: payload.greeting },
      { key: `${messageType}.text`, text: payload.text },
      { key: `${messageType}.buttonText`, text: payload.buttonText },
      { key: `${messageType}.footerText`, text: payload.footerText },
    ];

    for (const field of fields) {
      if (field.text) {
        await this.query(
          `INSERT INTO projections.custom_texts (
            instance_id, aggregate_id, aggregate_type, language, key, text,
            creation_date, change_date, sequence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (instance_id, aggregate_id, aggregate_type, language, key)
          DO UPDATE SET
            text = EXCLUDED.text,
            change_date = EXCLUDED.change_date,
            sequence = EXCLUDED.sequence`,
          [
            event.instanceID,
            event.aggregateID,
            aggregateType,
            payload.language,
            field.key,
            field.text,
            event.createdAt,
            event.createdAt,
            Number(event.aggregateVersion),
          ]
        );
      }
    }
  }

  private async handleCustomMessageTextReset(event: Event, aggregateType: string): Promise<void> {
    const payload = event.payload;
    if (!payload) return;

    const messageType = payload.messageType || 'default';

    // Delete all custom message texts for this message type and language
    await this.query(
      `DELETE FROM projections.custom_texts
       WHERE instance_id = $1
         AND aggregate_id = $2
         AND aggregate_type = $3
         AND language = $4
         AND key LIKE $5`,
      [event.instanceID, event.aggregateID, aggregateType, payload.language, `${messageType}.%`]
    );
  }
}
