import { DatabasePool } from '@/database/pool';
import { PostgresEventstore } from './postgres/eventstore';
import { Eventstore, EventstoreConfig } from './types';

/**
 * Create an eventstore instance
 */
export function createEventstore(
  db: DatabasePool,
  config: EventstoreConfig
): Eventstore {
  return new PostgresEventstore(db, config);
}

/**
 * Create eventstore configuration from environment variables
 */
export function createEventstoreConfigFromEnv(): EventstoreConfig {
  return {
    instanceID: process.env.ZITADEL_INSTANCE_ID ?? 'default',
    maxPushBatchSize: parseInt(process.env.EVENTSTORE_MAX_PUSH_BATCH_SIZE ?? '100', 10),
    pushTimeout: parseInt(process.env.EVENTSTORE_PUSH_TIMEOUT ?? '30000', 10),
  };
}
