/**
 * Example Server
 * 
 * Example of how to start the Zitadel API server with organization management
 */

import { Commands } from './lib/command/commands';
import { DatabasePool } from './lib/database/pool';
import { PostgresEventstore } from './lib/eventstore/postgres/eventstore';
import { SimpleMemoryCache } from './lib/cache/simple/memory';
import { LocalStorage } from './lib/static/local/storage';
import { SnowflakeGenerator } from './lib/id';
import { startServer } from './api/server';
import * as path from 'path';

/**
 * Main entry point
 */
async function main() {
  // Initialize database pool
  const db = new DatabasePool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'zitadel',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    poolMax: 20,
  });

  try {
    // Test connection
    await db.query('SELECT 1');
    console.log('✅ Database connection successful');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }

  // Initialize components
  const eventstore = new PostgresEventstore(db, {
    instanceID: 'default',
    maxPushBatchSize: 100,
    pushTimeout: 5000,
  });
  console.log('✅ Eventstore initialized');

  const cache = new SimpleMemoryCache({
    defaultTTL: 3600,
    keyPrefix: 'zitadel:',
  });
  console.log('✅ Cache initialized');

  const storage = new LocalStorage({
    basePath: path.join(__dirname, '../data/static'),
    createDirectories: true,
  });
  console.log('✅ Storage initialized');

  const idGenerator = new SnowflakeGenerator({
    machineId: 1,
  });
  console.log('✅ ID Generator initialized');

  // Initialize command layer
  const commands = new Commands(
    eventstore,
    cache,
    storage,
    idGenerator,
    {
      externalDomain: process.env.EXTERNAL_DOMAIN || 'localhost',
      externalSecure: process.env.EXTERNAL_SECURE === 'true',
      externalPort: parseInt(process.env.EXTERNAL_PORT || '8080'),
    }
  );
  console.log('✅ Command layer initialized');

  // Start API server
  await startServer(commands, {
    port: parseInt(process.env.PORT || '8080'),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await db.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server');
    await db.close();
    process.exit(0);
  });
}

// Run if this is the main module
if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export { main };
