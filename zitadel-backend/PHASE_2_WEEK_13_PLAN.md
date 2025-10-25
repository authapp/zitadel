# Phase 2 Week 13 Implementation Plan
**Start Date:** October 25, 2025  
**Target:** IDP Provider Enhancement  
**Priority:** P1 (Critical for SSO/Federation)  
**Target Parity:** 80% → 83% (+3%)

---

## 🎯 **WEEK 13 OBJECTIVES**

Enhance IDP (Identity Provider) functionality with advanced provider configurations, templates, and instance-level management.

---

## 🔍 **CURRENT STATE ANALYSIS**

### What Already Exists ✅
1. **Org-Level IDP Commands** (Already tested - Phase 1)
   - File: `src/lib/command/org/org-idp-commands.ts`
   - Tests: `test/integration/commands/org-idp.test.ts` (13 tests passing)
   - Commands:
     - ✅ addOIDCIDPToOrg - Add OIDC provider to organization
     - ✅ addOAuthIDPToOrg - Add OAuth provider to organization
     - ✅ updateOrgIDP - Update IDP settings
     - ✅ removeIDPFromOrg - Remove IDP from organization

2. **User IDP Link Commands**
   - File: `src/lib/command/user/user-idp-link-commands.ts`
   - External user linking functionality

### What Needs to be Checked 🔍
1. Instance-level IDP commands
2. IDP template management
3. Provider-specific commands (Google, Azure, GitHub, etc.)
4. IDP activation/deactivation
5. IDP migration commands

---

## 📋 **DISCOVERY TASKS**

Before implementing Week 13, we need to discover what already exists:

### Step 1: Search for Instance IDP Commands
```bash
# Check if instance-level IDP commands exist
find src/lib/command -name "*instance*idp*" -o -name "*idp*template*"
grep -r "addInstanceIDP\|IDPTemplate" src/lib/command --include="*.ts"
```

### Step 2: Check Zitadel Go Reference
Identify what commands exist in Go but not in TypeScript:
- Instance IDP template commands
- Provider-specific configurations (Google, Azure, Apple, GitHub, GitLab)
- IDP JWT configuration
- LDAP/SAML provider commands
- Auto-linking and auto-creation policies

### Step 3: Review Existing Tests
Check what's already tested vs what's missing:
```bash
grep -r "describe.*IDP\|it.*IDP" test/integration --include="*.test.ts"
```

---

## 🎯 **POTENTIAL COMMANDS FOR WEEK 13**

Based on typical IDP provider management, here are potential commands to investigate:

### Instance-Level IDP Management (If exists)
- [ ] `addInstanceIDP()` - Add IDP at instance level
- [ ] `updateInstanceIDP()` - Update instance IDP
- [ ] `removeInstanceIDP()` - Remove instance IDP
- [ ] `activateInstanceIDP()` - Activate IDP for use
- [ ] `deactivateInstanceIDP()` - Deactivate IDP

### IDP Template Management (If exists)
- [ ] `addIDPTemplate()` - Create reusable IDP template
- [ ] `changeIDPTemplate()` - Update template configuration
- [ ] `removeIDPTemplate()` - Delete template
- [ ] `cloneIDPTemplate()` - Duplicate template

### Provider-Specific Commands (If exists)
**Google IDP:**
- [ ] `addGoogleIDP()` - Configure Google OAuth provider
- [ ] `updateGoogleIDP()` - Update Google settings

**Azure AD IDP:**
- [ ] `addAzureADIDP()` - Configure Azure Active Directory
- [ ] `updateAzureADIDP()` - Update Azure AD settings

**GitHub IDP:**
- [ ] `addGitHubIDP()` - Configure GitHub OAuth provider
- [ ] `updateGitHubIDP()` - Update GitHub settings

**GitLab IDP:**
- [ ] `addGitLabIDP()` - Configure GitLab OAuth provider
- [ ] `updateGitLabIDP()` - Update GitLab settings

**Apple IDP:**
- [ ] `addAppleIDP()` - Configure Apple Sign In
- [ ] `updateAppleIDP()` - Update Apple settings

### Advanced IDP Configuration (If exists)
- [ ] `addJWTIDP()` - Configure JWT-based IDP
- [ ] `addLDAPIDP()` - Configure LDAP provider
- [ ] `addSAMLIDP()` - Configure SAML provider
- [ ] `configureIDPMapping()` - Attribute mapping configuration

---

## 🔄 **ALTERNATIVE APPROACH**

If most IDP commands already exist and are tested, Week 13 could focus on:

### Option A: Enhance Existing IDP Tests
- Add more comprehensive test coverage for existing IDP commands
- Test error scenarios, edge cases
- Test IDP lifecycle management
- Test provider-specific configurations

### Option B: Move to Next Phase 2 Week
If IDP commands are already complete, move to:
- **Week 14:** Notification Infrastructure
- **Week 15:** Security & Token Management
- **Week 16:** Logout & Session Management

### Option C: Focus on Advanced IDP Features
- IDP user linking and unlinking
- Auto-creation and auto-update policies
- IDP migration tools
- Multi-tenant IDP configuration

---

## 📊 **SUCCESS CRITERIA**

### Discovery Phase (Today)
- [x] Identify existing IDP commands
- [ ] Compare with Zitadel Go implementation
- [ ] Determine what's missing
- [ ] Create implementation plan

### Implementation Phase (Next)
- [ ] Implement missing IDP commands (if any)
- [ ] Create comprehensive test coverage
- [ ] Verify complete stack functionality
- [ ] Document all IDP configurations

### Completion Criteria
- [ ] All IDP commands tested (target: 25+ tests)
- [ ] 100% test pass rate
- [ ] Complete IDP lifecycle verified
- [ ] Documentation updated
- [ ] Parity increased to 83%

---

## 🚀 **NEXT ACTIONS**

### Immediate (Today - Oct 25)
1. ✅ Check existing org-level IDP commands
2. ✅ Verify org-level IDP tests (13 tests passing)
3. ⏳ Search for instance-level IDP commands
4. ⏳ Search for IDP template commands
5. ⏳ Compare with Zitadel Go codebase
6. ⏳ Determine scope of Week 13

### Short-term (Next Session)
1. Implement missing commands (if any)
2. Create test files for new commands
3. Verify integration with projections
4. Update documentation

---

## 📈 **EXPECTED IMPACT**

### If New Commands Needed
- **Commands:** 10-15 new commands
- **Tests:** 25-30 integration tests
- **Code:** ~1,500-2,000 lines
- **Parity:** 80% → 83% (+3%)
- **Timeline:** 2 weeks

### If Only Test Enhancement Needed
- **Commands:** 0 (already exist)
- **Tests:** 10-15 additional tests
- **Code:** ~500-800 lines
- **Parity:** 80% → 81% (+1%)
- **Timeline:** 3-5 days

---

## 🔍 **DISCOVERY STATUS**

**Current Findings:**
- ✅ Org-level IDP commands exist and tested (4 commands, 13 tests)
- ✅ User IDP link commands exist
- ⏳ Instance-level IDP commands - TO BE CHECKED
- ⏳ IDP template commands - TO BE CHECKED
- ⏳ Provider-specific commands - TO BE CHECKED

**Next:** Complete discovery phase to determine Week 13 scope.

---

**Last Updated:** October 25, 2025  
**Status:** Discovery Phase - In Progress  
**Decision Point:** Determine if Week 13 needs new commands or test enhancement
