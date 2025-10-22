# Zitadel API Module - Complete Analysis for Migration

**Date:** October 22, 2025  
**Purpose:** Understand Zitadel Go internal/api module for TypeScript migration

---

## 📋 EXECUTIVE SUMMARY

The **internal/api** module is Zitadel's **HTTP/gRPC API Gateway layer**. It's a **MASSIVE** module that handles all external communication.

**Size:** ~500+ Go files across 13 major submodules  
**Purpose:** API Gateway, HTTP endpoints, gRPC services, OIDC Provider, SAML Provider, UI  
**Complexity:** **VERY HIGH** - This is the most complex module after command/query

---

## 🗂️ MODULE STRUCTURE

```
internal/api/
├── api.go (main API orchestrator)
├── grpc/ (478 files) - gRPC services
├── ui/ (275 files) - Web UI (login, register, etc.)
├── scim/ (77 files) - SCIM 2.0 API
├── oidc/ (42 files) - OAuth2/OIDC Provider
├── http/ (31 items) - HTTP utilities & middleware
├── authz/ (17 items) - Authorization
├── saml/ (7 items) - SAML 2.0 Provider
├── idp/ (3 items) - External IDP integration
├── assets/ (5 items) - Static assets
├── call/ (2 items) - Call context
├── info/ (2 items) - Server info
├── robots_txt/ (2 items) - robots.txt handler
└── service/ (1 item) - Service interface
```

---

## 1️⃣ **DEPENDENCIES** (What it depends on)

### **Core Dependencies:**

#### **1. internal/command** ⭐ CRITICAL
**Purpose:** Write operations (CQRS command side)
```go
import "github.com/zitadel/zitadel/internal/command"
```
**Usage:** 
- All write operations (create, update, delete)
- User registration
- Organization creation
- Application setup
**Migration Status:** ✅ Already migrated in zitadel-backend

---

#### **2. internal/query** ⭐ CRITICAL
**Purpose:** Read operations (CQRS query side)
```go
import "github.com/zitadel/zitadel/internal/query"
```
**Usage:**
- All read operations
- Search, list, get operations
- Projections queries
**Migration Status:** ✅ Partially migrated in zitadel-backend

---

#### **3. internal/crypto** ⭐ CRITICAL
**Purpose:** Encryption/decryption, signing
```go
import "github.com/zitadel/zitadel/internal/crypto"
```
**Usage:**
- Password hashing
- Token encryption
- JWT signing
- SAML certificate management
**Migration Status:** ⚠️ Needs implementation

---

#### **4. internal/i18n** ⭐ HIGH
**Purpose:** Internationalization
```go
import "github.com/zitadel/zitadel/internal/i18n"
```
**Usage:**
- UI translations
- Error messages in different languages
**Migration Status:** ⬜ Not migrated

---

#### **5. internal/telemetry** ⭐ MEDIUM
**Purpose:** Metrics, tracing, logging
```go
import (
  "github.com/zitadel/zitadel/internal/telemetry/metrics"
  "github.com/zitadel/zitadel/internal/telemetry/tracing"
)
```
**Usage:**
- Request tracking
- Performance metrics
- Distributed tracing
**Migration Status:** ⬜ Not migrated

---

#### **6. internal/zerrors** ⭐ HIGH
**Purpose:** Error handling
```go
import "github.com/zitadel/zitadel/internal/zerrors"
```
**Usage:**
- Standardized error types
- Error codes
- HTTP status mapping
**Migration Status:** ⬜ Not migrated

---

#### **7. internal/domain** ⭐ CRITICAL
**Purpose:** Domain models, business logic types
```go
import "github.com/zitadel/zitadel/internal/domain"
```
**Usage:**
- All domain types
- Enums, constants
- Business rules
**Migration Status:** ✅ Partially in types

---

### **External Dependencies:**

#### **gRPC Stack:**
```go
"google.golang.org/grpc"
"connectrpc.com/grpcreflect"
"github.com/improbable-eng/grpc-web/go/grpcweb"
```
**Purpose:** gRPC server, reflection, grpc-web gateway  
**TypeScript Equivalent:** `@grpc/grpc-js`, `@grpc/proto-loader`

#### **HTTP Stack:**
```go
"github.com/gorilla/mux"
"github.com/rs/cors"
```
**Purpose:** HTTP routing, CORS  
**TypeScript Equivalent:** `express`, `@nestjs/core`

#### **OIDC:**
```go
"github.com/zitadel/oidc/v3/pkg/op"
```
**Purpose:** OIDC Provider library  
**TypeScript Equivalent:** `oidc-provider` npm package

#### **SAML:**
```go
"github.com/zitadel/saml/pkg/provider"
```
**Purpose:** SAML 2.0 Provider library  
**TypeScript Equivalent:** `@node-saml/node-saml`

---

## 2️⃣ **SUBMODULE DETAILS** (What each module does)

### **A. internal/api/grpc** 📡 **LARGEST** (478 files)

**Purpose:** All gRPC service implementations

**Structure:**
```
grpc/
├── admin/ - Admin API (system management)
├── auth/ - Auth API (user authentication)
├── management/ - Management API (org/project/app management)
├── system/ - System API (instance management)
├── resources/ - Resources API (v3 unified API)
├── user/ - User management
├── org/ - Organization management
├── project/ - Project management
├── app/ - Application management
├── session/ - Session management
├── oidc/ - OIDC specific gRPC
├── saml/ - SAML specific gRPC
├── idp/ - IDP management
├── policy/ - Policy management
├── settings/ - Settings management
├── feature/ - Feature flags
└── server/ - gRPC server setup
```

**Dependencies:**
- ✅ command - For write operations
- ✅ query - For read operations
- ✅ domain - For types
- ❌ crypto - For encryption

**Inter-dependencies:**
- Each service imports common converters from `grpc/` root
- Shared object/filter/change types

**Migration Complexity:** ⭐⭐⭐⭐⭐ **VERY HIGH**
- 478 files to migrate
- Complex proto definitions
- Type conversions everywhere

---

### **B. internal/api/ui** 🖥️ **SECOND LARGEST** (275 files)

**Purpose:** Web UI for login, registration, password reset, MFA setup

**Structure:**
```
ui/
├── login/ - Login UI (most complex)
│   ├── login_handler.go
│   ├── register_handler.go
│   ├── password_reset_handler.go
│   ├── mfa_*.go (MFA flows)
│   ├── passwordless_*.go (Passwordless)
│   ├── external_*.go (External login)
│   └── ... (100+ files)
├── console/ - Admin console (if exists)
└── templates/ - HTML templates
```

**Dependencies:**
- ✅ command - User registration, password changes
- ✅ query - User lookup, policy queries
- ✅ i18n - Translations
- ✅ domain - User types, policy types

**Migration Complexity:** ⭐⭐⭐⭐⭐ **VERY HIGH**
- 275 files of UI logic
- HTML templating
- Session management
- Complex state machines (MFA, passwordless flows)

---

### **C. internal/api/oidc** 🔐 **CRITICAL** (42 files)

**Purpose:** OAuth2/OpenID Connect Provider

**Key Files:**
```
oidc/
├── op.go - OIDC Provider interface implementation
├── server.go - OIDC server setup
├── auth_request.go - Authorization requests
├── token.go - Token endpoint
├── token_code.go - Authorization code flow
├── token_client_credentials.go - Client credentials flow
├── token_refresh.go - Refresh token flow
├── token_jwt_profile.go - JWT bearer flow
├── token_exchange.go - Token exchange
├── token_device.go - Device code flow
├── userinfo.go - UserInfo endpoint
├── introspect.go - Token introspection
├── key.go - JWK management
├── client.go - Client management
└── ... (integration tests)
```

**Dependencies:**
- ✅ command - Token creation, session management
- ✅ query - Client lookup, user lookup
- ✅ crypto - JWT signing, token encryption
- ✅ domain - OIDC types
- 🔗 `github.com/zitadel/oidc/v3` - OIDC library

**Migration Complexity:** ⭐⭐⭐⭐ **HIGH**
- OAuth2/OIDC flows are complex
- But can use existing `oidc-provider` npm package
- Need to implement storage interface

---

### **D. internal/api/scim** 📊 **MEDIUM** (77 files)

**Purpose:** SCIM 2.0 API for user provisioning

**Structure:**
```
scim/
├── resources/ - SCIM resources (users, groups)
├── schemas/ - SCIM schemas
├── middleware/ - SCIM middleware
└── integration_test/ - Tests
```

**Dependencies:**
- ✅ command - User CRUD
- ✅ query - User queries
- ✅ domain - User types

**Migration Complexity:** ⭐⭐⭐ **MEDIUM**
- Well-defined SCIM 2.0 spec
- Can use `@node-scim/scim` npm package

---

### **E. internal/api/saml** 🔏 **MEDIUM** (7 files)

**Purpose:** SAML 2.0 Identity Provider

**Key Files:**
```
saml/
├── provider.go - SAML provider implementation
├── auth_request.go - SAML AuthnRequest handling
├── storage.go - SAML storage interface
├── certificate.go - Certificate management
└── auth_request_converter.go - Request conversion
```

**Dependencies:**
- ✅ command - Session creation
- ✅ query - Application lookup
- ✅ crypto - XML signing
- 🔗 `github.com/zitadel/saml` - SAML library

**Migration Complexity:** ⭐⭐⭐ **MEDIUM**
- Can use `@node-saml/node-saml` npm package
- SAML is well-defined spec

---

### **F. internal/api/http** 🌐 **UTILITIES** (31 items)

**Purpose:** HTTP utilities and middleware

**Key Components:**
```
http/
├── middleware/ - HTTP middleware
│   ├── auth_interceptor.go - Authentication
│   ├── instance_interceptor.go - Multi-tenant
│   ├── activity_interceptor.go - Activity tracking
│   ├── access_interceptor.go - Access control
│   ├── cache_interceptor.go - Caching
│   ├── security_headers.go - Security headers
│   └── ...
├── cookie.go - Cookie handling
├── domain_check.go - Domain validation
├── origin.go - Origin handling
├── parser.go - Request parsing
├── error.go - Error handling
└── probes.go - Health checks
```

**Dependencies:**
- ✅ query - Instance lookup
- ✅ authz - Authorization
- ✅ domain - Types

**Migration Complexity:** ⭐⭐ **LOW-MEDIUM**
- Standard HTTP middleware patterns
- Easy to implement in Express/NestJS

---

### **G. internal/api/authz** 🔒 **AUTHORIZATION** (17 items)

**Purpose:** Authorization, permission checking

**Key Files:**
```
authz/
├── authorization.go - Authorization interface
├── permissions.go - Permission checking
├── context.go - Auth context
├── token.go - Token verification
└── instance.go - Instance authorization
```

**Dependencies:**
- ✅ query - Permission queries
- ✅ crypto - Token verification
- ✅ domain - Permission types

**Inter-dependencies:**
- Used by ALL other modules

**Migration Complexity:** ⭐⭐⭐ **MEDIUM**
- Core authorization logic
- Permission model implementation

---

### **H. internal/api/idp** 🔗 **EXTERNAL IDP** (3 files)

**Purpose:** External Identity Provider integration (callback handlers)

**Key Files:**
```
idp/
├── idp.go - IDP callback handler
├── idp_test.go - Tests
└── integration_test/ - Integration tests
```

**Dependencies:**
- ✅ command - Link external users
- ✅ query - IDP configuration
- ✅ crypto - State token encryption

**Migration Complexity:** ⭐⭐ **LOW-MEDIUM**
- OAuth callback handling
- State management

---

### **I. internal/api/assets** 📁 **STATIC ASSETS** (5 items)

**Purpose:** Static asset serving (logos, favicons, CSS)

**Migration Complexity:** ⭐ **VERY LOW**
- Just static file serving

---

### **J-M. Small Modules**

**call/** - Call context utilities  
**info/** - Server info endpoint  
**robots_txt/** - robots.txt handler  
**service/** - Service interface

**Migration Complexity:** ⭐ **VERY LOW**

---

## 3️⃣ **PREREQUISITES FOR MIGRATION**

### **✅ Already Have (from Phase 1):**

1. ✅ **Command Module** - Write operations
   - `src/lib/command/` - Fully implemented
   - 56+ commands across 7 categories

2. ✅ **Query Module** - Read operations
   - `src/lib/query/` - Partially implemented
   - User, org, project, app queries exist

3. ✅ **Eventstore** - Event sourcing
   - `src/lib/eventstore/` - Fully implemented
   - PostgreSQL backend

4. ✅ **Database** - PostgreSQL with projections
   - Migrations system
   - Projection system

5. ✅ **Domain Types** - Basic types
   - User, org, project, app types

---

### **❌ Missing/Incomplete (Need to Implement):**

#### **Priority 1: Core Infrastructure** ⭐ CRITICAL

1. **internal/crypto** ⬜ **NOT IMPLEMENTED**
   ```typescript
   // Need to implement:
   - Password hashing (bcrypt/argon2)
   - Token encryption (AES-GCM)
   - JWT signing/verification (RSA, ECDSA)
   - SAML certificate management
   ```
   **Effort:** 2-3 weeks
   **Complexity:** HIGH

2. **internal/zerrors** ⬜ **NOT IMPLEMENTED**
   ```typescript
   // Need to implement:
   - Error types hierarchy
   - HTTP status mapping
   - i18n error messages
   ```
   **Effort:** 1 week
   **Complexity:** LOW-MEDIUM

3. **Authorization System** ⬜ **PARTIAL**
   ```typescript
   // Need to implement:
   - Permission checking
   - Role-based access control
   - Instance-level authorization
   ```
   **Effort:** 2-3 weeks
   **Complexity:** MEDIUM-HIGH

---

#### **Priority 2: API Infrastructure** ⭐ HIGH

4. **HTTP Server & Middleware** ⬜ **NOT IMPLEMENTED**
   ```typescript
   // Need to implement:
   - Express/NestJS setup
   - Authentication middleware
   - Multi-tenant middleware
   - Security headers
   - CORS configuration
   - Activity tracking
   ```
   **Effort:** 2 weeks
   **Complexity:** MEDIUM

5. **gRPC Server** ⬜ **NOT IMPLEMENTED**
   ```typescript
   // Need to implement:
   - gRPC server setup (@grpc/grpc-js)
   - Proto definitions compilation
   - Service implementations
   - grpc-web gateway
   ```
   **Effort:** 4-6 weeks
   **Complexity:** VERY HIGH

---

#### **Priority 3: Protocol Implementations** ⭐ HIGH

6. **OIDC Provider** ⬜ **NOT IMPLEMENTED**
   ```typescript
   // Can use: oidc-provider npm package
   // Need to implement:
   - Storage adapter
   - Client configuration
   - Grant types
   - Token formats
   ```
   **Effort:** 3-4 weeks
   **Complexity:** HIGH

7. **SAML Provider** ⬜ **NOT IMPLEMENTED**
   ```typescript
   // Can use: @node-saml/node-saml
   // Need to implement:
   - AuthnRequest handling
   - Assertion generation
   - Certificate management
   ```
   **Effort:** 2-3 weeks
   **Complexity:** MEDIUM-HIGH

8. **SCIM API** ⬜ **NOT IMPLEMENTED**
   ```typescript
   // Can use: @node-scim/scim
   // Need to implement:
   - Resource endpoints
   - Filtering
   - Patching
   ```
   **Effort:** 2 weeks
   **Complexity:** MEDIUM

---

#### **Priority 4: UI Components** ⭐ MEDIUM

9. **Login UI** ⬜ **NOT IMPLEMENTED**
   ```typescript
   // Need to implement:
   - Login forms
   - Registration flow
   - Password reset
   - MFA setup/verification
   - Passwordless registration
   - External IDP integration
   ```
   **Effort:** 6-8 weeks
   **Complexity:** VERY HIGH

10. **i18n System** ⬜ **NOT IMPLEMENTED**
    ```typescript
    // Can use: i18next
    // Need translation files
    ```
    **Effort:** 1-2 weeks
    **Complexity:** LOW-MEDIUM

---

## 📊 **MIGRATION EFFORT ESTIMATE**

### **By Module:**

| Module | Files | Priority | Complexity | Effort | Status |
|--------|-------|----------|------------|--------|--------|
| **crypto** | ~20 | ⭐⭐⭐⭐⭐ | HIGH | 3 weeks | ⬜ |
| **zerrors** | ~10 | ⭐⭐⭐⭐ | LOW | 1 week | ⬜ |
| **authz** | ~17 | ⭐⭐⭐⭐⭐ | MEDIUM | 3 weeks | ⬜ |
| **http/middleware** | ~20 | ⭐⭐⭐⭐ | MEDIUM | 2 weeks | ⬜ |
| **grpc** | 478 | ⭐⭐⭐⭐⭐ | VERY HIGH | 12 weeks | ⬜ |
| **oidc** | 42 | ⭐⭐⭐⭐⭐ | HIGH | 4 weeks | ⬜ |
| **saml** | 7 | ⭐⭐⭐ | MEDIUM | 3 weeks | ⬜ |
| **scim** | 77 | ⭐⭐⭐ | MEDIUM | 2 weeks | ⬜ |
| **ui/login** | 275 | ⭐⭐⭐ | VERY HIGH | 8 weeks | ⬜ |
| **idp** | 3 | ⭐⭐ | LOW | 1 week | ⬜ |
| **assets** | 5 | ⭐ | LOW | 1 week | ⬜ |
| **i18n** | ~50 | ⭐⭐ | LOW | 2 weeks | ⬜ |

**Total:** ~40 weeks (10 months) for complete migration

---

### **Phased Approach:**

#### **Phase API-1: Foundation** (6 weeks) ⭐ CRITICAL
- ✅ crypto module
- ✅ zerrors module
- ✅ authz module
- ✅ HTTP server + middleware

**After this:** Can build basic authenticated API

---

#### **Phase API-2: Core APIs** (12 weeks) ⭐ HIGH
- ✅ gRPC server setup
- ✅ Admin API
- ✅ Management API
- ✅ Auth API

**After this:** Can manage users/orgs/projects via API

---

#### **Phase API-3: Protocols** (8 weeks) ⭐ HIGH
- ✅ OIDC Provider
- ✅ SAML Provider
- ✅ SCIM API

**After this:** Can use as full IAM provider

---

#### **Phase API-4: UI** (10 weeks) ⭐ MEDIUM
- ✅ Login UI
- ✅ Registration
- ✅ Password reset
- ✅ MFA flows
- ✅ i18n

**After this:** Complete user-facing application

---

#### **Phase API-5: Advanced** (4 weeks) ⭐ LOW
- ✅ System API
- ✅ Resources API (v3)
- ✅ Advanced features

**After this:** Feature-complete Zitadel

---

## 🎯 **RECOMMENDED MIGRATION PATH**

### **Option A: Minimal API (Fastest)** ⏱️ 6 weeks
**Goal:** Basic authenticated REST API

**Implement:**
1. crypto (password hashing, JWT)
2. zerrors (error handling)
3. Basic HTTP server
4. Simple REST endpoints for user/org/project

**Skip:**
- gRPC
- OIDC/SAML
- UI
- SCIM

**Result:** Basic API for internal use

---

### **Option B: OIDC Provider First** ⏱️ 12 weeks  
**Goal:** Use as OAuth2/OIDC provider

**Implement:**
1. Foundation (crypto, errors, authz, HTTP)
2. OIDC Provider
3. Basic login UI

**Skip:**
- Full gRPC API
- SAML
- SCIM

**Result:** Can use for SSO/OAuth

---

### **Option C: Full Migration** ⏱️ 40 weeks
**Goal:** Complete feature parity with Go version

**Implement:** Everything

**Result:** Full Zitadel in TypeScript

---

## 💡 **RECOMMENDATIONS**

### **1. Don't Migrate Everything**
The API module is **MASSIVE**. Focus on what you actually need:
- ✅ HTTP/REST API for web apps
- ✅ OIDC Provider for SSO
- ❌ Skip full gRPC (unless you need it)
- ❌ Skip SCIM (niche use case)
- ❌ Skip SAML initially (can add later)

---

### **2. Use Existing Libraries**
Don't rewrite everything:
- ✅ Use `oidc-provider` npm package
- ✅ Use `@node-saml/node-saml`
- ✅ Use `@grpc/grpc-js`
- ✅ Use `i18next`
- ✅ Use `express` or `@nestjs/core`

---

### **3. Start with Foundation**
Must implement before API:
1. ✅ crypto module (password, JWT, encryption)
2. ✅ zerrors module (error handling)
3. ✅ authz module (permissions)
4. ✅ HTTP middleware (auth, multi-tenant)

**This is Phase API-1 - 6 weeks**

---

### **4. Then Choose Your Path**

**Path 1: REST API** (simpler)
- Build Express REST API
- Use existing command/query
- Skip gRPC, OIDC, UI

**Path 2: OIDC Provider** (more useful)
- Implement OIDC using `oidc-provider`
- Build basic login UI
- Can use as SSO provider

**Path 3: Full gRPC** (most complex)
- Implement all gRPC services
- Feature parity with Go

---

## 🚨 **CRITICAL BLOCKER**

**The API module CANNOT be migrated until:**
- ✅ Complete Phase 2 (all projection tables with multi-tenant)
- ✅ Complete Phase 3 (auth methods, PATs, encryption keys, lockout)
- ✅ Implement crypto module
- ✅ Implement authorization system

**Current Status:** 
- Phase 2: 9% complete (2/23 tables)
- Phase 3: 0% complete (0/4 tables)
- crypto: 0% complete
- authz: 0% complete

**Estimated time to ready:** 3-4 months minimum

---

## 📋 **SUMMARY**

**Question 1: Dependencies?**
- ✅ command (have it)
- ✅ query (have partial)
- ❌ crypto (need it)
- ❌ i18n (need it)
- ❌ zerrors (need it)
- ❌ domain (have partial)
- ❌ authz (need it)

**Question 2: What each module does?**
- grpc/ - gRPC API services (478 files)
- ui/ - Web UI for login/register (275 files)
- oidc/ - OAuth2/OIDC Provider (42 files)
- scim/ - SCIM 2.0 API (77 files)
- saml/ - SAML 2.0 Provider (7 files)
- http/ - HTTP utilities & middleware (31 items)
- authz/ - Authorization (17 items)
- Others - Small utility modules

**Question 3: Prerequisites?**
- ❌ Complete Phase 2 & 3 first
- ❌ Implement crypto module
- ❌ Implement zerrors module
- ❌ Implement authz module
- ❌ Then can start API migration

**Bottom Line:**
API migration is **PREMATURE** right now. Focus on Phase 2 & 3 first. Then implement foundation modules (crypto, authz, errors). THEN consider API migration.

**Recommendation:** Continue with Phase 2 & 3. Revisit API migration in 3-4 months.

---

*Analysis Complete: October 22, 2025*
