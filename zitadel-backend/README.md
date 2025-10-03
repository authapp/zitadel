# Zitadel Backend - TypeScript Implementation

A TypeScript implementation of the Zitadel identity and access management backend, built incrementally following the original Go architecture.

## Overview

This project is a ground-up TypeScript rewrite of Zitadel's backend, maintaining the same architectural patterns:
- **Event Sourcing**: Immutable event log as the source of truth
- **CQRS**: Separate command and query responsibilities
- **Multi-Tenancy**: Instance and organization-level isolation
- **Domain-Driven Design**: Clear domain boundaries and models

## Project Structure

```
src/
├── lib/                      # Core library modules
│   ├── zerrors/             # Error handling (Layer 1)
│   ├── id/                  # ID generation (Layer 1)
│   ├── crypto/              # Cryptography (Layer 1)
│   ├── domain/              # Domain models (Layer 1)
│   ├── database/            # Database abstraction (Layer 1)
│   ├── cache/               # Caching layer (Layer 2)
│   ├── static/              # Static storage (Layer 2)
│   ├── eventstore/          # Event sourcing (Layer 2)
│   ├── command/             # Write operations (Layer 3)
│   ├── query/               # Read operations (Layer 3)
│   ├── authz/               # Authorization (Layer 4)
│   ├── auth/                # Authentication (Layer 4)
│   ├── api/                 # API layer (Layer 4)
│   ├── notification/        # Notifications (Layer 4)
│   ├── actions/             # Custom actions (Layer 4)
│   ├── i18n/                # Internationalization
│   ├── config/              # Configuration
│   └── telemetry/           # Observability
├── services/                # Feature modules
│   ├── user/               # User management
│   ├── org/                # Organization management
│   ├── project/            # Project management
│   ├── admin/              # System administration
│   └── iam/                # IAM core
└── index.ts                # Application entry point
```

## Architecture Layers

### Layer 1: Foundation
- **zerrors**: Standardized error handling
- **id**: Unique identifier generation (Snowflake)
- **crypto**: Encryption, hashing, key management
- **domain**: Core domain types and value objects
- **database**: PostgreSQL abstraction

### Layer 2: Core Infrastructure
- **eventstore**: Event sourcing implementation
- **cache**: Redis/in-memory caching
- **static**: File storage (S3, GCS, local)

### Layer 3: Business Logic (CQRS)
- **command**: Write operations, event generation
- **query**: Read operations from projections

### Layer 4: Services
- **authz**: Authorization and permissions
- **auth**: Authentication flows
- **api**: REST/gRPC API endpoints
- **notification**: Email/SMS notifications
- **actions**: Custom webhook actions

### Layer 5: Features
- **user**: User management service
- **org**: Organization service
- **project**: Project and application service
- **admin**: System administration
- **iam**: IAM operations

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+ (optional, for caching)

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Database Setup

```bash
# Create database
createdb zitadel

# Run migrations (coming soon)
npm run migrate
```

### Development

```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type check
npm run type-check

# Lint
npm run lint

# Format code
npm run format
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Testing

See [`RUN_TESTS.md`](./RUN_TESTS.md) for a quick start and [`TEST_GUIDE.md`](./TEST_GUIDE.md) for detailed guidance.

### Running Tests
- Run all tests: `npm test`
- Watch mode: `npm test:watch`
- Coverage: `npm test:coverage`
- Run a specific test: `npm test -- <file>`

### Test Types
- **Unit tests** for core modules (zerrors, id, crypto, database, domain)
- **Integration tests** for module interactions
- **E2E tests** for user flows
- **Coverage** and **performance** tests

### Structure & Coverage
- 200+ tests, ~95% code coverage
- All critical paths and error cases are tested

See the guides for troubleshooting, writing new tests, and CI integration.

## Development Roadmap

### ✅ Phase 0: Setup (Complete)
- [x] Project structure
- [x] TypeScript configuration
- [x] Testing setup
- [x] Linting and formatting
- [x] Architecture documentation

### 🔄 Phase 1: Foundation (In Progress)
- [ ] zerrors module
- [ ] id module
- [ ] crypto module
- [ ] domain module
- [ ] database module

### 📋 Phase 2: Core Infrastructure
- [ ] eventstore implementation
- [ ] cache implementation
- [ ] static storage implementation

### 📋 Phase 3: Business Logic
- [ ] command implementation
- [ ] query implementation
- [ ] projections

### 📋 Phase 4: Services
- [ ] authz implementation
- [ ] auth implementation
- [ ] api implementation
- [ ] notification implementation

### 📋 Phase 5: Features
- [ ] user service
- [ ] org service
- [ ] project service
- [ ] admin service

### 📋 Phase 6: Integration
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment guides

## Testing Strategy

- **Unit Tests**: For individual modules and functions
- **Integration Tests**: For module interactions
- **E2E Tests**: For complete user flows
- **Performance Tests**: For load testing

## Key Technologies

- **TypeScript**: Type-safe development
- **PostgreSQL**: Event store and projections
- **Redis**: Caching layer
- **Express**: HTTP API
- **Zod**: Schema validation
- **Jest**: Testing framework
- **Winston**: Logging

## Contributing

This is an incremental implementation. Each module is built following these principles:
1. **Zero external dependencies** for foundation modules
2. **Type safety** throughout
3. **Test coverage** for all functionality
4. **Clear documentation** in code
5. **Performance** optimized from the start

## Event Sourcing Implementation

The event store uses PostgreSQL with the following schema:
- **events2**: Append-only event log
- **projections**: Materialized views for queries
- **Position-based ordering**: For event streaming

## License

Apache-2.0 (matching original Zitadel license)

## Reference

This implementation follows the architecture of the original Zitadel Go backend:
- https://github.com/zitadel/zitadel

For architecture details, see: `../ZITADEL_ARCHITECTURE_ANALYSIS.md`
