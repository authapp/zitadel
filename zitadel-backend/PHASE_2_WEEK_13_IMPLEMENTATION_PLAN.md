# Phase 2 Week 13: Identity Provider Commands
# Implementation Plan

**Start Date:** October 25, 2025  
**Status:** 🚀 READY TO START  
**Priority:** P1 (SSO Integrations)  
**Target Parity:** 81% → 83% (+2%)  
**Estimated Duration:** 1 week

---

## 📋 EXECUTIVE SUMMARY

### Objectives
Implement instance-level Identity Provider (IDP) configuration commands to enable SSO integrations with external identity providers like Google, Azure AD, GitHub, GitLab, etc.

### Scope
- **10 Commands** across 3 categories
- **25+ Integration Tests**
- **IDP Templates** for reusable configurations
- **OIDC Providers** (Google, Azure AD, custom OIDC)
- **OAuth Providers** (GitHub, GitLab, generic OAuth 2.0)

### Dependencies
- ✅ Phase 1 Complete (75% parity)
- ✅ Week 9-10 Complete (Application Configuration)
- ✅ Week 11-12 Complete (Policy Enhancement)
- ✅ Week 15 Partial Complete (Encryption Keys)
- ✅ IDP Projection already exists with handlers
- ✅ IDP Template Projection already exists

---

## 🎯 COMMANDS TO IMPLEMENT

### 1. IDP Template Commands (4 commands)

#### `addIDPTemplate()`
**Purpose:** Create reusable IDP template at instance level  
**Parameters:**
- `name` - Template name
- `type` - IDP type (OIDC, OAuth, SAML, LDAP, Azure AD, Google)
- `config` - Provider-specific configuration
- `autoRegister` - Auto-create users on first login
- `autoUpdate` - Auto-update user profiles
- `autoLinking` - Link to existing users by email

**Go Reference:** `internal/command/idp.go` - `AddIDPConfig()`

**Event:** `instance.idp.added`

**Validation:**
- Name required and non-empty
- Type must be valid IDP type
- Config required based on type

---

#### `changeIDPTemplate()`
**Purpose:** Update IDP template configuration  
**Parameters:**
- `idpID` - IDP template ID
- `name` - Updated name (optional)
- `config` - Updated configuration (optional)
- `autoRegister`, `autoUpdate`, `autoLinking` - Updated flags

**Go Reference:** `internal/command/idp.go` - `ChangeIDPConfig()`

**Event:** `instance.idp.changed`

**Validation:**
- IDP must exist
- At least one field to update
- Config valid for IDP type

---

#### `removeIDPTemplate()`
**Purpose:** Remove IDP template from instance  
**Parameters:**
- `idpID` - IDP template ID to remove

**Go Reference:** `internal/command/idp.go` - `RemoveIDPConfig()`

**Event:** `instance.idp.removed`

**Validation:**
- IDP must exist
- Cannot remove if in use by organizations

---

#### `activateIDPTemplate()` / `deactivateIDPTemplate()`
**Purpose:** Activate or deactivate IDP for use  
**Parameters:**
- `idpID` - IDP template ID

**Go Reference:** `internal/command/idp.go` - `ActivateIDPConfig()`, `DeactivateIDPConfig()`

**Events:** `instance.idp.activated`, `instance.idp.deactivated`

**Validation:**
- IDP must exist
- State transition valid

---

### 2. OIDC Provider Commands (3 commands)

#### `addOIDCProvider()`
**Purpose:** Configure OIDC provider (Google, Azure AD, custom)  
**Parameters:**
- `name` - Provider name
- `clientID` - OAuth client ID
- `clientSecret` - OAuth client secret
- `issuer` - OIDC issuer URL
- `scopes` - Requested scopes (openid, profile, email, etc.)
- `idpDisplayName` - Display name for login button
- `idpMapping` - Field mappings (email, username, name, etc.)

**Go Reference:** `internal/command/idp_oidc_config.go` - `AddOIDCIDP()`

**Event:** `instance.idp.oidc.added`

**Validation:**
- Name, clientID, clientSecret, issuer required
- Scopes must include 'openid'
- Issuer must be valid URL
- Field mappings valid

---

#### `changeOIDCProvider()`
**Purpose:** Update OIDC provider configuration  
**Parameters:**
- `idpID` - IDP ID
- Same fields as add (all optional)

**Go Reference:** `internal/command/idp_oidc_config.go` - `ChangeOIDCIDP()`

**Event:** `instance.idp.oidc.changed`

**Validation:**
- IDP must exist and be OIDC type
- At least one field to update
- Maintain OIDC requirements if updating scopes/issuer

---

#### `removeOIDCProvider()`
**Purpose:** Remove OIDC provider  
**Parameters:**
- `idpID` - IDP ID to remove

**Go Reference:** `internal/command/idp_oidc_config.go` - `RemoveOIDCIDP()`

**Event:** `instance.idp.oidc.removed`

**Validation:**
- IDP must exist and be OIDC type

---

### 3. OAuth Provider Commands (3 commands)

#### `addOAuthProvider()`
**Purpose:** Configure OAuth 2.0 provider (GitHub, GitLab, generic)  
**Parameters:**
- `name` - Provider name
- `clientID` - OAuth client ID
- `clientSecret` - OAuth client secret
- `authorizationEndpoint` - Authorization URL
- `tokenEndpoint` - Token URL
- `userEndpoint` - User info URL
- `scopes` - Requested scopes
- `idpDisplayName` - Display name for login button
- `idpMapping` - Field mappings

**Go Reference:** `internal/command/idp_oauth_config.go` - `AddOAuthIDP()`

**Event:** `instance.idp.oauth.added`

**Validation:**
- Name, clientID, clientSecret required
- All endpoint URLs required and valid
- Scopes required
- Field mappings valid

---

#### `changeOAuthProvider()`
**Purpose:** Update OAuth provider configuration  
**Parameters:**
- `idpID` - IDP ID
- Same fields as add (all optional)

**Go Reference:** `internal/command/idp_oauth_config.go` - `ChangeOAuthIDP()`

**Event:** `instance.idp.oauth.changed`

**Validation:**
- IDP must exist and be OAuth type
- At least one field to update

---

#### `removeOAuthProvider()`
**Purpose:** Remove OAuth provider  
**Parameters:**
- `idpID` - IDP ID to remove

**Go Reference:** `internal/command/idp_oauth_config.go` - `RemoveOAuthIDP()`

**Event:** `instance.idp.oauth.removed`

**Validation:**
- IDP must exist and be OAuth type

---

## 📁 FILES TO CREATE/MODIFY

### Command Files (3 new files)
```
src/lib/command/idp/
├── idp-template-commands.ts         # IDP template CRUD (4 commands)
├── idp-oidc-commands.ts             # OIDC provider config (3 commands)
└── idp-oauth-commands.ts            # OAuth provider config (3 commands)
```

### Write Models (2-3 new files)
```
src/lib/command/idp/
├── idp-template-write-model.ts      # IDP template state
├── idp-oidc-write-model.ts          # OIDC config state (optional, might use template)
└── idp-oauth-write-model.ts         # OAuth config state (optional, might use template)
```

### Test Files (3 new files)
```
test/integration/commands/
├── idp-template.test.ts             # IDP template tests (10+ tests)
├── idp-oidc.test.ts                 # OIDC provider tests (8+ tests)
└── idp-oauth.test.ts                # OAuth provider tests (7+ tests)
```

### Modified Files
```
src/lib/command/commands.ts          # Register new commands (10 methods)
```

---

## 🧪 TEST PLAN

### IDP Template Tests (10+ tests)

**addIDPTemplate (4 tests):**
- ✅ Add OIDC template successfully
- ✅ Add OAuth template successfully
- ❌ Fail with empty name
- ❌ Fail with invalid type

**changeIDPTemplate (2 tests):**
- ✅ Update template configuration
- ❌ Fail on non-existent template

**removeIDPTemplate (2 tests):**
- ✅ Remove template successfully
- ❌ Fail when template in use

**Lifecycle (2 tests):**
- ✅ Complete lifecycle: add → change → activate → deactivate → remove
- ✅ Activate/deactivate state transitions

---

### OIDC Provider Tests (8+ tests)

**addOIDCProvider (4 tests):**
- ✅ Add Google OIDC provider
- ✅ Add Azure AD OIDC provider
- ❌ Fail with missing clientID
- ❌ Fail with invalid issuer URL

**changeOIDCProvider (2 tests):**
- ✅ Update OIDC configuration
- ❌ Fail on non-existent provider

**removeOIDCProvider (1 test):**
- ✅ Remove OIDC provider

**Lifecycle (1 test):**
- ✅ Complete lifecycle: add → change → remove

---

### OAuth Provider Tests (7+ tests)

**addOAuthProvider (3 tests):**
- ✅ Add GitHub OAuth provider
- ✅ Add GitLab OAuth provider
- ❌ Fail with missing endpoints

**changeOAuthProvider (2 tests):**
- ✅ Update OAuth configuration
- ❌ Fail on non-existent provider

**removeOAuthProvider (1 test):**
- ✅ Remove OAuth provider

**Lifecycle (1 test):**
- ✅ Complete lifecycle: add → change → remove

---

## 🏗️ IMPLEMENTATION APPROACH

### Phase 1: IDP Template Commands (Days 1-2)
1. Read Zitadel Go `idp.go`
2. Create `idp-template-commands.ts`
3. Create `idp-template-write-model.ts`
4. Implement 4 commands: add, change, remove, activate/deactivate
5. Write 10+ integration tests
6. Verify projection integration

### Phase 2: OIDC Provider Commands (Days 3-4)
1. Read Zitadel Go `idp_oidc_config.go`
2. Create `idp-oidc-commands.ts`
3. Implement 3 commands: add, change, remove
4. Write 8+ integration tests
5. Test with Google and Azure AD configurations

### Phase 3: OAuth Provider Commands (Days 5-6)
1. Read Zitadel Go `idp_oauth_config.go`
2. Create `idp-oauth-commands.ts`
3. Implement 3 commands: add, change, remove
4. Write 7+ integration tests
5. Test with GitHub and GitLab configurations

### Phase 4: Integration & Testing (Day 7)
1. Register all commands in Commands class
2. Run full test suite
3. Verify projection updates
4. Test query layer integration
5. Update documentation

---

## ✅ SUCCESS CRITERIA

### Functional Requirements
- ✅ All 10 commands implemented matching Go behavior
- ✅ IDP templates support OIDC, OAuth, and other types
- ✅ OIDC providers work with Google, Azure AD, custom
- ✅ OAuth providers work with GitHub, GitLab, generic
- ✅ Auto-registration and auto-linking features work
- ✅ Field mapping configuration functional

### Quality Requirements
- ✅ 25+ integration tests passing (95%+ pass rate)
- ✅ Complete stack tested (Command → Event → Projection → Query)
- ✅ Projections update correctly from events
- ✅ Query layer returns correct data
- ✅ Error handling comprehensive
- ✅ Validation matches Zitadel Go

### Integration Requirements
- ✅ IDP Projection handlers already exist (verified)
- ✅ IDP Template Projection handlers already exist (verified)
- ✅ Events compatible with existing projections
- ✅ No regressions in existing tests
- ✅ Commands registered in Commands class

---

## 📚 REFERENCE FILES

### Zitadel Go Implementation
```
internal/command/idp.go                    # Core IDP commands
internal/command/idp_oidc_config.go        # OIDC provider
internal/command/idp_oauth_config.go       # OAuth provider
internal/command/idp_jwt_config.go         # JWT provider (deferred)
internal/domain/idp.go                     # IDP domain types
internal/repository/idp/                   # Event schemas
```

### Existing TypeScript Files
```
src/lib/query/projections/idp-projection.ts              # IDP projection (ready)
src/lib/query/projections/idp-template-projection.ts     # IDP template projection (ready)
src/lib/command/org/org-idp-commands.ts                  # Org-level IDP (reference)
```

---

## 🎯 EXPECTED OUTCOMES

### Parity Gain
- **Before:** 81% parity
- **After:** 83% parity (+2%)

### Commands Added
- **Total:** 10 new commands
- **Categories:** 3 (IDP Template, OIDC, OAuth)

### Tests Added
- **Total:** 25+ integration tests
- **Coverage:** Success paths, error paths, lifecycles

### Files Created
- **Commands:** 3 new command files
- **Write Models:** 2-3 new write model files
- **Tests:** 3 new test files

---

## 🚀 GETTING STARTED

### Day 1 Tasks
1. ✅ Review this implementation plan
2. Read Zitadel Go `idp.go` implementation
3. Create `src/lib/command/idp/` directory
4. Create `idp-template-commands.ts` skeleton
5. Create `idp-template-write-model.ts`
6. Implement `addIDPTemplate()` command
7. Write first integration test

### Commands to Run
```bash
# Create directory structure
mkdir -p src/lib/command/idp
mkdir -p test/integration/commands

# Run tests as you implement
npm run test:integration -- idp-template.test.ts

# Run full suite to check for regressions
npm run test:integration

# Build to verify no TypeScript errors
npm run build
```

---

## 📝 NOTES

### IDP Types Supported
1. **OIDC** - OpenID Connect (Google, Azure AD, custom)
2. **OAuth** - OAuth 2.0 (GitHub, GitLab, custom)
3. **SAML** - SAML 2.0 (deferred to Phase 3)
4. **LDAP** - LDAP/Active Directory (deferred to Phase 3)
5. **JWT** - JWT-based authentication (deferred to Phase 3)

### Auto-Features
- **autoRegister** - Automatically create user account on first SSO login
- **autoUpdate** - Automatically update user profile from IDP claims
- **autoLinking** - Link SSO login to existing user by email match

### Field Mappings
Map IDP claims to Zitadel user fields:
- `email` → user email
- `username` → user login name
- `firstName` → user first name
- `lastName` → user last name
- `displayName` → user display name
- `preferredLanguage` → user language preference

---

**Week 13 Status:** 🚀 READY TO START  
**Next Action:** Read Zitadel Go `idp.go` and create `idp-template-commands.ts`  
**Estimated Completion:** 7 days  
**Dependencies:** None (all prerequisites met)

