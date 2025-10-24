# Phase 1 Implementation Guide
# Command Module Parity - Weeks 1-8

**Start Date:** October 24, 2025  
**Current Week:** Week 1-2 (33% complete)  
**Goal:** Achieve 60% overall command parity with all P0 features

---

## 📋 WEEK-BY-WEEK BREAKDOWN

### **Week 1-2: Organization Enhancement Commands**

**Status:** Week 1-2 COMPLETE ✅ 🎉

#### Deliverables
- [x] `org-member-commands.ts` - Organization member management ✅ **COMPLETE (15/15 tests)**
- [x] `org-idp-commands.ts` - Organization IDP configuration ✅ **COMPLETE (13/13 tests)**
- [x] `org-login-policy-commands.ts` - Organization login policies ✅ **COMPLETE (27/27 tests)**
- [x] Integration tests: 55 total, 55 passing (100%) ✅

---

### **Week 3-4: Project Enhancement Commands**

**Status:** Week 3-4 COMPLETE ✅ 🎉

#### Deliverables
- [x] `project-commands.ts` - Project lifecycle, roles, members, grants ✅ **COMPLETE (29/29 tests)**
- [x] `project-grant-member-commands.ts` - Cross-org grant member management ✅ **COMPLETE**
- [x] Enhanced with complete stack integration (Command → Event → Projection → Query) ✅
- [x] Integration tests: 29 tests, 29 passing (100%) ✅

#### Commands Implemented (16 total)
**Project Lifecycle:**
- addProject, changeProject, deactivateProject, reactivateProject, removeProject

**Project Roles:**
- addProjectRole, changeProjectRole, removeProjectRole

**Project Members:**
- addProjectMember, changeProjectMember, removeProjectMember

**Project Grants (Cross-Org Sharing):**
- addProjectGrant, changeProjectGrant, deactivateProjectGrant, reactivateProjectGrant, removeProjectGrant

**Project Grant Members:**
- addProjectGrantMember, changeProjectGrantMember, removeProjectGrantMember

#### Files Enhanced
```
src/lib/command/project/project-commands.ts (16 commands)
src/lib/command/project/project-grant-member-commands.ts (3 commands)
test/integration/commands/project.test.ts (29 tests, enhanced with projection integration)
```

#### Files to Create
```
src/lib/command/org/org-member-commands.ts
src/lib/command/org/org-member-write-model.ts
src/lib/command/org/org-idp-commands.ts
src/lib/command/org/org-idp-write-model.ts
src/lib/command/org/org-login-policy-commands.ts
src/lib/command/org/org-login-policy-write-model.ts

test/integration/command/org-member-commands.integration.test.ts
test/integration/command/org-idp-commands.integration.test.ts
test/integration/command/org-login-policy-commands.integration.test.ts
```

#### Reference Files (Zitadel Go)
```
internal/command/org_member.go
internal/command/org_member_model.go
internal/command/org_idp.go
internal/command/org_idp_config.go
internal/command/org_login_policy.go
```

#### ✅ Completed Commands (Week 1)

**org-member commands (DONE):**
- ✅ `addOrgMember()` - Add member with role validation (ORG_ prefix)
- ✅ `changeOrgMember()` - Update member roles with idempotency
- ✅ `removeOrgMember()` - Remove member with cascade support
- ✅ `listOrgMembers()` - Query member list

**Implementation Details:**
- File: `src/lib/command/org/org-commands.ts` (enhanced existing)
- Write Model: `OrgMemberWriteModel` (embedded in org-commands.ts)
- Tests: `test/integration/commands/org-member.test.ts`
- Test Results: **15/15 passing (100%)** ✅
- Role Validation: ✅ ORG_ prefix + SELF_MANAGEMENT_GLOBAL
- Event Schema: ✅ 100% compatible with Zitadel Go
- Projection Fix: ✅ Fixed bigint issue in org-member-projection

**Key Learnings:**
1. Use `Number(event.aggregateVersion)` not `event.position?.position` for sequence columns
2. Always create test data via commands (event sourcing), never direct DB writes
3. Test location: `/test/integration/commands/` (plural) not `/command/`
4. Process projections explicitly in tests: `await processProjection()`
5. Verify at every step: Command → Event → Projection → Query

**Blocked/Deferred:**
- `reactivateOrgMember()` - Not in Zitadel Go, skipped
- `getOrgMember()` - Query layer, not command (separate work)

---

#### 🔜 Remaining Commands (Week 1-2)

**org-idp-commands.ts:**
- `addOrgIDPConfig()` - Add IDP to organization
- `changeOrgIDPConfig()` - Update IDP configuration
- `removeOrgIDPConfig()` - Remove IDP from organization
- `activateOrgIDPConfig()` - Activate IDP
- `deactivateOrgIDPConfig()` - Deactivate IDP

**org-login-policy-commands.ts:**
- `addOrgLoginPolicy()` - Set organization login policy
- `changeOrgLoginPolicy()` - Update login policy settings
- `removeOrgLoginPolicy()` - Remove custom policy (use default)
- `addOrgMultiFactorToLoginPolicy()` - Add MFA options
- `removeOrgMultiFactorFromLoginPolicy()` - Remove MFA options
- `addOrgSecondFactorToLoginPolicy()` - Add 2FA options
- `removeOrgSecondFactorFromLoginPolicy()` - Remove 2FA options

---

### **Week 3-4: Project & Application Enhancement**

#### Deliverables
- [ ] `project-role-commands.ts` - Project role management
- [ ] `project-member-commands.ts` - Project member management
- [ ] `project-grant-commands.ts` - Project grant management
- [ ] `app-oidc-config-commands.ts` - OIDC app configuration
- [ ] `app-api-config-commands.ts` - API app configuration
- [ ] Integration tests for all new commands (40+ tests)

#### Files to Create
```
src/lib/command/project/project-role-commands.ts
src/lib/command/project/project-role-write-model.ts
src/lib/command/project/project-member-commands.ts
src/lib/command/project/project-member-write-model.ts
src/lib/command/project/project-grant-commands.ts
src/lib/command/project/project-grant-write-model.ts

src/lib/command/application/app-oidc-config-commands.ts
src/lib/command/application/app-oidc-config-write-model.ts
src/lib/command/application/app-api-config-commands.ts
src/lib/command/application/app-api-config-write-model.ts

test/integration/command/project-role-commands.integration.test.ts
test/integration/command/project-member-commands.integration.test.ts
test/integration/command/project-grant-commands.integration.test.ts
test/integration/command/app-oidc-config-commands.integration.test.ts
test/integration/command/app-api-config-commands.integration.test.ts
```

#### Reference Files (Zitadel Go)
```
internal/command/project_role.go
internal/command/project_member.go
internal/command/project_grant.go
internal/command/project_application_oidc.go
internal/command/project_application_api.go
```

#### Key Commands to Implement

**project-role-commands.ts:**
- `addProjectRole()` - Add role to project
- `changeProjectRole()` - Update role definition
- `removeProjectRole()` - Remove role from project
- `bulkAddProjectRoles()` - Bulk add roles

**project-member-commands.ts:**
- `addProjectMember()` - Add member to project
- `changeProjectMember()` - Update member roles
- `removeProjectMember()` - Remove member from project

**project-grant-commands.ts:**
- `addProjectGrant()` - Grant project to organization
- `changeProjectGrant()` - Update grant configuration
- `removeProjectGrant()` - Remove project grant
- `deactivateProjectGrant()` - Deactivate grant
- `reactivateProjectGrant()` - Reactivate grant

**app-oidc-config-commands.ts:**
- `addOIDCAppConfig()` - Configure OIDC settings
- `changeOIDCAppConfig()` - Update OIDC settings
- `regenerateOIDCClientSecret()` - Regenerate secret
- `addOIDCRedirectURI()` - Add redirect URI
- `removeOIDCRedirectURI()` - Remove redirect URI
- `changeOIDCAppToConfidential()` - Change to confidential
- `changeOIDCAppToPublic()` - Change to public

**app-api-config-commands.ts:**
- `addAPIAppConfig()` - Configure API settings
- `changeAPIAppConfig()` - Update API settings
- `regenerateAPIClientSecret()` - Regenerate secret
- `changeAPIAppAuthMethod()` - Change auth method

---

### **Week 5-6: Instance Management Commands**

#### Deliverables
- [ ] `instance-domain-commands.ts` - Instance domain management
- [ ] `instance-member-commands.ts` - Instance member management
- [ ] `instance-features-commands.ts` - Instance feature flags
- [ ] Integration tests for all new commands (30+ tests)

#### Files to Create
```
src/lib/command/instance/instance-domain-commands.ts
src/lib/command/instance/instance-domain-write-model.ts
src/lib/command/instance/instance-member-commands.ts
src/lib/command/instance/instance-member-write-model.ts
src/lib/command/instance/instance-features-commands.ts
src/lib/command/instance/instance-features-write-model.ts

test/integration/command/instance-domain-commands.integration.test.ts
test/integration/command/instance-member-commands.integration.test.ts
test/integration/command/instance-features-commands.integration.test.ts
```

#### Reference Files (Zitadel Go)
```
internal/command/instance_domain.go
internal/command/instance_member.go
internal/command/instance_features.go
```

#### Key Commands to Implement

**instance-domain-commands.ts:**
- `addInstanceDomain()` - Add domain to instance
- `setDefaultInstanceDomain()` - Set default domain
- `removeInstanceDomain()` - Remove domain
- `generateInstanceDomain()` - Generate unique domain

**instance-member-commands.ts:**
- `addInstanceMember()` - Add IAM admin
- `changeInstanceMember()` - Update admin role
- `removeInstanceMember()` - Remove IAM admin

**instance-features-commands.ts:**
- `setInstanceFeatures()` - Set feature flags
- `setDefaultInstanceFeatures()` - Set default features
- `resetInstanceFeatures()` - Reset to defaults

---

### **Week 7-8: Session & Auth Enhancement**

#### Deliverables
- [ ] `session-metadata-commands.ts` - Session metadata
- [ ] `session-token-commands.ts` - Session token management
- [ ] `auth-request-complete-commands.ts` - Auth flow completion
- [ ] `auth-callback-commands.ts` - OAuth callbacks
- [ ] Integration tests for all new commands (30+ tests)

#### Files to Create
```
src/lib/command/session/session-metadata-commands.ts
src/lib/command/session/session-token-commands.ts
src/lib/command/session/session-token-write-model.ts

src/lib/command/auth/auth-request-complete-commands.ts
src/lib/command/auth/auth-callback-commands.ts
src/lib/command/auth/auth-callback-write-model.ts

test/integration/command/session-metadata-commands.integration.test.ts
test/integration/command/session-token-commands.integration.test.ts
test/integration/command/auth-complete-commands.integration.test.ts
```

#### Reference Files (Zitadel Go)
```
internal/command/session.go
internal/command/auth_request.go
```

#### Key Commands to Implement

**session-metadata-commands.ts:**
- `setSessionMetadata()` - Set session metadata
- `bulkSetSessionMetadata()` - Bulk set metadata
- `removeSessionMetadata()` - Remove metadata

**session-token-commands.ts:**
- `setSessionToken()` - Set session token
- `checkSessionToken()` - Validate token
- `refreshSessionToken()` - Refresh token

**auth-request-complete-commands.ts:**
- `linkAuthRequestToSession()` - Link auth to session
- `succeedAuthRequest()` - Mark auth successful
- `failAuthRequest()` - Mark auth failed
- `cancelAuthRequest()` - Cancel auth flow

---

## 🧪 TESTING REQUIREMENTS

### Test Coverage Per Command
Each command must have tests for:
1. ✅ **Happy Path** - Successful execution
2. ✅ **Validation** - Invalid input handling
3. ✅ **Permissions** - Authorization checks
4. ✅ **Not Found** - Resource doesn't exist
5. ✅ **Conflict** - Duplicate/concurrent modifications
6. ✅ **Cascade** - Related entity cleanup
7. ✅ **Multi-tenant** - Instance isolation

### Test Template Structure
```typescript
describe('CommandName Integration Tests', () => {
  let commands: Commands;
  let testContext: Context;
  
  beforeAll(async () => {
    // Setup
  });
  
  afterAll(async () => {
    // Cleanup
  });
  
  describe('Happy Path', () => {
    it('should execute successfully', async () => {
      // Test implementation
    });
  });
  
  describe('Validation', () => {
    it('should reject invalid input', async () => {
      // Test implementation
    });
  });
  
  describe('Permissions', () => {
    it('should require proper authorization', async () => {
      // Test implementation
    });
  });
  
  // ... more test suites
});
```

---

## 📊 SUCCESS CRITERIA

### Phase 1 Completion Checklist
- [ ] All 15+ command files created
- [ ] All 100+ integration tests passing
- [ ] Command→Event→Projection flow verified for each command
- [ ] API endpoints added for new commands
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Performance benchmarks met

### Metrics Targets
- **Overall Parity:** 45% → 60% ✅
- **Integration Tests:** 810 → 750+ (new framework) ✅
- **Command Coverage:** 30 → 45+ command modules ✅
- **Code Coverage:** Maintain 85%+ ✅

---

## 🔍 IMPLEMENTATION CHECKLIST (Per Command)

### 1. Research Phase
- [ ] Read Zitadel Go implementation
- [ ] Understand event schema
- [ ] Identify business rules
- [ ] Map write model state

### 2. Implementation Phase
- [ ] Create command file
- [ ] Create write model file
- [ ] Implement command methods
- [ ] Add validation logic
- [ ] Add permission checks
- [ ] Generate proper events

### 3. Testing Phase
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Test multi-tenancy
- [ ] Test edge cases
- [ ] Test performance

### 4. Integration Phase
- [ ] Register in Commands class
- [ ] Add API endpoint
- [ ] Update OpenAPI spec
- [ ] Add to documentation
- [ ] Code review

---

## 🚀 GETTING STARTED

### Day 1 Tasks
1. Review `COMMAND_MODULE_PARITY_TRACKER.md`
2. Read Zitadel Go org_member.go
3. Create `org-member-commands.ts` skeleton
4. Create `org-member-write-model.ts`
5. Implement first command: `addOrgMember()`
6. Write first integration test

### Development Workflow
```bash
# 1. Create feature branch
git checkout -b feature/phase1-week1-org-member

# 2. Implement command
# ... code implementation ...

# 3. Run tests
npm run test:unit -- org-member
npm run test:integration -- org-member

# 4. Verify compilation
npm run build

# 5. Commit and push
git add .
git commit -m "feat: implement org member commands"
git push origin feature/phase1-week1-org-member

# 6. Create PR
```

---

## 📚 RESOURCES

### Key Reference Files
- `src/lib/command/commands.ts` - Main Commands class
- `src/lib/command/user/user-commands.ts` - Example implementation
- `src/lib/command/write-model.ts` - Base write model
- `test/integration/command/command.test.ts` - Test examples

### Zitadel Go References
- `/Users/dsharma/authapp/zitadel/internal/command/` - All Go commands
- `/Users/dsharma/authapp/zitadel/internal/domain/` - Domain logic
- `/Users/dsharma/authapp/zitadel/internal/repository/` - Event schemas

### Documentation
- `COMMAND_MODULE_PARITY_TRACKER.md` - Full feature tracker
- `SCHEMA_PARITY_ANALYSIS.md` - Database schema analysis
- `API_DESIGN.md` - API design principles

---

**Ready to Start Phase 1!** 🚀
