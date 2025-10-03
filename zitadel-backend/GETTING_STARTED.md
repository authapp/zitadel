# Getting Started with Zitadel Backend TypeScript

This guide will help you understand the project structure and start developing incrementally.

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [What's Been Built](#whats-been-built)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [Development Workflow](#development-workflow)
6. [Next Steps](#next-steps)
7. [Testing](#testing)

---

## 🎯 Project Overview

This is an **incremental TypeScript implementation** of the Zitadel backend, following the original Go architecture. The goal is to rebuild all functional and non-functional features in TypeScript, module by module, layer by layer.

### Why Incremental?

Building incrementally allows us to:
- ✅ **Test as we go** - Each module is validated before moving to the next
- ✅ **Minimize dependencies** - Start with foundation, build up systematically
- ✅ **Understand deeply** - Learn the architecture by implementing it
- ✅ **Stay organized** - Clear progress tracking and documentation

---

## ✅ What's Been Built (Phase 1 Complete)

### Layer 1: Foundation Modules

All Layer 1 modules are **complete** and ready to use:

#### 1. **`zerrors`** - Error Handling
Located: `src/lib/zerrors/`

```typescript
import { throwInternal, throwNotFound, ZitadelError } from '@/zerrors';

// Throw a standardized error
throwNotFound('User not found', 'USER-001', { userId: '123' });

// Catch and handle
try {
  // ... code
} catch (error) {
  if (error instanceof ZitadelError) {
    console.log(error.code, error.httpStatus, error.details);
  }
}
```

**Features:**
- Standardized error codes
- HTTP status mapping
- Error context and details
- Parent error tracking
- JSON serialization

#### 2. **`id`** - ID Generation
Located: `src/lib/id/`

```typescript
import { generateId, parseId, generateUUID } from '@/id';

// Generate Snowflake ID (chronologically sortable)
const id = generateId();
// => "1234567890123456789"

// Parse ID to extract timestamp, machine ID, sequence
const parsed = parseId(id);
// => { timestamp: Date, machineId: 123, sequence: 0 }

// Generate UUID
const uuid = generateUUID();
// => "550e8400-e29b-41d4-a716-446655440000"
```

**Features:**
- Snowflake IDs (Twitter's algorithm)
- UUID v4 generation
- Command IDs for event sourcing
- Configurable machine ID and epoch

#### 3. **`crypto`** - Cryptography
Located: `src/lib/crypto/`

```typescript
import { 
  AESEncryption, 
  PasswordHasher, 
  generateSecret,
  generateNumericCode 
} from '@/crypto';

// Encrypt sensitive data
const aes = new AESEncryption({ key: 'base64key', keyId: 'v1' });
const encrypted = await aes.encrypt(Buffer.from('secret'));

// Hash passwords
const hasher = new PasswordHasher({ cost: 12 });
const hash = await hasher.hash('password123');
const valid = await hasher.verify('password123', hash);

// Generate tokens and codes
const secret = generateSecret(32); // API secret
const otpCode = generateNumericCode(6); // "123456"
```

**Features:**
- AES-GCM encryption/decryption
- Bcrypt password hashing
- Secret hashing (SHA-256)
- Token generation
- OTP code generation
- HMAC signing/verification

#### 4. **`domain`** - Domain Models
Located: `src/lib/domain/`

```typescript
import { 
  User, 
  UserState, 
  Organization, 
  Project,
  Session,
  ZitadelPermissions 
} from '@/domain';

// Type-safe domain models
const user: HumanUser = {
  id: '123',
  type: UserType.HUMAN,
  state: UserState.ACTIVE,
  userName: 'john@example.com',
  resourceOwner: 'org-123',
  profile: {
    firstName: 'John',
    lastName: 'Doe',
  },
  email: {
    email: 'john@example.com',
    isVerified: true,
  },
  // ... more fields
};

// Check permissions
if (ZitadelPermissions.USER_WRITE) {
  // Has write permission
}
```

**Features:**
- User types (Human, Machine)
- Organization models
- Project and Application models (OIDC, SAML, API)
- Session and Token models
- Permission and Role definitions
- State enums and helper functions

#### 5. **`database`** - Database Abstraction
Located: `src/lib/database/`

```typescript
import { DatabasePool } from '@/database';

// Create connection pool
const db = new DatabasePool({
  host: 'localhost',
  port: 5432,
  database: 'zitadel',
  user: 'postgres',
  password: 'postgres',
});

// Execute queries
const users = await db.queryMany('SELECT * FROM users WHERE id = $1', ['123']);

// Transactions
await db.withTransaction(async (tx) => {
  await tx.query('INSERT INTO users ...');
  await tx.query('INSERT INTO profiles ...');
});

// Health check
const healthy = await db.health();
```

**Features:**
- PostgreSQL connection pooling
- Type-safe query execution
- Transaction support
- Health checks
- Environment-based config

---

## 🏗️ Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────┐
│         Layer 5: Feature Modules            │
│  (user, org, project, admin services)       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Layer 4: Service Layer              │
│  (authz, auth, api, notification, actions)  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      Layer 3: Business Logic (CQRS)         │
│         (command, query)                    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      Layer 2: Core Infrastructure           │
│     (eventstore, cache, static)             │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ ✅ Layer 1: Foundation (COMPLETE)           │
│  (zerrors, id, crypto, domain, database)    │
└─────────────────────────────────────────────┘
```

### Key Patterns

1. **Event Sourcing**: All state changes stored as immutable events
2. **CQRS**: Separate read (query) and write (command) models
3. **Domain-Driven Design**: Clear domain boundaries
4. **Multi-Tenancy**: Instance and organization-level isolation

---

## 🚀 Installation

```bash
# Navigate to the project
cd zitadel-backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your settings
nano .env
```

### Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** 14+ (for eventstore and projections)
- **Redis** 6+ (optional, for caching)

---

## 💻 Development Workflow

### Start Development Server

```bash
npm run dev
```

This will start the server with hot reload using `tsx`.

### Build for Production

```bash
npm run build
npm start
```

### Run Tests

```bash
# Run all tests
npm test

# Watch mode
npm test:watch

# Coverage report
npm test:coverage
```

### Code Quality

```bash
# Lint
npm run lint

# Format
npm run format

# Type check
npm run type-check
```

### Project Structure

```
src/
├── lib/                    # Core library modules
│   ├── zerrors/           # ✅ Error handling
│   ├── id/                # ✅ ID generation
│   ├── crypto/            # ✅ Cryptography
│   ├── domain/            # ✅ Domain models
│   ├── database/          # ✅ Database abstraction
│   ├── eventstore/        # 📋 Event sourcing (next)
│   ├── cache/             # 📋 Caching
│   ├── static/            # 📋 File storage
│   ├── command/           # 📋 Write operations
│   ├── query/             # 📋 Read operations
│   ├── authz/             # 📋 Authorization
│   ├── auth/              # 📋 Authentication
│   └── api/               # 📋 API layer
├── services/              # Feature modules (future)
└── index.ts               # Entry point
```

---

## 📍 Next Steps

### Immediate Next Steps (Layer 2)

#### 1. **Implement Eventstore Module** (Highest Priority)

The eventstore is the **heart of Zitadel**. It's the next critical module to build.

**What to implement:**
- Event interface and types
- Aggregate interface
- Command interface
- Event pusher (write events)
- Event querier (read events)
- Optimistic concurrency control
- PostgreSQL schema for events

**Files to create:**
- `src/lib/eventstore/event.ts`
- `src/lib/eventstore/aggregate.ts`
- `src/lib/eventstore/command.ts`
- `src/lib/eventstore/pusher.ts`
- `src/lib/eventstore/querier.ts`
- `src/lib/eventstore/eventstore.ts`

**Reference:** Study `internal/eventstore/` in the Go codebase

#### 2. **Implement Cache Module**

Caching improves performance significantly.

**What to implement:**
- Cache interface
- Redis connector
- In-memory connector
- TTL support

**Files to create:**
- `src/lib/cache/cache.ts`
- `src/lib/cache/redis.ts`
- `src/lib/cache/memory.ts`

#### 3. **Implement Static Storage**

For storing logos, images, assets.

**What to implement:**
- Storage interface
- Local filesystem storage
- S3-compatible storage (optional initially)

**Files to create:**
- `src/lib/static/storage.ts`
- `src/lib/static/local.ts`

### Medium-Term (Layer 3)

Once Layer 2 is complete:

1. **Query Module** - Read-side of CQRS
2. **Command Module** - Write-side of CQRS

### Long-Term (Layer 4 & 5)

1. API layer with authentication/authorization
2. Feature modules (user, org, project services)
3. End-to-end testing
4. Documentation
5. Deployment

---

## 🧪 Testing

### Test Strategy

Each module should have:
1. **Unit tests** - Test individual functions
2. **Integration tests** - Test module interactions
3. **E2E tests** - Test complete flows (later)

### Writing Tests

Create test files alongside source:

```
src/lib/zerrors/
├── errors.ts
└── errors.test.ts
```

Example test:

```typescript
import { ZitadelError, ErrorCode, throwNotFound } from './errors';

describe('ZitadelError', () => {
  it('should create error with code and message', () => {
    const error = new ZitadelError(
      ErrorCode.NOT_FOUND,
      'Resource not found'
    );
    
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.httpStatus).toBe(404);
    expect(error.message).toContain('Resource not found');
  });

  it('should throw not found error', () => {
    expect(() => {
      throwNotFound('User not found', 'USER-001');
    }).toThrow(ZitadelError);
  });
});
```

---

## 📚 Documentation

- **[Architecture Analysis](../ZITADEL_ARCHITECTURE_ANALYSIS.md)** - Deep dive into Zitadel's architecture
- **[Implementation Status](./IMPLEMENTATION_STATUS.md)** - Track progress of all modules
- **[README](./README.md)** - Project overview

---

## 🤝 Contributing

Since this is an incremental implementation:

1. **Follow the layer order** - Don't skip ahead
2. **Write tests** - Each module needs tests
3. **Document as you go** - Update `IMPLEMENTATION_STATUS.md`
4. **Keep dependencies minimal** - Only depend on lower layers
5. **Type everything** - Strict TypeScript

---

## 💡 Tips

### Understanding Event Sourcing

Event sourcing is the core pattern. Key concepts:

- **Event**: Immutable fact that happened (e.g., `UserCreated`, `PasswordChanged`)
- **Aggregate**: Entity with unique ID (e.g., User, Organization)
- **Command**: Intent to change state (e.g., `CreateUser`, `ChangePassword`)
- **Projection**: Materialized view built from events

Example flow:
```
Command: CreateUser
   ↓
Validate business rules
   ↓
Generate Event: UserCreated
   ↓
Store in Eventstore
   ↓
Update Projection (users table)
```

### TypeScript Path Aliases

Use path aliases for clean imports:

```typescript
// ✅ Good
import { throwInternal } from '@/zerrors';
import { User } from '@/domain';

// ❌ Avoid
import { throwInternal } from '../../../lib/zerrors';
```

### Database Schema

The eventstore uses PostgreSQL. Main tables:

- **events2**: Append-only event log
- **projections**: Current state (users, orgs, projects, etc.)

You'll create these when implementing the eventstore.

---

## 🎯 Success Criteria

A module is "complete" when:

1. ✅ All core functionality implemented
2. ✅ Unit tests written and passing
3. ✅ Integration tests (where applicable)
4. ✅ Documentation updated
5. ✅ No TypeScript errors
6. ✅ Linter passes

---

## 📞 Getting Help

- **Discord**: Zitadel community Discord
- **GitHub**: Original Zitadel repository for reference
- **Documentation**: Zitadel official docs

---

**Happy coding! Let's build Zitadel in TypeScript, incrementally. 🚀**
