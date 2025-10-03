# Zitadel Backend Architecture Analysis

## Overview
Zitadel is an identity and access management (IAM) platform built using **Event Sourcing** and **CQRS** (Command Query Responsibility Segregation) patterns. This document provides a comprehensive analysis of its modular architecture to guide the incremental TypeScript backend implementation.

## Core Architecture Patterns

### 1. Event Sourcing
- All state changes are stored as immutable events in the eventstore
- Current state is derived by replaying events
- Provides complete audit trail and temporal queries

### 2. CQRS (Command Query Responsibility Segregation)
- **Commands**: Write operations that generate events (handled by `command` module)
- **Queries**: Read operations from optimized projections (handled by `query` module)
- Separate models for reads and writes

### 3. Multi-Tenancy
- Instance-based isolation
- Organization-level separation
- Resource isolation per tenant

## Module Structure & Dependencies

### Layer 1: Foundation (Zero Dependencies)

#### 1.1 `zerrors` - Error Handling
**Purpose**: Standardized error types and error handling
**Key Features**:
- Custom error types with error codes
- Error wrapping and context
- i18n error messages

**No external dependencies** - Build this FIRST

#### 1.2 `domain` - Domain Models
**Purpose**: Core business domain types, enums, and value objects
**Key Entities**:
- User types (Human, Machine)
- Organization
- Project
- Application
- Authentication types (OIDC, SAML, OAuth)
- Session types
- Policy types

**Dependencies**: `zerrors`

#### 1.3 `crypto` - Cryptography
**Purpose**: Encryption, hashing, and cryptographic operations
**Key Features**:
- Symmetric encryption (AES)
- Password hashing (bcrypt, argon2)
- Key management
- Secret generation
- Code generation (OTP, verification codes)

**Dependencies**: `zerrors`

#### 1.4 `id` - ID Generation
**Purpose**: Unique identifier generation
**Key Features**:
- Snowflake-based IDs (using sonyflake)
- UUID generation
- Custom ID formats

**Dependencies**: None

#### 1.5 `database` - Database Abstraction
**Purpose**: Database connection and query execution abstraction
**Key Features**:
- PostgreSQL adapter
- Connection pooling
- Transaction management
- Type-safe query builders

**Dependencies**: `zerrors`

### Layer 2: Core Infrastructure

#### 2.1 `eventstore` - Event Store
**Purpose**: Event sourcing infrastructure - the heart of Zitadel
**Key Features**:
- Event persistence
- Event streaming
- Aggregate management
- Event filtering and querying
- Optimistic concurrency control

**Key Concepts**:
- **Aggregate**: Entity with unique identity (User, Org, Project, etc.)
- **Event**: Immutable fact that happened (UserAdded, PasswordChanged, etc.)
- **Command**: Intent to change state
- **Stream**: Ordered sequence of events for an aggregate

**Dependencies**: `database`, `domain`, `zerrors`

#### 2.2 `cache` - Caching Layer
**Purpose**: Performance optimization through caching
**Connectors**:
- Redis
- In-memory
- Multi-level caching

**Dependencies**: `zerrors`

#### 2.3 `static` - Static File Storage
**Purpose**: Asset storage (logos, images, files)
**Storage Backends**:
- Local filesystem
- S3-compatible storage
- Google Cloud Storage

**Dependencies**: `zerrors`

### Layer 3: Business Logic Layer (CQRS)

#### 3.1 `command` - Command Side (Write Operations)
**Purpose**: Process commands and generate events
**Key Responsibilities**:
- Validate business rules
- Generate events
- Push events to eventstore
- Handle aggregates

**Key Command Types**:
- User commands (add, update, delete, password change)
- Organization commands
- Project commands
- Application commands
- Policy commands
- Session commands

**Dependencies**: `eventstore`, `crypto`, `domain`, `id`, `cache`

#### 3.2 `query` - Query Side (Read Operations)
**Purpose**: Read optimized projections from database
**Key Responsibilities**:
- Query projections (materialized views)
- Filter and search
- Pagination
- Permission checks

**Key Projections**:
- Users
- Organizations
- Projects
- Applications
- Sessions
- Audit logs

**Dependencies**: `database`, `eventstore`, `domain`, `cache`, `crypto`

### Layer 4: Service & API Layer

#### 4.1 `authz` - Authorization
**Purpose**: Permission checks and access control
**Key Features**:
- Role-based access control (RBAC)
- Permission validation
- Token verification
- API authorization

**Dependencies**: `query`, `domain`, `zerrors`

#### 4.2 `api` - API Layer
**Purpose**: HTTP/gRPC API endpoints
**Key Features**:
- REST API (via gRPC gateway)
- gRPC services
- ConnectRPC support
- Health checks
- Metrics

**API Versions**:
- V1 API: Context-based (admin, auth, mgmt, system)
- V2 API: Resource-oriented (user, session, organization, etc.)

**Dependencies**: `authz`, `command`, `query`, `domain`

#### 4.3 `auth` - Authentication
**Purpose**: User authentication and session management
**Key Features**:
- Password authentication
- MFA (TOTP, U2F, WebAuthn)
- Social login (OAuth providers)
- LDAP integration
- Session management

**Dependencies**: `command`, `query`, `crypto`, `domain`

#### 4.4 `notification` - Notification System
**Purpose**: Send notifications to users
**Channels**:
- Email (SMTP)
- SMS (Twilio, etc.)
- Webhooks

**Dependencies**: `query`, `domain`, `crypto`

#### 4.5 `actions` - Custom Actions
**Purpose**: Execute custom JavaScript actions on events
**Key Features**:
- Webhook execution
- Token customization
- Event-driven automation
- JavaScript runtime (Goja)

**Dependencies**: `domain`, `crypto`, `query`

### Layer 5: Feature Modules

#### 5.1 `user` - User Management
**Purpose**: User-specific operations
**Dependencies**: `domain`, `command`, `query`

#### 5.2 `org` - Organization Management
**Purpose**: Organization operations
**Dependencies**: `domain`, `command`, `query`

#### 5.3 `project` - Project Management
**Purpose**: Project and application operations
**Dependencies**: `domain`, `command`, `query`

#### 5.4 `admin` - System Administration
**Purpose**: System-level admin operations
**Dependencies**: `command`, `query`, `authz`

#### 5.5 `iam` - IAM Core
**Purpose**: IAM-specific operations
**Dependencies**: `domain`, `command`, `query`

### Supporting Modules

#### `i18n` - Internationalization
**Dependencies**: `zerrors`

#### `config` - Configuration Management
**Dependencies**: None

#### `telemetry` - Observability
- Metrics (Prometheus)
- Tracing (OpenTelemetry)
- Logging

**Dependencies**: `zerrors`

#### `migration` - Database Migrations
**Dependencies**: `database`

#### `webauthn` - WebAuthn Support
**Dependencies**: `crypto`, `domain`

#### `idp` - Identity Provider Integration
**Dependencies**: `crypto`, `domain`

## Dependency Graph (Build Order)

```
Layer 1 (Foundation - Build First):
1. zerrors
2. id
3. crypto (depends on: zerrors)
4. domain (depends on: zerrors)
5. database (depends on: zerrors)

Layer 2 (Core Infrastructure):
6. cache (depends on: zerrors)
7. static (depends on: zerrors)
8. eventstore (depends on: database, domain, zerrors)

Layer 3 (Business Logic):
9. query (depends on: database, eventstore, domain, cache, crypto)
10. command (depends on: eventstore, crypto, domain, id, cache)

Layer 4 (Services):
11. authz (depends on: query, domain, zerrors)
12. i18n (depends on: zerrors)
13. notification (depends on: query, domain, crypto)
14. actions (depends on: domain, crypto, query)
15. auth (depends on: command, query, crypto, domain)
16. api (depends on: authz, command, query, domain)

Layer 5 (Feature Modules):
17. user (depends on: domain, command, query)
18. org (depends on: domain, command, query)
19. project (depends on: domain, command, query)
20. admin (depends on: command, query, authz)
21. iam (depends on: domain, command, query)
```

## Key Technologies Used

### Go Packages (to be replaced in TypeScript)
- **Database**: `jackc/pgx` (PostgreSQL driver)
- **Event Store**: Custom implementation
- **Encryption**: Standard Go crypto
- **gRPC**: `google.golang.org/grpc`
- **HTTP**: `gorilla/mux`
- **Validation**: Custom validators
- **ID Generation**: `sony/sonyflake`
- **Caching**: `go-redis/redis`
- **Job Queue**: `riverqueue/river`

### TypeScript Equivalents
- **Database**: `pg` or `postgres` driver
- **gRPC**: `@grpc/grpc-js` or `@connectrpc/connect`
- **HTTP**: `express` or `fastify`
- **Validation**: `zod` or `joi`
- **ID Generation**: `@lukeed/uuid` or custom snowflake
- **Caching**: `ioredis`
- **Job Queue**: `bullmq` or similar
- **Event Store**: Custom implementation using PostgreSQL

## Event Store Schema (PostgreSQL)

### Core Tables
1. **events2**: Main event log
   - id (bigint)
   - command_id (uuid)
   - aggregate_type (text)
   - aggregate_id (text)
   - aggregate_version (bigint)
   - event_type (text)
   - event_data (jsonb)
   - editor_user (text)
   - editor_service (text)
   - resource_owner (text)
   - instance_id (text)
   - created_at (timestamp)
   - position (decimal) - for ordering

2. **projections**: Current state projections
   - Various tables per aggregate type

## Authentication & Authorization Flow

1. **Authentication**:
   - User provides credentials
   - `auth` module validates
   - Session created via `command`
   - Token issued (JWT/opaque)

2. **Authorization**:
   - Request intercepted by `authz`
   - Token validated
   - Permissions checked
   - Context populated

3. **Command Execution**:
   - Command validated
   - Business rules checked
   - Events generated
   - Pushed to eventstore
   - Projections updated

4. **Query Execution**:
   - Query parsed
   - Permissions checked
   - Projection queried
   - Results returned

## Non-Functional Requirements

### Performance
- Event store optimized for append-only writes
- Projections for fast reads
- Caching for frequently accessed data
- Connection pooling

### Scalability
- Horizontal scaling via stateless API servers
- Event store sharding by instance
- Read replicas for queries
- Cache distribution

### Security
- Encryption at rest (database)
- Encryption in transit (TLS)
- Secret management
- Token security
- Audit logging

### Reliability
- Event sourcing for data consistency
- Optimistic concurrency
- Retry mechanisms
- Health checks

## Implementation Strategy for TypeScript

### Phase 1: Foundation (Weeks 1-2)
Build Layer 1 modules: zerrors, id, crypto, domain, database

### Phase 2: Core Infrastructure (Weeks 3-4)
Build Layer 2: eventstore, cache, static

### Phase 3: Business Logic (Weeks 5-7)
Build Layer 3: command, query

### Phase 4: Services (Weeks 8-10)
Build Layer 4: authz, auth, notification, actions, api

### Phase 5: Features (Weeks 11-14)
Build Layer 5: user, org, project, admin, iam

### Phase 6: Integration & Testing (Weeks 15-16)
- End-to-end testing
- Integration with frontend
- Performance testing
- Security audit

## Key Design Decisions for TypeScript Port

1. **TypeScript-First**: Strict typing, interfaces, and type safety
2. **Async/Await**: Modern async patterns (no callbacks)
3. **Dependency Injection**: Constructor injection for testability
4. **Testing**: Jest/Vitest for unit tests, integration tests
5. **API**: Express/Fastify + gRPC + ConnectRPC
6. **Validation**: Zod for schema validation
7. **ORM**: Raw SQL with type safety (Kysely) or Prisma
8. **Event Store**: Custom implementation optimized for PostgreSQL
9. **Configuration**: Environment variables + config files
10. **Logging**: Winston or Pino structured logging

## Next Steps

1. ✅ Architecture analysis complete
2. 🔄 Set up TypeScript project structure
3. 📦 Implement Layer 1 modules
4. 📦 Implement Layer 2 modules
5. 📦 Continue with subsequent layers
6. 🧪 Testing and validation
7. 📚 Documentation
