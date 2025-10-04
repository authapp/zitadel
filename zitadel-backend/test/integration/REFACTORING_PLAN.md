# Integration Test Refactoring Plan

## 🎯 Problem Statement

The current integration test infrastructure has architectural issues:

### **Issues Identified** ❌

1. **Direct Pool Creation**
   - Creates `new Pool()` directly instead of using `DatabasePool` from source code
   - Doesn't test the actual database connection logic used in production
   - Bypasses error handling and health checks

2. **Schema Duplication**
   - Duplicates schema definitions in `setup.ts`
   - Schemas drift from actual production schemas in `src/lib/eventstore/postgres/schema.sql` and `src/lib/query/postgres/schema.sql`
   - Maintenance nightmare - changes must be made in multiple places

3. **Raw SQL in Fixtures**
   - Uses raw SQL INSERT statements instead of command/query modules
   - Doesn't test the actual data layer used in production
   - Bypasses business logic and validation

4. **Missing Schema Management**
   - No migration system
   - No way to version schemas
   - No rollback capability

---

## ✅ Proposed Solution

### **1. Use Source Code Modules**

#### **Database Connection**
```typescript
// ❌ Current (bypasses source code)
import { Pool } from 'pg';
const pool = new Pool({ host, port, ... });

// ✅ Refactored (uses source code)
import { DatabasePool } from '../../src/lib/database';
const pool = new DatabasePool(TEST_DB_CONFIG);
```

**Benefits**:
- Tests actual production code
- Uses `DatabasePool.health()`, `query()`, `queryOne()`, `queryMany()`
- Error handling tested
- Connection pooling tested

---

#### **Schema Initialization**
```typescript
// ❌ Current (duplicated schemas)
await client.query(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT...
  )
`);

// ✅ Refactored (uses source code schemas)
import { readFileSync } from 'fs';
const eventstoreSchema = readFileSync('src/lib/eventstore/postgres/schema.sql', 'utf-8');
const querySchema = readFileSync('src/lib/query/postgres/schema.sql', 'utf-8');
await pool.query(eventstoreSchema);
await pool.query(querySchema);
```

**Benefits**:
- Single source of truth
- Schemas stay in sync
- Tests actual production schema
- Easy to add new tables

---

#### **Data Operations**
```typescript
// ❌ Current (raw SQL, bypasses business logic)
await pool.query(
  'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
  [id, username, email, hash]
);

// ✅ Option 1: Use Command Bus (tests full stack)
import { CommandBus } from '../../src/lib/command';
import { CreateUserCommand } from '../../src/lib/command/commands';

await commandBus.execute(new CreateUserCommand({
  username: 'test',
  email: 'test@example.com',
  password: 'SecurePass123!',
}));

// ✅ Option 2: Use UserService (tests service layer)
import { UserService } from '../../src/lib/services/user';

await userService.create(context, {
  username: 'test',
  email: 'test@example.com',
  password: 'SecurePass123!',
});

// ✅ Option 3: Use Repository (if exists)
import { UserRepository } from '../../src/lib/repositories/user';

await userRepository.create({
  id: generateId(),
  username: 'test',
  ...
});
```

**Benefits**:
- Tests actual code paths
- Tests business logic
- Tests validation
- Tests error handling
- Tests event sourcing
- Tests projections

---

### **2. Schema Management System**

Create a proper migration system:

```
src/lib/database/
├── migrations/
│   ├── 001_create_eventstore.sql
│   ├── 002_create_projections.sql
│   ├── 003_add_user_fields.sql
│   └── index.ts
└── migrator.ts
```

```typescript
// src/lib/database/migrator.ts
export class DatabaseMigrator {
  constructor(private pool: DatabasePool) {}

  async migrate(): Promise<void> {
    await this.ensureMigrationTable();
    const appliedMigrations = await this.getAppliedMigrations();
    const pendingMigrations = this.getPendingMigrations(appliedMigrations);
    
    for (const migration of pendingMigrations) {
      await this.applyMigration(migration);
    }
  }

  async rollback(steps: number = 1): Promise<void> {
    // Rollback logic
  }
}
```

**CLI Commands** (like Zitadel):
```bash
npm run db:migrate        # Run pending migrations
npm run db:rollback      # Rollback last migration
npm run db:reset         # Reset database
npm run db:seed          # Seed test data
```

---

### **3. Repository Pattern** (If not exists)

If we don't have repositories, create them:

```typescript
// src/lib/repositories/user-repository.ts
export class UserRepository {
  constructor(private pool: DatabasePool) {}

  async create(user: User): Promise<User> {
    const result = await this.pool.queryOne<User>(
      `INSERT INTO users_projection (...)
       VALUES (...) RETURNING *`,
      [...]
    );
    return this.mapToUser(result);
  }

  async findById(id: string): Promise<User | null> {
    return this.pool.queryOne<User>(
      'SELECT * FROM users_projection WHERE id = $1',
      [id]
    );
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.pool.queryOne<User>(
      'SELECT * FROM users_projection WHERE username = $1',
      [username]
    );
  }
}
```

Then use in tests:
```typescript
// test/integration/fixtures-refactored.ts
export async function createTestUser(
  pool: DatabasePool,
  options: CreateUserOptions
): Promise<User> {
  const userRepo = new UserRepository(pool);
  return userRepo.create({
    id: options.id || generateId(),
    username: options.username || `test_${Date.now()}`,
    ...
  });
}
```

---

## 🔄 Migration Path

### **Phase 1: Database Connection** (Quick Win)
- Replace raw `Pool` with `DatabasePool`
- Use existing `query()`, `queryOne()`, `queryMany()` methods
- Estimated: 1 hour

### **Phase 2: Schema Management** (Important)
- Use schema files from source code
- Add migration system
- Estimated: 2-3 hours

### **Phase 3: Repository/Service Usage** (Best Practice)
- Create repositories if missing
- Use services in fixtures
- Use command bus for write operations
- Estimated: 3-4 hours

### **Phase 4: Complete Integration** (Full Stack Testing)
- Test complete workflows (command → event → projection)
- Test business logic
- Test validation
- Estimated: 2-3 hours

---

## 📁 Proposed File Structure

```
src/lib/database/
├── pool.ts                    ✅ EXISTS
├── migrations/
│   ├── 001_create_eventstore.sql  📋 NEW
│   ├── 002_create_projections.sql 📋 NEW
│   └── index.ts               📋 NEW
└── migrator.ts                📋 NEW

src/lib/repositories/          📋 NEW (if needed)
├── user-repository.ts
├── org-repository.ts
└── index.ts

test/integration/
├── setup-refactored.ts        ✅ CREATED
├── fixtures-refactored.ts     📋 TODO
└── REFACTORING_PLAN.md        ✅ THIS FILE
```

---

## 🎯 Benefits of Refactoring

### **Immediate Benefits**
✅ Tests actual production code  
✅ Single source of truth for schemas  
✅ Tests business logic and validation  
✅ Tests event sourcing end-to-end  
✅ Tests error handling  

### **Long-term Benefits**
✅ Easier maintenance  
✅ Schemas stay in sync  
✅ Can add/modify features with confidence  
✅ Migration system for production  
✅ Proper database versioning  

---

## 🚀 Implementation Steps

### **Step 1: Use DatabasePool** (Immediate)
```bash
# Replace setup.ts with setup-refactored.ts
mv test/integration/setup.ts test/integration/setup-old.ts
mv test/integration/setup-refactored.ts test/integration/setup.ts

# Run tests
npm run test:integration
```

### **Step 2: Create Repositories** (If Missing)
```bash
mkdir -p src/lib/repositories
# Create user-repository.ts, org-repository.ts, etc.
```

### **Step 3: Refactor Fixtures**
```typescript
// Use repositories instead of raw SQL
export async function createTestUser(
  pool: DatabasePool,
  options: CreateUserOptions
): Promise<User> {
  const userRepo = new UserRepository(pool);
  // Use repository methods instead of raw SQL
}
```

### **Step 4: Add Migration System**
```bash
mkdir -p src/lib/database/migrations
# Create migrator.ts
# Move schema files to migrations/
```

### **Step 5: Update Tests**
```bash
# Update all test files to use refactored setup
npm run test:integration
```

---

## 📊 Current vs Refactored Comparison

| Aspect | Current ❌ | Refactored ✅ |
|--------|-----------|--------------|
| **Database Connection** | Raw `Pool` | `DatabasePool` (source code) |
| **Schema** | Duplicated in test | Use source code `.sql` files |
| **Data Creation** | Raw SQL INSERT | Repositories/Services |
| **Business Logic** | Bypassed | Tested |
| **Event Sourcing** | Not tested | Fully tested |
| **Validation** | Not tested | Tested |
| **Maintenance** | Update multiple places | Single source of truth |
| **Production Parity** | Low | High |

---

## 🎯 Recommendation

**Start with Phase 1 (DatabasePool)** - Quick win, immediate benefits, no breaking changes to test logic.

The `setup-refactored.ts` file is already created and ready to use. It:
- ✅ Uses `DatabasePool` from source code
- ✅ Uses schema files from `src/lib/eventstore/postgres/schema.sql` and `src/lib/query/postgres/schema.sql`
- ✅ Maintains backward compatibility with existing tests
- ✅ Can be adopted incrementally

**Next Priority**: Create repository pattern if missing, then refactor fixtures to use them.

---

## 💡 Questions to Answer

1. **Do we have repositories in source code?** 
   - If yes: Use them in fixtures
   - If no: Create them (recommended)

2. **Do we want a migration system?**
   - Recommended for production deployment
   - Essential for schema versioning

3. **Should tests use full command/event/projection flow?**
   - Yes for integration tests (tests full stack)
   - No for isolated unit tests (mock dependencies)

4. **How to handle test-specific tables?**
   - Keep minimal
   - Document why they're test-specific
   - Consider if they should be in production

---

**Let's discuss and decide on the best approach! 🚀**
