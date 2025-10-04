# Integration Tests

## Overview

Integration tests verify that services work correctly with real dependencies (PostgreSQL database, event sourcing, etc.) rather than mocked components.

---

## Prerequisites

- **Docker** and **Docker Compose** installed
- **Node.js** 18+ and npm

---

## Quick Start

### 1. Start Test Database

```bash
# Start PostgreSQL test database
npm run db:test:start

# Wait for database to be ready (happens automatically)
```

### 2. Run Integration Tests

```bash
# Run integration tests
npm run test:integration
```

### 3. Stop Test Database

```bash
# Stop and remove test database
npm run db:test:stop
```

---

## Available Scripts

### Test Execution

```bash
# Run unit tests only (fast, no database)
npm run test:unit

# Run integration tests (requires test database)
npm run test:integration

# Run ALL tests with automatic DB setup/teardown
npm run test:integration:full

# Run both unit and integration tests
npm run test:all
```

### Database Management

```bash
# Start test database
npm run db:test:start

# Stop test database
npm run db:test:stop

# View database logs
npm run db:test:logs

# Connect to database shell (psql)
npm run db:test:shell
```

### Manual Test Workflow

```bash
# 1. Start database
npm run db:test:start

# 2. Run tests (can run multiple times)
npm run test:integration

# 3. Check database if needed
npm run db:test:shell

# 4. Stop database when done
npm run db:test:stop
```

---

## Test Database Configuration

### Docker Compose Setup

```yaml
# docker-compose.test.yml
services:
  test-db:
    image: postgres:17-alpine
    ports:
      - "5433:5432"  # Note: Port 5433 to avoid conflict with local PostgreSQL
    environment:
      POSTGRES_DB: zitadel_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
```

### Connection Details

- **Host**: localhost
- **Port**: 5433
- **Database**: zitadel_test
- **User**: postgres
- **Password**: postgres

### Environment Variables

You can override test database settings:

```bash
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5433
export TEST_DB_NAME=zitadel_test
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=postgres
```

---

## Writing Integration Tests

### File Naming Convention

Integration test files should end with `.integration.test.ts`:

```
test/integration/
├── user-service.integration.test.ts
├── org-service.integration.test.ts
└── auth-flow.integration.test.ts
```

### Test Structure

```typescript
import { Pool } from 'pg';
import { createTestDatabase, cleanDatabase, closeTestDatabase } from './setup';
import { createTestUser, getTestUser } from './fixtures';

describe('Integration: My Service', () => {
  let pool: Pool;

  beforeAll(async () => {
    // Setup database connection
    pool = await createTestDatabase();
  });

  afterAll(async () => {
    // Close database connection
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase(pool);
  });

  it('should test something with real database', async () => {
    // 1. Create test data
    const user = await createTestUser(pool, {
      username: 'testuser',
      email: 'test@example.com',
    });

    // 2. Call service method
    // ... your service calls here ...

    // 3. Verify database state
    const dbUser = await getTestUser(pool, user.id);
    expect(dbUser).not.toBeNull();
  });
});
```

### Best Practices

#### 1. Isolate Tests

Each test should be independent and clean up after itself:

```typescript
beforeEach(async () => {
  await cleanDatabase(pool);
});
```

#### 2. Use Test Fixtures

Use the fixtures module to create test data:

```typescript
import { createTestUser, createTestOrg, createTestProject } from './fixtures';

// Create user
const user = await createTestUser(pool, {
  username: 'testuser',
  email: 'test@example.com',
});

// Create organization
const org = await createTestOrg(pool, {
  name: 'Test Org',
});
```

#### 3. Verify Database State

Always verify that operations actually persisted to the database:

```typescript
// Create via service
const user = await userService.create(...);

// Verify in database
const dbUser = await getTestUser(pool, user.id);
expect(dbUser).not.toBeNull();
expect(dbUser!.username).toBe('testuser');
```

#### 4. Test Event Sourcing

Verify that events are properly stored:

```typescript
import { getTestEvents } from './fixtures';

// Perform action
await userService.create(...);

// Verify events
const events = await getTestEvents(pool, 'user', userId);
expect(events.length).toBeGreaterThan(0);
expect(events[0].eventType).toBe('user.create');
```

---

## Database Schema

The integration test database includes the following tables:

### Core Tables
- **users**: User accounts
- **organizations**: Organizations (multi-tenancy)
- **projects**: Projects within organizations
- **applications**: Applications in projects

### Infrastructure Tables
- **events**: Event sourcing store
- **sessions**: User sessions
- **user_roles**: Role assignments
- **org_members**: Organization membership
- **audit_logs**: Audit trail

See `test/integration/setup.ts` for complete schema.

---

## Troubleshooting

### Database Won't Start

```bash
# Check if port 5433 is already in use
lsof -i :5433

# Stop any existing containers
docker compose -f docker-compose.test.yml down -v

# Try starting again
npm run db:test:start
```

### Tests Fail with Connection Error

```bash
# Check database is running
docker ps | grep zitadel-test-db

# Check database logs
npm run db:test:logs

# Verify connection manually
npm run db:test:shell
```

### Database Has Stale Data

```bash
# Stop and remove all data
npm run db:test:stop

# Start fresh
npm run db:test:start
npm run test:integration
```

### Port Conflict

If port 5433 is in use, you can change it:

1. Edit `docker-compose.test.yml`:
   ```yaml
   ports:
     - "5434:5432"  # Use different port
   ```

2. Set environment variable:
   ```bash
   export TEST_DB_PORT=5434
   npm run test:integration
   ```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_DB: zitadel_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5433:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npm run build
      - run: npm run test:integration
```

---

## Next Steps

### Add More Integration Tests

1. **Organization Service Tests**
   - Multi-tenant isolation
   - Member management
   - Domain configuration

2. **Project Service Tests**
   - Application management
   - Role assignments
   - Permission inheritance

3. **Auth Flow Tests**
   - Complete login flow
   - Token lifecycle
   - Session management
   - MFA verification

4. **Admin Service Tests**
   - System statistics
   - Audit log queries
   - Health checks

### Example Coverage Goals

- **User Service**: 80%+ coverage
- **Organization Service**: 80%+ coverage
- **Project Service**: 80%+ coverage
- **Auth Service**: 90%+ coverage (critical)
- **Admin Service**: 70%+ coverage

---

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [PostgreSQL Docker](https://hub.docker.com/_/postgres)
- [Integration Testing Best Practices](https://martinfowler.com/bliki/IntegrationTest.html)
- [Original Zitadel Testing Strategy](../../E2E_TESTING_STRATEGY.md)

---

## Status

✅ **Phase 1 Complete**: Integration test infrastructure ready
- Database setup utilities
- Test fixtures and factories
- First integration test (user service)
- Docker Compose environment
- npm scripts for test execution

**Current Coverage**: User service integration tests (16 test cases)

**Next**: Add organization, project, and auth flow integration tests
