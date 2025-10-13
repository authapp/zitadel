# Query Module - Tier 2: Core CQRS
**Timeline:** Week 3-8 (6 weeks)  
**Priority:** CRITICAL  
**Status:** 🔴 Not Started  
**Depends On:** ✅ Tier 1 (Foundation)

---

## 🎯 Overview

Implement **core domain queries and projections** for User, Organization, Project, Application, Instance, and Session - the foundational read models for authentication & authorization.

---

## 📦 Deliverables

1. User queries + UserProjection (15+ methods, ~15K lines)
2. Organization queries + OrgProjection (7+ methods, ~8K lines)
3. Project queries + ProjectProjection (6+ methods, ~10K lines)
4. Application queries + AppProjection (14+ methods, ~15K lines)
5. Instance queries + InstanceProjection (6+ methods, ~8K lines)
6. Session queries + SessionProjection (4+ methods, ~8K lines)
7. LoginNameProjection for fast lookups
8. Projection tables migration
9. Complete test coverage (>85%)

---

## 📋 Detailed Tasks

### Task 2.1: User Domain (Week 3-4, 2 weeks)

**Files to create:**
- `src/lib/query/user/user-queries.ts`
- `src/lib/query/user/user-types.ts`
- `src/lib/query/projection/user-projection.ts`

**Query Methods (15):**
1. `getUserByID` - Get user by ID
2. `getUserByLoginName` - Get user by login name
3. `searchUsers` - Search with filters
4. `getUserProfile` - Get user profile
5. `isUserUnique` - Check uniqueness
6. `getHumanProfile` - Get human user
7. `getMachine` - Get machine user
8. `getNotifyUserByID` - Get for notifications
9. `getUserByLoginNameGlobal` - Global lookup
10. `getUserByUserSessionID` - Get by session
11-15. Helper methods

**Projection Events:**
- user.human.added, user.machine.added
- user.removed, user.deactivated, user.reactivated
- user.locked, user.unlocked
- user.human.profile.changed
- user.username.changed
- user.human.email.changed/verified
- user.human.phone.changed/verified/removed

**Acceptance Criteria:**
- [ ] All 15 methods implemented
- [ ] UserProjection processes all events
- [ ] Human/Machine users handled
- [ ] Login name resolution works
- [ ] Tests >85% coverage

**Reference:** `internal/query/user.go` (41,731 lines), `internal/query/projection/user.go` (41,048 lines)

---

### Task 2.2: Organization Domain (Week 4, 1 week)

**Files:**
- `src/lib/query/org/org-queries.ts`
- `src/lib/query/org/org-types.ts`
- `src/lib/query/projection/org-projection.ts`
- `src/lib/query/projection/org-domain-projection.ts`

**Query Methods (7):**
1. `getOrgByID` - Get org by ID
2. `getOrgByDomainGlobal` - Get by domain
3. `searchOrgs` - Search orgs
4. `getOrgDomainsByID` - Get org domains
5. `searchOrgDomains` - Search domains
6-7. Helper methods

**Projection Events:**
- org.added, org.changed, org.removed
- org.deactivated, org.reactivated
- org.domain.added, org.domain.verified
- org.domain.primary.set, org.domain.removed

**Acceptance Criteria:**
- [ ] All 7 methods implemented
- [ ] OrgProjection + OrgDomainProjection working
- [ ] Domain verification works
- [ ] Primary domain handling works
- [ ] Tests >85% coverage

**Reference:** `internal/query/org.go` (13,645 lines), `internal/query/projection/org.go` (7,000 lines)

---

### Task 2.3: Project Domain (Week 5, 1 week)

**Files:**
- `src/lib/query/project/project-queries.ts`
- `src/lib/query/project/project-types.ts`
- `src/lib/query/projection/project-projection.ts`
- `src/lib/query/projection/project-role-projection.ts`

**Query Methods (6):**
1. `getProjectByID` - Get project
2. `searchProjects` - Search projects
3. `searchProjectRoles` - Search roles
4. `getProjectByClientID` - Get by client ID
5-6. Helper methods

**Projection Events:**
- project.added, project.changed, project.removed
- project.deactivated, project.reactivated
- project.role.added, project.role.changed, project.role.removed

**Acceptance Criteria:**
- [ ] All 6 methods implemented
- [ ] ProjectProjection + ProjectRoleProjection working
- [ ] Role assertions work
- [ ] Tests >85% coverage

**Reference:** `internal/query/project.go` (22,298 lines), `internal/query/projection/project.go` (8,801 lines)

---

### Task 2.4: Application Domain (Week 5-6, 1.5 weeks)

**Files:**
- `src/lib/query/app/app-queries.ts`
- `src/lib/query/app/app-types.ts`
- `src/lib/query/projection/app-projection.ts`

**Query Methods (14):**
1. `getAppByID`
2. `searchApps`
3. `searchClientIDs`
4. `getOIDCAppConfig`
5. `getSAMLAppConfig`
6. `getAPIAppConfig`
7. `getAppByClientID`
8. `searchProjectIDsByClientID`
9. `existsApp`
10. `getProjectByOIDCClientID`
11. `getProjectByClientID`
12. `getAPIAppByClientID`
13. `getOIDCAppByClientID`
14. `getSAMLAppByEntityID`

**Projection Events:**
- project.application.added/changed/removed
- project.application.deactivated/reactivated
- project.application.oidc.added/changed/secret.changed
- project.application.saml.added/changed
- project.application.api.added/changed/secret.changed

**Acceptance Criteria:**
- [ ] All 14 methods implemented
- [ ] AppProjection processes all app events
- [ ] OIDC/SAML/API configs work
- [ ] Client ID lookups work
- [ ] Tests >85% coverage

**Reference:** `internal/query/app.go` (38,730 lines), `internal/query/projection/app.go` (30,367 lines)

---

### Task 2.5: Instance Domain (Week 6, 1 week)

**Files:**
- `src/lib/query/instance/instance-queries.ts`
- `src/lib/query/instance/instance-types.ts`
- `src/lib/query/projection/instance-projection.ts`
- `src/lib/query/projection/instance-domain-projection.ts`

**Query Methods (6):**
1. `getInstanceByID`
2. `getInstanceByHost`
3. `getDefaultInstance`
4. `searchInstanceDomains`
5. `getInstanceFeatures`
6. `searchInstanceTrustedDomains`

**Projection Events:**
- instance.added, instance.changed, instance.removed
- instance.domain.added, instance.domain.removed
- instance.domain.primary.set

**Acceptance Criteria:**
- [ ] All 6 methods implemented
- [ ] Multi-tenant instance lookup works
- [ ] Domain-based resolution works
- [ ] Tests >85% coverage

**Reference:** `internal/query/instance.go` (19,704 lines), `internal/query/projection/instance.go` (7,502 lines)

---

### Task 2.6: Session Domain (Week 7, 1 week)

**Files:**
- `src/lib/query/session/session-queries.ts`
- `src/lib/query/session/session-types.ts`
- `src/lib/query/projection/session-projection.ts`

**Query Methods (4):**
1. `getSessionByID`
2. `searchSessions`
3. `getActiveSessionsCount`
4. Session lifecycle helpers

**Projection Events:**
- session.added, session.updated
- session.token.set
- session.metadata.set, session.metadata.deleted
- session.terminated

**Acceptance Criteria:**
- [ ] All 4 methods implemented
- [ ] SessionProjection working
- [ ] Active session counting works
- [ ] Metadata handling works
- [ ] Tests >85% coverage

**Reference:** `internal/query/session.go` (19,173 lines), `internal/query/projection/session.go` (15,921 lines)

---

### Task 2.7: Login Name Projection (Week 7, 2 days)

**File:** `src/lib/query/projection/login-name-projection.ts`

**Purpose:** Denormalized table for fast login name lookups

**Events:** User, Org, Instance events affecting login names

**Acceptance Criteria:**
- [ ] Fast lookups (<10ms)
- [ ] Multiple login names per user
- [ ] Domain-based login names
- [ ] Tests >85% coverage

**Reference:** `internal/query/projection/login_name.go` (18,237 lines)

---

### Task 2.8: Database Migration (Week 8, 1 day)

**File:** `migrations/012_projection_tables.sql`

**Tables to create:**
- projections.users
- projections.orgs
- projections.org_domains
- projections.projects
- projections.project_roles
- projections.apps
- projections.apps_oidc
- projections.apps_saml
- projections.apps_api
- projections.instances
- projections.instance_domains
- projections.sessions
- projections.login_names

**With appropriate indexes and constraints**

---

### Task 2.9: Integration Testing (Week 8, 2 days)

**Test scenarios:**
1. User: Create user → Query user → Update user → Query updated
2. Org: Create org → Add domain → Query by domain
3. Project: Create project → Add role → Query roles
4. App: Create OIDC app → Query by client ID
5. Instance: Query instance → Query by domain
6. Session: Create session → Query session → Terminate
7. End-to-end: Create full hierarchy and query at each level
8. Performance: Projection lag <100ms, Query <50ms

**Test coverage target:** >85% for all modules

---

## ✅ Success Criteria

### Functional
- [ ] All 52 query methods implemented
- [ ] All 7 projections processing events
- [ ] Database migration complete
- [ ] Login name resolution working
- [ ] Multi-tenant support working

### Non-Functional
- [ ] Unit test coverage >85%
- [ ] Integration tests passing
- [ ] Projection lag <100ms
- [ ] Query response <50ms
- [ ] Build passes with 0 errors
- [ ] All APIs documented

---

## 📈 Estimated Effort

**Total:** 6 weeks (240 hours)  
**Complexity:** VERY HIGH  
**Lines of Code:** ~65,000  
**Risk Level:** HIGH (Core functionality)
