# 🎯 Integration Test Tiers - Dependency-Based Organization

**Last Updated:** October 28, 2025  
**Purpose:** Organize integration tests by projection dependencies for efficient testing

---

## 📊 Overview

Integration tests are organized into tiers based on projection dependencies:
- **Tier 1:** No projection dependencies (independent tests)
- **Tier 2:** Single projection dependency
- **Tier 3:** Multiple projection dependencies
- **Tier 4:** Complex cross-projection dependencies

**Total Tests:** 78 integration test files

---

## 🎖️ TIER 1: Independent Tests (No Projection Dependencies)

**Count:** 23 tests  
**Run Time:** ~2-3 minutes  
**Can Run:** Fully parallel

### Infrastructure Tests (3)
```bash
test/integration/database/migration.integration.test.ts
test/integration/eventstore/eventstore.test.ts
test/integration/eventstore/eventstore.concurrency.test.ts
```

### Core Entity Projections (8)
Independent entity projections with no dependencies on other projections:

```bash
# Instance (root entity)
test/integration/query/projections/instance-projection.integration.test.ts

# Organization (independent)
test/integration/query/projections/org-projection.integration.test.ts

# Project (independent)
test/integration/query/projections/project-projection.integration.test.ts

# User (independent)
test/integration/query/projections/user-projection.integration.test.ts

# Session (independent)
test/integration/query/projections/session-projection.integration.test.ts

# Auth Request (independent)
test/integration/query/projections/auth-request-projection.integration.test.ts

# Quota (independent)
test/integration/query/projections/quota-projection.integration.test.ts

# Milestones (independent)
test/integration/query/projections/milestones-projection.integration.test.ts
```

### Policy Projections (7)
All policy projections are independent:

```bash
test/integration/query/projections/password-policy-projection.integration.test.ts
test/integration/query/projections/password-complexity-queries.integration.test.ts
test/integration/query/projections/domain-label-policy-projection.integration.test.ts
test/integration/query/projections/login-policy-projection.integration.test.ts
test/integration/query/projections/security-notification-policy-projection.integration.test.ts
test/integration/query/projections/lockout-policy-queries.integration.test.ts
```

### Notification Infrastructure (3)
```bash
test/integration/query/projections/smtp-projection.integration.test.ts
test/integration/query/projections/sms-projection.integration.test.ts
test/integration/query/projections/mail-oidc-projection.integration.test.ts
```

### IDP Projections (1)
```bash
# Registers 4 IDP-related projections: idp, idp_template, idp_user_link, idp_login_policy_link
test/integration/query/projections/idp-projection.integration.test.ts
```

### Actions (1)
```bash
test/integration/query/projections/actions-projection.integration.test.ts
```

---

## 🥈 TIER 2: Single Dependency Tests

**Count:** 24 tests  
**Run Time:** ~4-5 minutes  
**Can Run:** Parallel within tier (after Tier 1)

### User-Related Projections (4)
**Depends on:** `user_projection`

```bash
test/integration/query/projections/user-address-projection.integration.test.ts
test/integration/query/projections/user-metadata-projection.integration.test.ts
test/integration/query/projections/user-auth-method-projection.integration.test.ts
test/integration/query/projections/personal-access-token-projection.integration.test.ts
```

### Application Projection (1)
**Depends on:** `project_projection`

```bash
test/integration/query/projections/app-projection.integration.test.ts
```

### Member Projections (3)
**Depends on:** org, project, or instance

```bash
test/integration/query/projections/member-projections.integration.test.ts
# Tests: org_member, project_member, instance_member, project_grant_member
```

### User Grant Projection (1)
**Depends on:** `user_projection`, `project_projection`

```bash
test/integration/query/projections/user-grant-projection.integration.test.ts
```

### Project Grant Projection (1)
**Depends on:** `org_projection`, `project_projection`

```bash
test/integration/query/projections/project-grant-projection.integration.test.ts
```

### Command Tests - Basic (14)
Single-entity command tests with minimal dependencies:

```bash
# Organization Commands
test/integration/commands/organization.test.ts
test/integration/commands/org-domain.test.ts
test/integration/commands/org-member.test.ts
test/integration/commands/org-idp.test.ts
test/integration/commands/org-login-policy.test.ts

# Instance Commands
test/integration/commands/instance.test.ts

# User Commands (basic)
test/integration/commands/user-commands.test.ts
test/integration/commands/user-password.test.ts

# Project Commands
test/integration/commands/project.test.ts

# Session Commands
test/integration/commands/session-commands.test.ts
test/integration/commands/auth-commands.test.ts

# Encryption
test/integration/commands/encryption-key.test.ts

# Logout
test/integration/commands/logout.test.ts

# OIDC Session
test/integration/commands/oidc-session.test.ts
```

---

## 🥉 TIER 3: Multiple Dependencies Tests

**Count:** 16 tests  
**Run Time:** ~5-6 minutes  
**Can Run:** Parallel within tier (after Tier 2)

### Login Name Projection (1)
**Depends on:** `user_projection`, `org_projection`, `org_domain_projection`

```bash
test/integration/query/projections/login-name-projection.integration.test.ts
```

### Permission Queries (1)
**Depends on:** `user_grant_projection`, `project_grant_projection`, `member_projections`

```bash
test/integration/query/projections/permission-queries.integration.test.ts
```

### Authn Key Projection (1)
**Depends on:** `user_projection`, `app_projection`

```bash
test/integration/query/projections/authn-key-projection.integration.test.ts
```

### Application Commands (3)
**Depends on:** project, org setup

```bash
test/integration/commands/application.test.ts
test/integration/commands/app-oidc-config.test.ts
test/integration/commands/app-api-config.test.ts
```

### User Authentication Commands (5)
**Depends on:** user, org, policies

```bash
test/integration/commands/user-auth.test.ts
test/integration/commands/user-totp.test.ts
test/integration/commands/user-webauthn.test.ts
test/integration/commands/user-otp-sms-email.test.ts
test/integration/commands/user-metadata.test.ts
```

### IDP Commands (4)
**Depends on:** instance, org, policies

```bash
test/integration/commands/instance-idp.test.ts
test/integration/commands/jwt-idp.test.ts
test/integration/commands/ldap-idp.test.ts
test/integration/commands/saml-idp.test.ts
```

### Policy Commands (6)
**Depends on:** org or instance setup

```bash
test/integration/commands/label-policy.test.ts
test/integration/commands/password-policy.test.ts
test/integration/commands/domain-policy.test.ts
test/integration/commands/notification-policy.test.ts
test/integration/commands/privacy-policy.test.ts
```

### Notification Commands (2)
**Depends on:** instance, org setup

```bash
test/integration/commands/smtp.test.ts
test/integration/commands/sms.test.ts
```

### Project Grant Member (1)
**Depends on:** org, project, project_grant

```bash
test/integration/commands/project-grant-member.test.ts
```

---

## 🏆 TIER 4: Complex Integration Tests

**Count:** 15 tests  
**Run Time:** ~6-8 minutes  
**Can Run:** Sequential or limited parallelism

### Comprehensive/System Tests (5)
**Depends on:** Multiple projections and systems

```bash
test/integration/query/projections/projection-system.integration.test.ts
test/integration/query/projections/projection-lifecycle.test.ts
test/integration/query/projections/projection-with-database.test.ts
test/integration/query/projections/projection-enhanced-tracking.test.ts
test/integration/command-bus.integration.test.ts
```

### Custom Text (2)
**Depends on:** org, instance, policies

```bash
test/integration/commands/custom-text.test.ts
test/integration/commands/custom-text-comprehensive.test.ts
```

### Security Features (2)
**Depends on:** user, org, project, app

```bash
test/integration/commands/personal-access-token.test.ts
test/integration/commands/machine-key.test.ts
```

### Provider Helpers (1)
**Depends on:** Multiple systems

```bash
test/integration/commands/provider-helpers.test.ts
```

---

## 📋 Test Execution Strategy

### Sequential Execution (Safest)
```bash
# Run all tests in order
npm run test:integration

# Or by tier:
npm run test:integration -- test/integration/database
npm run test:integration -- test/integration/eventstore
npm run test:integration -- test/integration/query/projections/instance-projection
# ... etc
```

### Tier-Based Execution (Optimized)
```bash
# Tier 1: Run all independent tests in parallel
npm run test:integration -- test/integration/database
npm run test:integration -- test/integration/eventstore
npm run test:integration -- test/integration/query/projections/instance-projection.integration.test.ts &
npm run test:integration -- test/integration/query/projections/org-projection.integration.test.ts &
npm run test:integration -- test/integration/query/projections/user-projection.integration.test.ts &
# Wait for Tier 1 to complete...

# Tier 2: Run after Tier 1
npm run test:integration -- test/integration/query/projections/app-projection.integration.test.ts &
npm run test:integration -- test/integration/query/projections/user-address-projection.integration.test.ts &
# ... etc

# Tier 3: Run after Tier 2
npm run test:integration -- test/integration/query/projections/login-name-projection.integration.test.ts
# ... etc

# Tier 4: Run sequentially after Tier 3
npm run test:integration -- test/integration/query/projections/projection-system.integration.test.ts
```

### Individual Test Execution
```bash
# Run a single test file
npm run test:integration -- test/integration/query/projections/instance-projection.integration.test.ts

# Run with specific test name
npm run test:integration -- test/integration/query/projections/instance-projection.integration.test.ts -t "should handle instance.added event"
```

---

## 🎯 Quick Reference by Category

### By Domain Entity

**Instance (4 tests):**
- Tier 1: instance-projection
- Tier 2: instance.test.ts, instance-idp.test.ts
- Tier 3: (various policy tests)

**Organization (7 tests):**
- Tier 1: org-projection
- Tier 2: organization.test.ts, org-domain.test.ts, org-member.test.ts, org-idp.test.ts, org-login-policy.test.ts
- Tier 3: (various policy tests)

**Project (5 tests):**
- Tier 1: project-projection
- Tier 2: project.test.ts, project-grant-projection
- Tier 3: application tests

**User (10 tests):**
- Tier 1: user-projection
- Tier 2: user-commands.test.ts, user-password.test.ts, user-address, user-metadata, user-auth-method, personal-access-token
- Tier 3: user-auth.test.ts, user-totp.test.ts, user-webauthn.test.ts, user-otp-sms-email.test.ts

**Application (3 tests):**
- Tier 2: app-projection
- Tier 3: application.test.ts, app-oidc-config.test.ts, app-api-config.test.ts

**Session (2 tests):**
- Tier 1: session-projection
- Tier 2: session-commands.test.ts

**Auth (2 tests):**
- Tier 1: auth-request-projection
- Tier 2: auth-commands.test.ts

---

## 📊 Summary Statistics

| Tier | Tests | Avg Runtime | Parallelizable | Dependencies |
|------|-------|-------------|----------------|--------------|
| **Tier 1** | 23 | ~2-3 min | ✅ Full | None |
| **Tier 2** | 24 | ~4-5 min | ✅ Within tier | 1 projection |
| **Tier 3** | 16 | ~5-6 min | ⚠️ Limited | 2-3 projections |
| **Tier 4** | 15 | ~6-8 min | ❌ Sequential | Complex |
| **Total** | 78 | ~17-22 min | - | - |

---

## 🚀 Optimization Tips

1. **Tier 1 First:** Always run Tier 1 tests first - they catch the most basic issues
2. **Parallel Tier 1:** Run all Tier 1 tests in parallel to save time
3. **Failed Test Strategy:** If a Tier 1 test fails, fix it before running higher tiers
4. **Database Isolation:** Each test should clean up after itself
5. **Projection State:** Use `waitForProjection()` helpers to ensure projections are ready

---

## 🔍 Finding Test Dependencies

To determine a test's tier:
1. Look at `beforeAll()` setup
2. Count `registry.register()` calls
3. Check for projection dependencies in imports
4. Review event types being tested

Example:
```typescript
// Tier 1: Single projection
registry.register(config, new UserProjection(eventstore, pool));

// Tier 2: Two projections
registry.register(userConfig, new UserProjection(eventstore, pool));
registry.register(addressConfig, new UserAddressProjection(eventstore, pool));

// Tier 3: Three+ projections
registry.register(userConfig, new UserProjection(eventstore, pool));
registry.register(orgConfig, new OrgProjection(eventstore, pool));
registry.register(loginNameConfig, new LoginNameProjection(eventstore, pool));
```

---

## ✅ Best Practices

1. **Run Tier 1 Daily:** Fast feedback on basic functionality
2. **Run All Tiers Pre-Commit:** Ensure no regressions
3. **Use Test Filters:** Run specific tiers during development
4. **Monitor Test Times:** Identify slow tests for optimization
5. **Update This Doc:** When adding new tests, categorize them properly

---

**Last Updated:** October 28, 2025  
**Maintained By:** Development Team  
**Reference:** `/test/integration/` directory
