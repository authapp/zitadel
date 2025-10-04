# 🔄 Migration System - Zitadel-Style Implementation

## Overview

This migration system is inspired by Zitadel's approach and provides:
- ✅ Event-sourced migration tracking
- ✅ Idempotent migrations (can run multiple times safely)
- ✅ Migration states (started, done, failed)
- ✅ Stuck migration detection
- ✅ Repeatable migrations
- ✅ Integration tests with real PostgreSQL
- ✅ Fresh start and resume from last state

---

## Architecture

### **1. Migration Tracking**

Migrations are tracked in **two ways**:

1. **Database Table** (`schema_migrations`):
   - Stores which migrations have been applied
   - Simple version tracking
   - SQL-based

2. **Event Store** (Zitadel-style):
   - Stores migration events: `migration.started`, `migration.done`, `migration.failed`
   - Provides audit trail
   - Enables stuck detection
   - Allows repeatable migrations

### **2. Migration States**

```typescript
enum MigrationState {
  PENDING = 'pending',      // Not yet run
  STARTED = 'started',      // Currently running
  DONE = 'done',            // Completed successfully
  FAILED = 'failed',        // Failed with error
  STUCK = 'stuck',          // Started but never finished
}
```

### **3. Migration Types**

#### **Standard Migration:**
```typescript
interface Migration {
  version: number;
  name: string;
  filename: string;
  execute(pool: DatabasePool): Promise<void>;
}
```

#### **Repeatable Migration:**
```typescript
interface RepeatableMigration extends Migration {
  shouldRepeat(lastRun?: MigrationRun): boolean;
}
```

---

## Usage

### **Running Migrations**

```typescript
// Fresh start - run all pending migrations
const migrator = new DatabaseMigrator(pool);
await migrator.migrate();

// Check current version
const version = await migrator.currentVersion();
console.log(`Current schema version: ${version}`);

// Check migration status
const status = await migrator.status();
console.log(status);
// Output:
// {
//   currentVersion: 2,
//   pending: [],
//   applied: ['001_create_eventstore', '002_create_projections'],
//   failed: []
// }
```

### **Resume from Last State**

```typescript
// Automatically resumes from where it left off
await migrator.migrate();
// - Skips already completed migrations
// - Retries failed migrations
// - Detects and handles stuck migrations
```

### **Detecting Stuck Migrations**

```typescript
// Find migrations that started but never finished
const stuck = await migrator.findStuckMigrations();
if (stuck.length > 0) {
  console.log('Stuck migrations found:', stuck);
  
  // Retry them
  await migrator.retryStuckMigrations();
}
```

---

## Integration Testing

### **Test Strategy (Zitadel-style)**

```typescript
describe('Migration System Integration', () => {
  let pool: DatabasePool;

  beforeEach(async () => {
    // Start with fresh database
    pool = await createTestDatabase();
  });

  afterEach(async () => {
    await pool.close();
  });

  it('should run all migrations from fresh state', async () => {
    const migrator = new DatabaseMigrator(pool);
    
    // Run migrations
    await migrator.migrate();
    
    // Verify schema
    const tables = await pool.queryMany(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public'`
    );
    
    expect(tables).toContainEqual({ table_name: 'events' });
    expect(tables).toContainEqual({ table_name: 'users_projection' });
    expect(tables).toContainEqual({ table_name: 'schema_migrations' });
  });

  it('should resume from last state', async () => {
    const migrator = new DatabaseMigrator(pool);
    
    // Run first migration only
    await migrator.migrateToVersion(1);
    expect(await migrator.currentVersion()).toBe(1);
    
    // Resume - should run remaining migrations
    await migrator.migrate();
    expect(await migrator.currentVersion()).toBe(2);
    
    // Running again should be idempotent
    await migrator.migrate();
    expect(await migrator.currentVersion()).toBe(2);
  });

  it('should detect and handle stuck migrations', async () => {
    // Simulate a stuck migration
    await pool.query(
      `INSERT INTO migration_events (migration_name, event_type, created_at)
       VALUES ($1, $2, NOW() - INTERVAL '10 minutes')`,
      ['001_create_eventstore', 'started']
    );
    
    const stuck = await migrator.findStuckMigrations();
    expect(stuck).toHaveLength(1);
    expect(stuck[0].name).toBe('001_create_eventstore');
  });

  it('should handle migration failures gracefully', async () => {
    // Create a migration that will fail
    const failingMigration = {
      version: 999,
      name: 'failing_migration',
      async execute(pool: DatabasePool) {
        throw new Error('Intentional failure');
      }
    };
    
    const migrator = new DatabaseMigrator(pool);
    migrator.registerMigration(failingMigration);
    
    await expect(migrator.migrate()).rejects.toThrow();
    
    // Check that failure was recorded
    const status = await migrator.status();
    expect(status.failed).toContainEqual('failing_migration');
  });
});
```

---

## Migration File Structure

### **Standard SQL Migration:**

```sql
-- Migration: 001_create_eventstore
-- Description: Create events table for event sourcing
-- Date: 2025-10-04

-- Create table
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_version INTEGER NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_aggregate 
ON events (aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_events_type 
ON events (event_type);
```

### **TypeScript Migration (Custom Logic):**

```typescript
// 003_seed_initial_data.ts
export const migration: Migration = {
  version: 3,
  name: 'seed_initial_data',
  filename: '003_seed_initial_data.ts',
  
  async execute(pool: DatabasePool) {
    // Custom TypeScript logic
    const repo = new UserRepository(pool);
    
    // Create system user
    await repo.create({
      id: 'system',
      instanceId: 'default',
      resourceOwner: 'system',
      username: 'system',
      email: 'system@zitadel.local',
      state: 'active',
    });
    
    console.log('✅ System user created');
  }
};
```

---

## Event-Sourced Migration Tracking

### **Migration Events:**

```typescript
// Events stored in eventstore
interface MigrationEvent {
  aggregate_type: 'migration';
  aggregate_id: string;       // migration name
  event_type: 'migration.started' | 'migration.done' | 'migration.failed';
  event_data: {
    version: number;
    name: string;
    started_at?: string;
    completed_at?: string;
    error?: string;
    duration_ms?: number;
  };
}
```

### **Querying Migration History:**

```typescript
// Get all migration events
const events = await pool.queryMany(
  `SELECT * FROM events 
   WHERE aggregate_type = 'migration' 
   ORDER BY position ASC`
);

// Get current state
const migrationState = await pool.queryOne(
  `SELECT event_data FROM events 
   WHERE aggregate_type = 'migration' 
   AND aggregate_id = $1 
   ORDER BY position DESC LIMIT 1`,
  ['001_create_eventstore']
);
```

---

## Best Practices

### **1. Idempotent Migrations**
Always use `IF NOT EXISTS` / `IF EXISTS`:
```sql
CREATE TABLE IF NOT EXISTS users (...);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_col TEXT;
```

### **2. Migration Naming**
- Use sequential numbers: `001`, `002`, `003`
- Descriptive names: `001_create_eventstore`, `002_create_projections`
- Include date in header comment

### **3. Testing**
- Test migrations on fresh database
- Test resumption from partial state
- Test rollback if supported
- Test with production-like data volume

### **4. Rollback Strategy**
```typescript
interface ReversibleMigration extends Migration {
  async rollback(pool: DatabasePool): Promise<void>;
}
```

### **5. Data Migrations**
- Separate schema migrations from data migrations
- Use repeatable migrations for data fixes
- Always backup before data migrations

---

## CLI Commands

```bash
# Run all pending migrations
npm run db:migrate

# Check migration status
npm run db:migrate:status

# Rollback last migration
npm run db:migrate:rollback

# Reset database (testing only)
npm run db:migrate:reset

# Create new migration
npm run db:migrate:create add_user_avatar
```

---

## Comparison with Zitadel

| Feature | Zitadel (Go) | Our Implementation (TypeScript) |
|---------|--------------|----------------------------------|
| **Library** | tern (jackc/tern) | Custom implementation |
| **Event Tracking** | ✅ Yes | ✅ Yes |
| **State Machine** | ✅ Started/Done/Failed | ✅ Started/Done/Failed |
| **Stuck Detection** | ✅ Yes | ✅ Yes |
| **Repeatable** | ✅ Yes | ✅ Yes |
| **Testing** | ✅ Embedded PostgreSQL | ✅ Docker PostgreSQL |
| **Schema First** | ✅ Yes | ✅ Yes |
| **Rollback** | ✅ Yes (with tern) | 🔄 Optional |

---

## Implementation Files

```
src/lib/database/
├── migrator.ts                    # Main migrator class
├── migration-tracker.ts           # Event-sourced tracking
├── migrations/
│   ├── index.ts                   # Migration registry
│   ├── 001_create_eventstore.sql
│   ├── 002_create_projections.sql
│   └── 003_seed_data.ts           # TypeScript migration
└── cli/
    └── migrate.ts                 # CLI commands

test/integration/
├── migration.integration.test.ts  # Migration tests
└── setup.ts                       # Test database setup
```

---

## Next Steps

1. ✅ Enhance `DatabaseMigrator` with event-sourced tracking
2. ✅ Add stuck migration detection
3. ✅ Create comprehensive integration tests
4. ✅ Add CLI commands for migration management
5. ✅ Support TypeScript migrations with custom logic
6. ✅ Add repeatable migrations
7. ✅ Implement rollback support (optional)

---

**This gives you a production-ready, Zitadel-style migration system with full integration testing support!** 🚀
