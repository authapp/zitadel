# Zitadel Internal API Architecture Guide

**Document Version:** 1.0  
**Last Updated:** October 30, 2025  
**Location:** `/internal/api`

---

## Table of Contents

1. [Overview](#overview)
2. [Module Architecture](#module-architecture)
3. [Core API Module](#core-api-module-apigo)
4. [Module Breakdown](#module-breakdown)
   - [authz - Authorization & Authentication](#1-authz---authorization--authentication)
   - [grpc - gRPC Services](#2-grpc---grpc-services)
   - [http - HTTP Utilities](#3-http---http-utilities)
   - [oidc - OpenID Connect](#4-oidc---openid-connect-provider)
   - [saml - SAML 2.0](#5-saml---saml-20-provider)
   - [assets - Static Assets](#6-assets---static-asset-management)
   - [ui - User Interface](#7-ui---user-interface-applications)
   - [scim - SCIM 2.0](#8-scim---system-for-cross-domain-identity-management)
   - [idp - Identity Provider](#9-idp---identity-provider-integration)
   - [call - Call Tracking](#10-call---call-tracking--metrics)
   - [service - Service Layer](#11-service---service-layer)
   - [info - System Info](#12-info---system-information)
   - [robots_txt - Robots.txt](#13-robots_txt---robotstxt-handler)
5. [Integration Patterns](#integration-patterns)
6. [Data Flow](#data-flow)
7. [Dependency Graph](#dependency-graph)

---

## Overview

The `/internal/api` directory contains all API-related modules for Zitadel, including:
- **gRPC services** (v1 and v2 APIs)
- **REST/HTTP endpoints**
- **OAuth 2.0/OIDC provider**
- **SAML 2.0 provider**
- **SCIM 2.0 API**
- **Web UI applications** (login, console)
- **Authorization/authentication middleware**

### Key Design Principles

1. **Protocol Separation**: Each protocol (gRPC, REST, OIDC, SAML) has its own module
2. **Unified Authorization**: All protocols use the `authz` module
3. **Multi-Protocol Support**: Same business logic exposed via multiple protocols
4. **Gateway Pattern**: gRPC-Gateway translates REST to gRPC
5. **Multi-Tenant**: Instance-aware routing and authorization

---

## Module Architecture

```
internal/api/
├── api.go              # Core API orchestrator
├── authz/              # Authorization & authentication
├── grpc/               # gRPC services (v1 & v2)
├── http/               # HTTP utilities & middleware
├── oidc/               # OpenID Connect provider
├── saml/               # SAML 2.0 provider
├── scim/               # SCIM 2.0 API
├── assets/             # Static asset management
├── ui/                 # Web UIs (login, console)
├── idp/                # IDP integration
├── call/               # Call tracking
├── service/            # Service layer
├── info/               # System info
└── robots_txt/         # Robots.txt handler
```

---

## Core API Module (api.go)

### Purpose
Central orchestrator that initializes and coordinates all API modules.

### Responsibilities

1. **Server Setup**
   - Initialize gRPC server
   - Configure gRPC-Gateway for REST
   - Set up HTTP router (Gorilla Mux)
   - Register health checks

2. **Service Registration**
   - Register v1 services (system, admin, mgmt, auth)
   - Register v2 services (user, session, settings, etc.)
   - Register Connect RPC services
   - Enable gRPC reflection

3. **Routing**
   - HTTP/2 routing for gRPC
   - gRPC-Web support
   - REST API gateway routing
   - Static handler routing

### Key Structures

```go
type API struct {
    port              uint16
    externalDomain    string
    grpcServer        *grpc.Server
    verifier          authz.APITokenVerifier
    health            healthCheck
    router            *mux.Router
    hostHeaders       []string
    grpcGateway       *server.Gateway
    healthServer      *health.Server
    accessInterceptor *http_mw.AccessInterceptor
    queries           *query.Queries
    authConfig        authz.Config
    systemAuthZ       authz.Config
    connectServices   map[string][]string
    
    targetEncryptionAlgorithm crypto.EncryptionAlgorithm
    translator                *i18n.Translator
}
```

### Key Methods

- `New()` - Create API instance
- `RegisterServer()` - Register v1 gRPC service with gateway
- `RegisterService()` - Register v2 gRPC/Connect service
- `RegisterHandlerOnPrefix()` - Register HTTP handler
- `RouteGRPC()` - Configure gRPC routing

### Dependencies

- **Internal**:
  - `internal/query` - Read operations
  - `internal/command` - Write operations
  - `internal/crypto` - Encryption
  - `internal/i18n` - Internationalization
- **External**:
  - `gorilla/mux` - HTTP routing
  - `google.golang.org/grpc` - gRPC server

---

## Module Breakdown

### 1. authz - Authorization & Authentication

**Location:** `internal/api/authz/`

#### Purpose
Centralized authorization and authentication for all API endpoints.

#### Responsibilities

1. **Token Verification**
   - Access token validation
   - System token validation
   - Session token verification
   - API token verification

2. **Permission Checking**
   - Role-based access control (RBAC)
   - Context-specific permissions (org, project)
   - System-level permissions
   - Global vs. scoped permissions

3. **Context Management**
   - Extract user/org/project from tokens
   - Store auth context in request context
   - Multi-tenant isolation

4. **Authorization Flow**
   ```
   Request → Extract Token → Verify Token → Check Permissions → Inject Context
   ```

#### Key Components

**Context Data (CtxData)**
```go
type CtxData struct {
    UserID                string
    OrgID                 string
    ProjectID             string
    AgentID               string
    PreferredLanguage     string
    ResourceOwner         string
    SystemMemberships     Memberships
    SystemUserPermissions []SystemUserPermissions
}
```

**Verifiers**
- `TokenVerifier` - General token verification
- `AccessTokenVerifier` - OAuth/OIDC access tokens
- `SystemTokenVerifier` - System/admin tokens
- `APITokenVerifier` - API-specific tokens

**Authorization Methods**
- `CheckUserAuthorization()` - Verify user can access endpoint
- `VerifyTokenAndCreateCtxData()` - Token validation + context creation
- `GetCtxData()` - Extract context from request

#### Integration Points

**Used By:**
- All gRPC services (via interceptors)
- REST API handlers
- OIDC endpoints
- SAML endpoints
- SCIM endpoints

**Dependencies:**
- `internal/query` - Look up users, orgs, permissions
- `internal/telemetry` - Tracing
- Token storage/cache

---

### 2. grpc - gRPC Services

**Location:** `internal/api/grpc/`

#### Purpose
Complete gRPC API implementation for Zitadel.

#### Structure

```
grpc/
├── server/           # Server setup & middleware
├── admin/            # Admin API (v1)
├── management/       # Management API (v1)
├── auth/             # Auth API (v1)
├── system/           # System API (v1)
├── user/             # User API (v2)
├── session/          # Session API (v2)
├── settings/         # Settings API (v2)
├── org/              # Organization helpers
├── project/          # Project helpers
├── app/              # Application helpers
├── member/           # Member helpers
├── policy/           # Policy helpers
├── idp/              # IDP helpers
├── feature/          # Feature helpers
└── [other domains]
```

#### API Versions

**v1 APIs** (Legacy with gateway)
- `/admin` - Instance administration
- `/management` - Organization/project management
- `/auth` - User authentication operations
- `/system` - System-level operations

**v2 APIs** (Modern with Connect RPC)
- `/resources/v2/user` - User management
- `/resources/v2/session` - Session management
- `/resources/v2/settings` - Settings management
- `/resources/v2/[domain]` - Domain-specific APIs

#### Key Patterns

**Service Implementation**
```go
type Server struct {
    command *command.Commands
    query   *query.Queries
    // ... other dependencies
}

func (s *Server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.GetUserResponse, error) {
    // 1. Authorization handled by interceptor
    // 2. Extract context data
    // 3. Call query/command
    // 4. Convert to protobuf
    // 5. Return response
}
```

**Converters**
- Proto → Domain
- Domain → Proto
- Query result → Response
- Request → Command

#### Dependencies

- `internal/command` - Write operations
- `internal/query` - Read operations
- `internal/authz` - Authorization
- `internal/domain` - Domain models
- `pkg/grpc` - Generated proto code

---

### 3. http - HTTP Utilities

**Location:** `internal/api/http/`

#### Purpose
Common HTTP utilities, middleware, and helpers.

#### Components

**Middleware** (`middleware/`)
- `AccessInterceptor` - Activity logging
- `AuthorizationInterceptor` - Auth checks
- `CORSInterceptor` - CORS handling
- `InstanceInterceptor` - Multi-tenant routing
- `RateLimitInterceptor` - Rate limiting
- `NoCacheInterceptor` - Cache control
- `ErrorHandler` - Error formatting

**Utilities**
- `cookie.go` - Cookie management
- `domain_check.go` - Domain validation
- `error.go` - HTTP error handling
- `header.go` - Header constants
- `marshal.go` - JSON marshaling
- `origin.go` - Origin validation
- `parser.go` - Request parsing

#### Key Features

**Domain Verification**
```go
func CheckDomain(r *http.Request, allowedDomains []string) error
```

**Error Handling**
```go
func MarshalJSON(w http.ResponseWriter, data interface{}, err error, status int)
```

**Header Constants**
```go
const (
    Authorization = "Authorization"
    ContentType   = "Content-Type"
    Origin        = "Origin"
    ZitadelOrgID  = "x-zitadel-orgid"
    // ... more
)
```

#### Dependencies

- Standard library (`net/http`)
- `internal/zerrors` - Error types

---

### 4. oidc - OpenID Connect Provider

**Location:** `internal/api/oidc/`

#### Purpose
Full OpenID Connect provider implementation.

#### Responsibilities

1. **OAuth 2.0 Flows**
   - Authorization Code Flow
   - Implicit Flow
   - Client Credentials Flow
   - Device Authorization Flow
   - Token Exchange
   - Refresh Token Flow

2. **OIDC Features**
   - ID Token generation
   - UserInfo endpoint
   - Discovery endpoint
   - JWKS endpoint
   - Session management

3. **Token Management**
   - Access token generation/validation
   - ID token signing
   - Refresh token rotation
   - Token introspection
   - Token revocation

4. **Security**
   - PKCE support
   - State validation
   - Nonce handling
   - Client authentication
   - JWT signature verification

#### Key Components

**Server** (`server.go`)
```go
type Server struct {
    http.Handler
    *op.LegacyServer
    
    repo              repository.Repository
    query             *query.Queries
    command           *command.Commands
    accessTokenKeySet *oidcKeySet
    idTokenHintKeySet *oidcKeySet
    // ... configuration
}
```

**Endpoints**
- `/oauth/v2/authorize` - Authorization endpoint
- `/oauth/v2/token` - Token endpoint
- `/oauth/v2/introspect` - Introspection endpoint
- `/oidc/v1/userinfo` - UserInfo endpoint
- `/oauth/v2/revoke` - Revocation endpoint
- `/oidc/v1/end_session` - End session endpoint
- `/oauth/v2/keys` - JWKS endpoint
- `/oauth/v2/device_authorization` - Device auth

**Key Files**
- `server.go` - Main server setup
- `auth_request.go` - Authorization flow
- `token*.go` - Token handling
- `userinfo.go` - UserInfo endpoint
- `client.go` - Client management
- `key.go` - Key management

#### Dependencies

- `github.com/zitadel/oidc/v3` - OIDC library
- `internal/command` - Write operations
- `internal/query` - Read operations
- `internal/authz` - Authorization
- `internal/crypto` - Token signing

---

### 5. saml - SAML 2.0 Provider

**Location:** `internal/api/saml/`

#### Purpose
SAML 2.0 Service Provider implementation.

#### Responsibilities

1. **SAML Flows**
   - SP-initiated SSO
   - IdP-initiated SSO
   - Single Logout

2. **SAML Features**
   - Assertion generation
   - Metadata generation
   - Certificate management
   - Response signing

#### Key Components

- `provider.go` - SAML provider setup
- `auth_request.go` - Authentication request handling
- `auth_request_converter*.go` - Request conversion
- `certificate.go` - Certificate management
- `serviceprovider.go` - SP configuration
- `storage.go` - SAML session storage

#### Dependencies

- SAML library (crewjam/saml or similar)
- `internal/command` - Commands
- `internal/query` - Queries
- `internal/crypto` - Signing

---

### 6. assets - Static Asset Management

**Location:** `internal/api/assets/`

#### Purpose
Manage static assets like logos, icons, fonts, avatars.

#### Responsibilities

1. **Asset Types**
   - Label policy assets (logos, icons, fonts)
   - User avatars
   - Organization branding
   - Light/dark mode variants

2. **Operations**
   - Upload assets
   - Download assets
   - Preview assets
   - Delete assets

3. **Scoping**
   - Instance-level assets
   - Organization-level assets
   - User-level assets

#### Key Components

**Router** (`router.go` - auto-generated)
Routes for asset operations:
- `/instance/policy/label/{font,icon,logo}`
- `/org/policy/label/{font,icon,logo}`
- `/users/me/avatar`

**Asset Handler** (`asset.go`)
```go
type Uploader interface {
    Upload(ctx context.Context, orgID string, reader io.Reader, contentType string) error
}

type Downloader interface {
    Download(ctx context.Context, orgID string) (io.ReadCloser, string, error)
}
```

**Authorization** (`authz.go`)
- Checks permissions for asset operations
- Validates org ownership

**Login Policy** (`login_policy.go`)
- Retrieve branding assets for login page
- Support light/dark mode

#### Integration

**Used By:**
- Login UI (for branding)
- Console UI (for org customization)
- Management API (for asset uploads)

**Dependencies:**
- `internal/static` - File storage
- `internal/command` - Update commands
- `internal/query` - Asset queries

---

### 7. ui - User Interface Applications

**Location:** `internal/api/ui/`

#### Purpose
Host web-based user interfaces.

#### Structure

```
ui/
├── login/    # Login/registration UI (272 items)
└── console/  # Admin console UI
```

#### Login UI

**Features:**
- User login
- Registration
- Password reset
- MFA enrollment
- External IDP login
- Consent screens
- Error pages

**Key Files:**
- OAuth/OIDC flow handlers
- Form rendering
- Session management
- Branding integration

#### Console UI

**Features:**
- Organization management
- User management
- Project/application configuration
- Policy administration
- Audit logs

#### Dependencies

- Template rendering
- `internal/command` - Operations
- `internal/query` - Data retrieval
- Asset service - Branding

---

### 8. scim - System for Cross-Domain Identity Management

**Location:** `internal/api/scim/`

#### Purpose
SCIM 2.0 API for user/group provisioning.

#### Responsibilities

1. **Resource Management**
   - User CRUD operations
   - Group CRUD operations
   - Bulk operations
   - Filtering/search

2. **SCIM Compliance**
   - RFC 7643 (Core Schema)
   - RFC 7644 (Protocol)
   - Schema discovery
   - Service provider config

#### Structure

```
scim/
├── resources/      # User, Group resources
├── schemas/        # SCIM schemas
├── middleware/     # SCIM-specific middleware
├── metadata/       # Metadata handlers
├── serrors/        # SCIM error handling
├── config/         # Configuration
├── server.go       # SCIM server
└── service_provider.go
```

#### Key Components

**Server** (`server.go`)
- SCIM endpoint routing
- Authentication
- Error handling

**Resources** (`resources/`)
- User resource handlers
- Group resource handlers
- Schema endpoints
- Service provider config

**Middleware** (`middleware/`)
- SCIM auth
- Content-Type validation
- Rate limiting

#### Dependencies

- `internal/command` - Provisioning
- `internal/query` - Resource queries
- `internal/authz` - Authorization

---

### 9. idp - Identity Provider Integration

**Location:** `internal/api/idp/`

#### Purpose
External identity provider integration (Google, Azure AD, etc.).

#### Responsibilities

1. **IDP Flows**
   - OAuth authorization
   - OIDC authentication
   - SAML assertions
   - Token exchange

2. **IDP Management**
   - IDP configuration
   - Mapping rules
   - Session linking
   - User provisioning

#### Key Components

- `idp.go` - IDP integration logic
- `idp_test.go` - Tests
- `integration_test/` - Integration tests

#### Dependencies

- OAuth/OIDC libraries
- `internal/command` - Link users
- `internal/query` - IDP configs

---

### 10. call - Call Tracking & Metrics

**Location:** `internal/api/call/`

#### Purpose
Track API call duration and metrics.

#### Responsibilities

- Measure request duration
- Record API metrics
- Performance monitoring

#### Key Components

- `duration.go` - Duration tracking
- `duration_test.go` - Tests

---

### 11. service - Service Layer

**Location:** `internal/api/service/`

#### Purpose
Shared service-level logic.

#### Responsibilities

- Common service utilities
- Shared business logic
- Cross-cutting concerns

---

### 12. info - System Information

**Location:** `internal/api/info/`

#### Purpose
Provide system information endpoints.

#### Responsibilities

- Version information
- Build metadata
- System capabilities

---

### 13. robots_txt - Robots.txt Handler

**Location:** `internal/api/robots_txt/`

#### Purpose
Serve robots.txt for search engines.

#### Responsibilities

- Serve robots.txt content
- Configure crawling rules

---

## Integration Patterns

### 1. Request Flow

```
HTTP/gRPC Request
    ↓
Router/Server
    ↓
Middleware Chain
    ├─ Instance Interceptor (multi-tenant)
    ├─ Authorization Interceptor (authz)
    ├─ Rate Limit Interceptor
    └─ Error Handler
    ↓
Service Handler (grpc/oidc/saml/scim)
    ↓
Authorization Check (authz.CheckUserAuthorization)
    ↓
Business Logic (command/query)
    ↓
Response
```

### 2. Authorization Pattern

```
Token (Bearer) → authz.VerifyToken
    ↓
Extract UserID, OrgID, ProjectID
    ↓
Load Permissions (query.Memberships)
    ↓
Check Permission (authz.CheckUserPermissions)
    ↓
Inject Context (SetCtxData)
    ↓
Handler Execution
```

### 3. Multi-Tenant Pattern

```
Request → Extract Instance (from domain/header)
    ↓
InstanceInterceptor
    ↓
Set Instance Context
    ↓
All queries/commands scoped to instance
```

### 4. gRPC Gateway Pattern

```
REST Request → gRPC Gateway
    ↓
Convert REST → gRPC
    ↓
gRPC Handler
    ↓
Convert gRPC Response → REST
```

---

## Data Flow

### Write Operations

```
API Endpoint
    ↓
Validation (authz)
    ↓
Command (internal/command)
    ↓
Write Model
    ↓
Event Generation
    ↓
Event Store
    ↓
Event Projection (async)
    ↓
Read Model Update (internal/query)
```

### Read Operations

```
API Endpoint
    ↓
Authorization (authz)
    ↓
Query (internal/query)
    ↓
Database (read model)
    ↓
Response Conversion
    ↓
Return Data
```

---

## Dependency Graph

### High-Level Dependencies

```
API Layer (api.go)
    ├─ authz (authentication/authorization)
    │   └─ query (permission lookup)
    │
    ├─ grpc (gRPC services)
    │   ├─ command (write operations)
    │   ├─ query (read operations)
    │   └─ authz (authorization)
    │
    ├─ oidc (OAuth/OIDC provider)
    │   ├─ command (token operations)
    │   ├─ query (client lookup)
    │   ├─ authz (authorization)
    │   └─ crypto (signing)
    │
    ├─ saml (SAML provider)
    │   ├─ command (assertion operations)
    │   ├─ query (SP configuration)
    │   └─ crypto (signing)
    │
    ├─ scim (SCIM API)
    │   ├─ command (provisioning)
    │   ├─ query (resource queries)
    │   └─ authz (authorization)
    │
    ├─ assets (static assets)
    │   ├─ command (asset updates)
    │   ├─ query (asset metadata)
    │   ├─ static (file storage)
    │   └─ authz (authorization)
    │
    └─ ui (web UIs)
        ├─ command (user operations)
        ├─ query (data retrieval)
        └─ assets (branding)
```

### Core Dependencies (All Modules)

**Required by All:**
- `context` - Context propagation
- `internal/telemetry` - Tracing/logging
- `internal/zerrors` - Error handling
- `internal/i18n` - Internationalization

**Required by Most:**
- `internal/command` - Write operations
- `internal/query` - Read operations
- `internal/authz` - Authorization
- `internal/domain` - Domain models

---

## Key Takeaways

### For TypeScript Backend Implementation

1. **Authorization First**
   - Implement `authz` module first
   - All APIs depend on it
   - Context extraction is critical

2. **Service Separation**
   - Keep protocols separate (gRPC, REST, OIDC, SAML)
   - Share business logic via commands/queries
   - Use converters between layers

3. **Multi-Tenant Support**
   - Instance awareness in every request
   - Scope all queries/commands to instance
   - Domain-based routing

4. **Gateway Pattern**
   - Consider gRPC-Gateway for REST
   - Or implement REST directly
   - Maintain consistency

5. **Middleware Chain**
   - Instance interceptor
   - Authorization interceptor
   - Rate limiting
   - Error handling
   - Metrics/tracing

### Implementation Priority

For your TypeScript backend:

1. **Phase 1**: Core infrastructure
   - `authz` - Authorization/authentication
   - `http` - HTTP utilities
   - Middleware chain

2. **Phase 2**: Primary APIs
   - `grpc` - gRPC services (start with v2)
   - Connect RPC support
   - REST gateway (if needed)

3. **Phase 3**: Additional Protocols
   - `oidc` - OAuth/OIDC provider
   - `saml` - SAML provider (if required)
   - `scim` - SCIM API (if required)

4. **Phase 4**: Supporting Services
   - `assets` - Asset management
   - `ui` - Web UIs (if needed)
   - `idp` - External IDP integration

---

## Conclusion

The Zitadel `internal/api` architecture is highly modular, with clear separation of concerns:

- **Protocol-agnostic business logic** (command/query)
- **Protocol-specific implementations** (grpc, oidc, saml, scim)
- **Shared infrastructure** (authz, http, middleware)
- **Multi-tenant by design** (instance awareness)
- **Security first** (authorization at every layer)

This architecture allows Zitadel to support multiple protocols (gRPC, REST, OAuth/OIDC, SAML, SCIM) while maintaining a single source of truth for business logic and consistent security/authorization across all APIs.
