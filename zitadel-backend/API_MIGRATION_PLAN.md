# Zitadel API Module Migration Plan
# Go → TypeScript Backend

**Created:** October 30, 2025  
**Status:** Analysis Complete - Ready for Implementation  
**Goal:** Complete migration of zitadel/internal/api to zitadel-backend

---

## 📊 EXECUTIVE SUMMARY

### Current State Analysis

**Zitadel Go API Module (`zitadel/internal/api`):**
- **13 major modules** (grpc, http, oidc, saml, scim, ui, authz, etc.)
- **500+ files** across all API modules
- **Core dependencies:** command, query, eventstore, crypto, i18n

**TypeScript Backend Current API (`zitadel-backend/src/api`):**
- **Minimal implementation** (server.ts, index.ts)
- **Partial gRPC** (org module only)
- **Missing:** Most API modules

**Backend Foundation Status:**
- ✅ Command module: 148 commands (98% parity)
- ✅ Query module: 37 projections (100% complete)
- ✅ Eventstore: Complete implementation
- ✅ Auth/Authz: Basic implementation exists
- ✅ Crypto: Implemented
- ✅ Database: Migrations complete
- ❌ OIDC: Not implemented
- ❌ SAML: Not implemented
- ❌ SCIM: Not implemented
- ❌ UI: Not implemented
- ❌ gRPC Services: Minimal (org only)

---

## 🗂️ API MODULE BREAKDOWN

### Module 1: **authz/** (Authorization Middleware)
**Priority:** P0 - Critical Infrastructure  
**Complexity:** Medium  
**Status:** ✅ 80% Complete in TypeScript

#### Files in Go:
- `authorization.go` - Permission checking, role-based access
- `context.go` - Request context with user/org/instance
- `instance.go` - Instance-level authorization
- `permissions.go` - Permission definitions
- `access_token.go` - Access token validation
- `api_token_verifier.go` - Token verification interface

#### Dependencies:
✅ **Already in TypeScript:**
- Command module (for state checks)
- Query module (for permission lookups)
- Eventstore (for audit)
- Database (for sessions)

✅ **Existing in `src/lib/authz/`:**
- `permissions.ts` - Permission definitions (5.3KB)
- `permission-checker.ts` - Permission validation
- `role-manager.ts` - Role management
- `middleware.ts` - Express middleware
- `context-builder.ts` - Context construction

**Migration Status:** ✅ **80% Complete**

**Remaining Work:**
- [ ] Add instance-level authorization
- [ ] Add system API token support
- [ ] Enhance context with full user/org metadata
- [ ] Add permission caching layer
- [ ] Integration tests

**Estimated Effort:** 1 week

---

### Module 2: **grpc/** (gRPC Services)
**Priority:** P0 - Critical  
**Complexity:** Very High  
**Status:** ❌ 5% Complete (org module only)

#### Submodules (37 total):
1. `action/` (21 files) - Action management API
2. `admin/` (64 files) - Admin API
3. `app/` (16 files) - Application management
4. `auth/` (23 files) - Authentication API
5. `authorization/` (6 files) - Authorization checks
6. `feature/` (10 files) - Feature flags
7. `idp/` (5 files) - Identity provider management
8. `instance/` (10 files) - Instance management
9. `management/` (44 files) - Organization management
10. `oidc/` (10 files) - OIDC endpoints
11. `org/` (12 files) - Organization API
12. `policy/` (9 files) - Policy management
13. `project/` (12 files) - Project management
14. `resources/` (19 files) - Resource management
15. `saml/` (4 files) - SAML endpoints
16. `server/` (44 files) - gRPC server setup
17. `session/` (13 files) - Session management
18. `settings/` (18 files) - Settings management
19. `system/` (19 files) - System API
20. `user/` (78 files) - User management
21. `webkey/` (10 files) - Web key management
22. ... and 16 more

#### Dependencies:
✅ **All dependencies exist:**
- ✅ Command module (148 commands ready)
- ✅ Query module (37 projections ready)
- ✅ Domain models
- ✅ Eventstore
- ✅ Crypto

**Current Status:**
- ✅ `src/api/grpc/org/` - Partial org API
- ❌ All other 36 gRPC modules missing

**Migration Strategy:**

**Phase 1: Core Services (4 weeks)**
1. **Week 1:** Set up gRPC infrastructure
   - Configure @grpc/grpc-js server
   - Create proto file generation pipeline
   - Set up middleware (auth, logging, error handling)
   - Implement health checks

2. **Week 2:** User API (`user/` - 78 files)
   - User CRUD operations
   - Profile management
   - Metadata operations
   - Auth factor management

3. **Week 3:** Organization API (`org/` + `management/`)
   - Enhance existing org API
   - Add management endpoints
   - Member management
   - Domain management

4. **Week 4:** Project & App API
   - Project CRUD
   - Application management
   - Grant management
   - Role management

**Phase 2: Instance & Admin (2 weeks)**
5. **Week 5:** Instance API
   - Instance management
   - Domain configuration
   - Feature management

6. **Week 6:** Admin API
   - System-level operations
   - Instance creation
   - Global settings

**Phase 3: Authentication & Authorization (2 weeks)**
7. **Week 7:** Auth API
   - Authentication endpoints
   - Session management
   - Token operations

8. **Week 8:** Authorization API
   - Permission checks
   - Role assignments
   - Access control

**Phase 4: Advanced Services (4 weeks)**
9. **Week 9-10:** IDP & Policy APIs
10. **Week 11-12:** Action, Settings, Resources APIs

**Estimated Total Effort:** 12 weeks for complete gRPC migration

---

### Module 3: **oidc/** (OpenID Connect)
**Priority:** P0 - Critical for Auth  
**Complexity:** Very High  
**Status:** ❌ 0% Complete

#### Files in Go (42 files):
- Authorization endpoint
- Token endpoint
- UserInfo endpoint
- Introspection endpoint
- Revocation endpoint
- Discovery endpoint (.well-known/openid-configuration)
- JWKS endpoint
- Dynamic client registration
- Device authorization flow
- PKCE support
- Refresh token handling

#### Dependencies:
✅ **Ready:**
- Command module (session, auth commands)
- Query module (user, app queries)
- Crypto (JWT signing)
- Database (token storage)

❌ **Missing:**
- JWT issuer/validator
- OIDC session management
- Token storage layer
- Client credential storage

**Migration Strategy:**

**Phase 1: Core OIDC (4 weeks)**
1. **Week 1:** Infrastructure
   - JWT issuer/validator using jose library
   - Token storage layer
   - OIDC session management

2. **Week 2:** Authorization Code Flow
   - Authorization endpoint
   - Consent screen data
   - Code generation/validation

3. **Week 3:** Token Endpoints
   - Token endpoint (all grant types)
   - Refresh token handling
   - Introspection endpoint
   - Revocation endpoint

4. **Week 4:** Discovery & JWKS
   - .well-known/openid-configuration
   - JWKS endpoint
   - UserInfo endpoint

**Phase 2: Advanced OIDC (2 weeks)**
5. **Week 5:** Device Flow & DPoP
6. **Week 6:** Dynamic Client Registration

**Estimated Effort:** 6 weeks

---

### Module 4: **saml/** (SAML 2.0)
**Priority:** P2 - Enterprise Feature  
**Complexity:** Very High  
**Status:** ❌ 0% Complete

#### Files in Go (7 files):
- SAML provider implementation
- SSO endpoints
- Metadata endpoint
- Certificate management
- Assertion generation

#### Dependencies:
✅ **Ready:**
- Command module
- Query module
- Crypto (certificate handling)

❌ **Missing:**
- SAML library (use saml2-js or passport-saml)
- XML signing
- Metadata generation

**Migration Strategy:**
- Use `saml2-js` or `@node-saml/node-saml` library
- Implement IdP initiated & SP initiated flows
- Certificate management via crypto module

**Estimated Effort:** 4 weeks

---

### Module 5: **scim/** (SCIM 2.0 API)
**Priority:** P2 - Enterprise Feature  
**Complexity:** High  
**Status:** ❌ 0% Complete

#### Files in Go (77 files):
- User provisioning (SCIM /Users)
- Group provisioning (SCIM /Groups)
- Resource types
- Schemas endpoint
- ServiceProviderConfig endpoint
- Bulk operations
- Filtering, sorting, pagination

#### Dependencies:
✅ **Ready:**
- Command module (user, org commands)
- Query module (user, org queries)

❌ **Missing:**
- SCIM 2.0 request/response handling
- Filter parser
- Patch operation handler

**Migration Strategy:**
- Build SCIM 2.0 compliant endpoints
- Map SCIM operations to command/query modules
- Implement filtering using query filters

**Estimated Effort:** 3 weeks

---

### Module 6: **ui/** (UI Login/Hosted Pages)
**Priority:** P1 - User Experience  
**Complexity:** Very High  
**Status:** ❌ 0% Complete

#### Files in Go (275 files):
- Login UI
- Registration UI
- Password reset UI
- MFA enrollment UI
- Consent screens
- Error pages
- Email templates
- i18n translations

#### Dependencies:
✅ **Ready:**
- Command module
- Query module
- Static file serving

❌ **Missing:**
- Frontend framework setup (React/Vue/Svelte)
- Template engine
- i18n system
- CSS/asset bundling

**Migration Strategy:**

**Option A: Server-Side Rendering**
- Use Express + EJS/Handlebars
- Server-rendered forms
- Progressive enhancement

**Option B: Modern SPA**
- React/Vue frontend
- API-driven
- Better UX but more complex

**Recommended:** Option A for faster migration

**Estimated Effort:** 6 weeks

---

### Module 7: **http/** (HTTP Middleware)
**Priority:** P0 - Infrastructure  
**Complexity:** Medium  
**Status:** ✅ 60% Complete

#### Files in Go (31 files):
- CORS middleware
- Security headers
- Request logging
- Error handling
- Rate limiting
- Request ID tracking
- Instance context middleware
- Authentication middleware

#### Dependencies:
✅ **All ready** (Express.js ecosystem)

**Existing in TypeScript:**
- Basic routing in `src/api/router.ts`
- Some middleware

**Remaining Work:**
- [ ] Complete middleware suite
- [ ] Rate limiting
- [ ] Advanced CORS
- [ ] Security headers (helmet.js)
- [ ] Request logging (morgan/winston)

**Estimated Effort:** 1 week

---

### Module 8: **idp/** (Identity Provider Integrations)
**Priority:** P1 - Auth Feature  
**Complexity:** Medium  
**Status:** ✅ 80% Complete (Commands exist)

#### Files in Go (3 files):
- IDP callback handler
- External IDP integration
- OAuth/OIDC provider flow

#### Dependencies:
✅ **Ready:**
- IDP commands (already implemented)
- IDP queries (already implemented)
- OAuth client (use passport.js or openid-client)

**Remaining Work:**
- [ ] Callback endpoint handler
- [ ] State validation
- [ ] Token exchange
- [ ] User linking logic

**Estimated Effort:** 2 weeks

---

### Module 9: **assets/** (Static Assets)
**Priority:** P2 - Nice to have  
**Complexity:** Low  
**Status:** ❌ 0% Complete

#### Files in Go (5 files):
- Static file serving
- Asset caching
- Content-type handling

**Migration Strategy:**
- Use `express.static()` middleware
- Configure proper caching headers
- Serve from `public/` or `static/` folder

**Estimated Effort:** 1 day

---

### Module 10: **call/** (gRPC Call Context)
**Priority:** P0 - Infrastructure  
**Complexity:** Low  
**Status:** ✅ Can use existing patterns

#### Files in Go (2 files):
- Request context extraction
- Metadata handling

**Migration Strategy:**
- Use gRPC metadata API
- Extract auth tokens from metadata
- Build context object similar to authz

**Estimated Effort:** 3 days

---

### Module 11: **info/** (System Info)
**Priority:** P3 - Monitoring  
**Complexity:** Low  
**Status:** ❌ 0% Complete

#### Files in Go (2 files):
- Version endpoint
- Health endpoint

**Migration Strategy:**
- Simple REST endpoints
- Return version from package.json
- Health check using database ping

**Estimated Effort:** 1 day

---

### Module 12: **robots_txt/** (Robots.txt)
**Priority:** P3 - SEO  
**Complexity:** Trivial  
**Status:** ❌ 0% Complete

**Migration Strategy:**
- Single route returning static robots.txt
- Configure crawling rules

**Estimated Effort:** 1 hour

---

### Module 13: **service/** (Service Layer)
**Priority:** P2 - Architecture  
**Complexity:** Medium  
**Status:** ✅ Covered by command/query pattern

**Migration Strategy:**
- Not needed - command/query modules serve this purpose
- Business logic in command handlers
- Read logic in query handlers

**Estimated Effort:** N/A (already architected differently)

---

## 📋 MIGRATION PRIORITY MATRIX

### Phase 1: Foundation (6 weeks)
**Goal:** Basic API functionality

| Module | Priority | Effort | Dependencies | Status |
|--------|----------|--------|--------------|--------|
| authz (complete) | P0 | 1 week | None | 80% |
| http middleware | P0 | 1 week | None | 60% |
| grpc infrastructure | P0 | 1 week | None | 5% |
| User gRPC API | P0 | 1 week | grpc infra | 0% |
| Org gRPC API | P0 | 1 week | grpc infra | 5% |
| Project/App gRPC API | P0 | 1 week | grpc infra | 0% |

**Deliverables:**
- ✅ Complete authorization system
- ✅ HTTP middleware suite
- ✅ gRPC server running
- ✅ Core CRUD APIs (User, Org, Project)

---

### Phase 2: Authentication (8 weeks)
**Goal:** Full auth stack

| Module | Priority | Effort | Dependencies | Status |
|--------|----------|--------|--------------|--------|
| OIDC core | P0 | 4 weeks | authz, grpc | 0% |
| Auth gRPC API | P0 | 2 weeks | OIDC | 0% |
| IDP integration | P1 | 2 weeks | OIDC | 80% cmd |

**Deliverables:**
- ✅ OAuth 2.0 / OIDC provider
- ✅ Login/logout flows
- ✅ Token management
- ✅ External IDP support

---

### Phase 3: Admin & Instance (4 weeks)
**Goal:** Multi-tenant management

| Module | Priority | Effort | Dependencies | Status |
|--------|----------|--------|--------------|--------|
| Instance gRPC API | P0 | 1 week | grpc | 0% |
| Admin gRPC API | P0 | 1 week | grpc | 0% |
| System gRPC API | P1 | 1 week | grpc | 0% |
| Settings/Policy APIs | P1 | 1 week | grpc | 0% |

**Deliverables:**
- ✅ Instance management
- ✅ Admin operations
- ✅ System configuration

---

### Phase 4: Advanced Services (8 weeks)
**Goal:** Enterprise features

| Module | Priority | Effort | Dependencies | Status |
|--------|----------|--------|--------------|--------|
| UI/Login pages | P1 | 6 weeks | OIDC, auth | 0% |
| SAML | P2 | 4 weeks | crypto | 0% |
| SCIM | P2 | 3 weeks | grpc | 0% |
| Advanced gRPC APIs | P1 | 4 weeks | grpc | 0% |

**Deliverables:**
- ✅ Hosted login UI
- ✅ SAML provider
- ✅ SCIM provisioning
- ✅ Complete API coverage

---

## 🎯 RECOMMENDED MIGRATION SEQUENCE

### **Sprint 1-2: Foundation (2 weeks)**
1. ✅ Complete authz module
2. ✅ Set up gRPC infrastructure
3. ✅ HTTP middleware suite
4. ✅ Health/info endpoints

### **Sprint 3-6: Core APIs (4 weeks)**
5. ✅ User gRPC API (all endpoints)
6. ✅ Organization gRPC API (enhance existing)
7. ✅ Project gRPC API
8. ✅ Application gRPC API

### **Sprint 7-10: Authentication (4 weeks)**
9. ✅ OIDC infrastructure
10. ✅ Authorization endpoint
11. ✅ Token endpoint
12. ✅ Discovery/JWKS

### **Sprint 11-12: Instance & Admin (2 weeks)**
13. ✅ Instance API
14. ✅ Admin API

### **Sprint 13-16: Auth Flow (4 weeks)**
15. ✅ Auth gRPC API
16. ✅ Session management
17. ✅ IDP callbacks
18. ✅ Advanced OIDC flows

### **Sprint 17-22: UI & Enterprise (6 weeks)**
19. ✅ Login UI
20. ✅ Registration UI
21. ✅ MFA UI
22. ✅ SAML (optional)

### **Sprint 23-24: SCIM & Final (2 weeks)**
23. ✅ SCIM API
24. ✅ Remaining gRPC APIs
25. ✅ Documentation
26. ✅ Migration complete

**Total Timeline:** 24 weeks (6 months)

---

## 🔧 TECHNICAL ARCHITECTURE

### Proposed TypeScript Architecture

```
src/
├── api/
│   ├── grpc/
│   │   ├── server/          # gRPC server setup
│   │   ├── middleware/      # Auth, logging, errors
│   │   ├── user/           # User service
│   │   ├── org/            # Organization service
│   │   ├── project/        # Project service
│   │   ├── app/            # Application service
│   │   ├── auth/           # Auth service
│   │   ├── admin/          # Admin service
│   │   ├── management/     # Management service
│   │   ├── system/         # System service
│   │   └── ... (30+ more)
│   ├── oidc/
│   │   ├── authorization.ts
│   │   ├── token.ts
│   │   ├── userinfo.ts
│   │   ├── discovery.ts
│   │   ├── jwks.ts
│   │   └── introspection.ts
│   ├── saml/
│   │   ├── provider.ts
│   │   ├── metadata.ts
│   │   └── sso.ts
│   ├── scim/
│   │   ├── users.ts
│   │   ├── groups.ts
│   │   └── schemas.ts
│   ├── http/
│   │   └── middleware/
│   │       ├── cors.ts
│   │       ├── auth.ts
│   │       ├── logging.ts
│   │       ├── errors.ts
│   │       └── rate-limit.ts
│   ├── ui/
│   │   ├── login/
│   │   ├── register/
│   │   ├── mfa/
│   │   └── templates/
│   └── server.ts           # Main API server
├── lib/
│   ├── command/            # ✅ Ready (148 commands)
│   ├── query/              # ✅ Ready (37 projections)
│   ├── authz/              # ✅ 80% ready
│   ├── crypto/             # ✅ Ready
│   ├── eventstore/         # ✅ Ready
│   └── ... (all modules ready)
```

---

## 🚀 GETTING STARTED

### Immediate Next Steps

1. **Week 1: Complete Authorization**
   ```bash
   # Tasks:
   - Enhance src/lib/authz/context-builder.ts
   - Add instance-level authz
   - Add system token support
   - Write integration tests
   ```

2. **Week 2: gRPC Infrastructure**
   ```bash
   # Install dependencies:
   npm install @grpc/grpc-js @grpc/proto-loader
   npm install -D @types/node
   
   # Create structure:
   mkdir -p src/api/grpc/{server,middleware}
   
   # Generate proto files (option 1: buf.build or option 2: manual)
   ```

3. **Week 3: First gRPC Service**
   ```bash
   # Implement User API using existing commands:
   - addUser → userCommands.addUser()
   - getUser → userQueries.getUserByID()
   - listUsers → userQueries.searchUsers()
   ```

---

## 📊 DEPENDENCY CHECKLIST

### ✅ Ready (No blockers)
- [x] Command module (148 commands)
- [x] Query module (37 projections)
- [x] Eventstore
- [x] Database & migrations
- [x] Domain models
- [x] Crypto module
- [x] Error handling (zerrors)
- [x] ID generation
- [x] Notification system
- [x] Basic authz

### ⚠️ Partial (Needs enhancement)
- [ ] Authz (needs instance-level, system tokens)
- [ ] HTTP middleware (needs rate limiting, advanced CORS)
- [ ] gRPC setup (needs server infrastructure)

### ❌ Missing (Must implement)
- [ ] OIDC provider
- [ ] SAML provider
- [ ] SCIM API
- [ ] UI/Login pages
- [ ] gRPC services (35+ modules)
- [ ] JWT issuer/validator for OIDC
- [ ] Token storage layer
- [ ] i18n system for UI

---

## 📈 SUCCESS METRICS

### Phase 1 Complete (Week 6)
- ✅ gRPC server running
- ✅ 4 core APIs (User, Org, Project, App)
- ✅ 100+ gRPC endpoints
- ✅ Authorization working

### Phase 2 Complete (Week 14)
- ✅ OIDC provider functional
- ✅ OAuth 2.0 flows working
- ✅ Token issuance/validation
- ✅ Auth API complete

### Phase 3 Complete (Week 18)
- ✅ Instance management
- ✅ Admin operations
- ✅ Multi-tenant fully supported

### Phase 4 Complete (Week 24)
- ✅ Login UI functional
- ✅ SAML working (optional)
- ✅ SCIM working
- ✅ **100% API parity achieved**

---

## 🎯 CONCLUSION

**Total Estimated Effort:** 24 weeks (6 months)  
**Team Size:** 2-3 developers  
**Complexity:** Very High  
**Risk:** Medium (backend foundation is solid)

**Key Success Factors:**
1. ✅ Backend foundation is complete (command/query/eventstore)
2. ✅ Clear migration path module-by-module
3. ✅ Can deliver incrementally (phase by phase)
4. ✅ Each phase adds functional value
5. ✅ No circular dependencies

**Recommended Approach:**
- Start with Phase 1 (Foundation) immediately
- Validate architecture with first gRPC service
- Iterate rapidly with continuous testing
- Deploy incrementally (API-by-API)

**Next Action:** Begin Sprint 1 - Complete authz & gRPC infrastructure setup.

---

**Document Status:** ✅ Complete  
**Ready for:** Implementation kickoff
