# Testing New Eventstore Features

## Setup

### 1. Ensure Test Database is Running

The tests use a PostgreSQL test database via Docker:

```bash
# Start the test database
npm run db:test:start

# Wait for it to be ready (about 5-10 seconds)
# You can check logs with:
npm run db:test:logs
```

### 2. Run All Tests

```bash
# Run only the new eventstore feature tests
npm test -- src/lib/eventstore/unique-constraint.test.ts
npm test -- src/lib/eventstore/reducer.test.ts
npm test -- src/lib/eventstore/latest-position.test.ts

# Or run all eventstore tests
npm test -- src/lib/eventstore/

# Or run all integration tests (including new ones)
npm run test:integration
```

### 3. Run Tests Individually

```bash
# Test unique constraints (9 test cases)
npm test -- src/lib/eventstore/unique-constraint.test.ts

# Test reducer pattern (7 test cases)
npm test -- src/lib/eventstore/reducer.test.ts

# Test latest position (9 test cases)
npm test -- src/lib/eventstore/latest-position.test.ts
```

### 4. Watch Mode (for development)

```bash
# Watch all eventstore tests
npm test -- --watch src/lib/eventstore/
```

## What's Being Tested

### Unique Constraints (unique-constraint.test.ts)
- ✅ Adding unique constraints
- ✅ Preventing duplicates (instance-scoped)
- ✅ Global constraints (across instances)
- ✅ Removing constraints
- ✅ Multiple constraints per command
- ✅ Custom error messages
- ✅ Constraint violation errors

### Reducer Pattern (reducer.test.ts)
- ✅ Event streaming to reducers
- ✅ Batch processing (100 events per batch)
- ✅ Projection building from events
- ✅ Filtering before reducing
- ✅ Memory efficiency with large event sets
- ✅ Stateful reducer processing
- ✅ Empty result handling

### Latest Position (latest-position.test.ts)
- ✅ Zero position for empty events
- ✅ Latest position queries
- ✅ Filtering by instanceID
- ✅ Filtering by aggregateType
- ✅ Filtering by aggregateID
- ✅ Filtering by eventType
- ✅ Filtering by owner
- ✅ Filtering by creator
- ✅ Catch-up subscription pattern

## Expected Results

All **27 tests** should pass:
```
PASS  src/lib/eventstore/unique-constraint.test.ts (9 tests)
PASS  src/lib/eventstore/reducer.test.ts (7 tests)
PASS  src/lib/eventstore/latest-position.test.ts (9 tests)

Test Suites: 3 passed, 3 total
Tests:       27 passed, 27 total
```

## Troubleshooting

### Test Database Not Running
```bash
# Error: Cannot connect to test database
# Solution: Start the test database
npm run db:test:start
```

### Migration Errors
```bash
# Error: Table unique_constraints does not exist
# Solution: Migrations should run automatically, but if needed:
npm run db:test:stop
npm run db:test:start
# Wait 10 seconds for migrations to complete
```

### Port Already in Use
```bash
# Error: Port 5433 already in use
# Solution: Stop the test database and restart
npm run db:test:stop
npm run db:test:start
```

### Cleanup After Tests
```bash
# Stop the test database when done
npm run db:test:stop
```

## Coverage

To see test coverage for the new features:

```bash
npm run test:coverage -- src/lib/eventstore/
```

## CI/CD Integration

The tests are already integrated with your Jest setup and will run as part of:
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:all           # All tests
```

## Next Steps After Tests Pass

Once all tests are passing, you can:

1. ✅ Start using unique constraints in your commands
2. ✅ Build projections using the reducer pattern
3. ✅ Implement catch-up subscriptions with latest position
4. ✅ Move to Phase 2 features (Event Subscriptions, Advanced Query Builder)

See `EVENTSTORE_FEATURE_PARITY.md` for the full roadmap.
