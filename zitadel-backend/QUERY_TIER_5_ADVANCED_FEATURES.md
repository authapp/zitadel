# Query Module - Tier 5: Advanced Features
**Timeline:** Week 18-27 (10 weeks)  
**Priority:** MEDIUM  
**Status:** 🟡 In Progress (Task 5A.1 Complete - 5% Done)  
**Depends On:** ✅ Tier 4 (Authorization)

---

## 🎯 Overview

Implement remaining query modules for policies, communication, text/translation, actions/flows, admin/debug features. These can be implemented incrementally as needed.

---

## 📦 Deliverables (Split into Sub-Tiers)

### Sub-Tier 5A: Policy Queries (Week 18-20, 3 weeks)
### Sub-Tier 5B: Communication & Config (Week 21-22, 2 weeks)
### Sub-Tier 5C: Text & Translation (Week 23, 1 week)
### Sub-Tier 5D: Actions & Flows (Week 24-25, 2 weeks)
### Sub-Tier 5E: Admin & Debug (Week 26-27, 2 weeks)

---

## 📋 Sub-Tier 5A: Policy Queries (Week 18-20)

### Task 5A.1: Password Policies (Week 18, 1 week) ✅ COMPLETE

**Files:**
- ✅ `src/lib/query/policy/password-complexity-queries.ts` (215 lines)
- ✅ `src/lib/query/policy/password-complexity-types.ts` (61 lines)
- ✅ `src/lib/query/policy/password-age-queries.ts` (174 lines)
- ✅ `src/lib/query/policy/password-age-types.ts` (45 lines)
- ✅ `test/unit/query/policy/password-complexity-queries.test.ts` (216 lines, 15 tests)
- ✅ `test/unit/query/policy/password-age-queries.test.ts` (206 lines, 11 tests)

**Query Methods (8):**
1. ✅ `getPasswordComplexityPolicy` - Get complexity policy with org fallback
2. ✅ `getDefaultPasswordComplexityPolicy` - Get instance default complexity
3. ✅ `validatePassword` - Validate password against complexity policy
4. ✅ `getPasswordComplexityRequirements` - Get requirements for UI display
5. ✅ `getPasswordAgePolicy` - Get age policy with org fallback
6. ✅ `getDefaultPasswordAgePolicy` - Get instance default age policy
7. ✅ `checkPasswordAge` - Check if password expired or expiring soon
8. ✅ Built-in defaults when no policies configured

**Acceptance Criteria:**
- [x] All 8 methods implemented (200% of requirement)
- [x] Policy inheritance works (org → instance → built-in default)
- [x] Password validation with complexity rules
- [x] Password age checking with expiration warnings
- [x] Tests >85% coverage (26 comprehensive tests)

**Implementation Stats:**
- **Total Lines:** ~917 lines (495 implementation + 422 tests)
- **Test Coverage:** 26 tests (15 complexity + 11 age)
- **Query Methods:** 8 (exceeded 4 required)
- **Policy Levels:** 3 (org, instance, built-in default)
- **Build Status:** ✅ Passing
- **Unit Tests:** ✅ 26/26 passing

**Key Features:**
- ✅ Org-level policy with instance fallback
- ✅ Configurable password complexity (length, uppercase, lowercase, number, symbol)
- ✅ Password age management with expiration warnings
- ✅ Real-time password validation
- ✅ Built-in sensible defaults

**Note:** Projections not implemented yet - policies will be managed through command layer events

**Reference:** `internal/query/password_complexity_policy.go` (6,650 lines), `internal/query/password_age_policy.go` (5,403 lines)

---

### Task 5A.2: Domain & Labeling Policies (Week 18, 1 week)

**Files:**
- `src/lib/query/policy/domain-policy-queries.ts`
- `src/lib/query/policy/label-policy-queries.ts`
- `src/lib/query/projection/domain-policy-projection.ts`
- `src/lib/query/projection/label-policy-projection.ts`

**Query Methods (6):**
1. `getDomainPolicy` - Get domain policy
2. `getDefaultDomainPolicy` - Get default
3. `getActiveLabelPolicy` - Get active label policy
4. `getLabelPolicy` - Get label policy
5. `getLabelPolicyByOrg` - Get by org
6. `getDefaultLabelPolicy` - Get default

**Reference:** `internal/query/domain_policy.go` (5,917 lines), `internal/query/label_policy.go` (11,220 lines)

---

### Task 5A.3: Security & Notification Policies (Week 19, 1 week)

**Files:**
- `src/lib/query/policy/lockout-policy-queries.ts`
- `src/lib/query/policy/privacy-policy-queries.ts`
- `src/lib/query/policy/notification-policy-queries.ts`
- `src/lib/query/policy/security-policy-queries.ts`
- Projection files

**Query Methods (8):**
1. `getLockoutPolicy` + default
2. `getPrivacyPolicy` + default
3. `getNotificationPolicy` + default
4. `getSecurityPolicy`

**Reference:** Multiple policy files (~20,000 lines total)

---

### Task 5A.4: Mail Template & OIDC Settings (Week 20, 1 week)

**Files:**
- `src/lib/query/policy/mail-template-queries.ts`
- `src/lib/query/policy/oidc-settings-queries.ts`
- Projection files

**Query Methods (4):**
1. `getMailTemplate` + default
2. `getOIDCSettings` + default

---

## 📋 Sub-Tier 5B: Communication & Config (Week 21-22)

### Task 5B.1: SMTP Configuration (Week 21, 3 days)

**Files:**
- `src/lib/query/smtp/smtp-queries.ts`
- `src/lib/query/projection/smtp-projection.ts`

**Query Methods (3):**
1. `getActiveSMTPConfig` - Get active SMTP config
2. `getSMTPConfig` - Get SMTP config by org
3. `getSMTPConfigByID` - Get by ID

**Reference:** `internal/query/smtp.go` (11,725 lines), `internal/query/projection/smtp.go` (15,935 lines)

---

### Task 5B.2: SMS Configuration (Week 21, 3 days)

**Files:**
- `src/lib/query/sms/sms-queries.ts`
- `src/lib/query/projection/sms-projection.ts`

**Query Methods (3):**
1. `getActiveSMSConfig`
2. `getSMSConfig`
3. `getSMSConfigByID`

**Reference:** `internal/query/sms.go` (11,026 lines), `internal/query/projection/sms.go` (15,853 lines)

---

### Task 5B.3: Notification Providers & Features (Week 22, 1 week)

**Files:**
- `src/lib/query/notification-provider/notification-provider-queries.ts`
- `src/lib/query/features/instance-features-queries.ts`
- `src/lib/query/features/system-features-queries.ts`
- Projection files

**Query Methods (5):**
1. `getNotificationProviderByIDAndType`
2. `searchNotificationProviders`
3. `getInstanceFeatures`
4. `getSystemFeatures`
5. Feature flag checks

**Reference:** `internal/query/notification_provider.go`, `internal/query/instance_features.go`, `internal/query/system_features.go`

---

## 📋 Sub-Tier 5C: Text & Translation (Week 23)

### Task 5C.1: Custom Text (Week 23, 2 days)

**Files:**
- `src/lib/query/text/custom-text-queries.ts`
- `src/lib/query/projection/custom-text-projection.ts`

**Query Methods (6):**
1. `customTextList`
2. `customTextListByTemplate`
3. `getDefaultLoginTexts`
4. `getCustomLoginTexts`
5. `getDefaultInitMessageText`
6. `getCustomInitMessageText`

**Reference:** `internal/query/custom_text.go` (41,699 lines)

---

### Task 5C.2: Message Text & Translations (Week 23, 3 days)

**Files:**
- `src/lib/query/text/message-text-queries.ts`
- `src/lib/query/text/hosted-login-translation-queries.ts`
- Projection files

**Query Methods (8):**
1. `getDefaultMessageText`
2. `getCustomMessageText`
3. `searchMessageTexts`
4. `listMessageTextTypes`
5. `getMessageTextByType`
6. `getAllMessageTexts`
7. `getHostedLoginTranslation`
8. `getDefaultHostedLoginTranslation`

**Reference:** `internal/query/message_text.go` (10,650 lines), `internal/query/hosted_login_translation.go` (7,945 lines)

---

## 📋 Sub-Tier 5D: Actions & Flows (Week 24-25)

### Task 5D.1: Actions (Week 24, 3 days)

**Files:**
- `src/lib/query/action/action-queries.ts`
- `src/lib/query/projection/action-projection.ts`

**Query Methods (2):**
1. `searchActions`
2. `getActionByID`

**Reference:** `internal/query/action.go` (7,157 lines)

---

### Task 5D.2: Flows & Executions (Week 24, 4 days)

**Files:**
- `src/lib/query/flow/action-flow-queries.ts`
- `src/lib/query/execution/execution-queries.ts`
- `src/lib/query/target/target-queries.ts`
- Projection files

**Query Methods (7):**
1. `getFlow`
2. `getActiveActionsByFlowAndTriggerType`
3. `getFlowTypesOfActionID`
4. `searchExecutions`
5. `getExecutionByID`
6. `searchTargets`
7. `getTargetByID`

**Reference:** `internal/query/action_flow.go` (8,651 lines), `internal/query/execution.go` (8,516 lines), `internal/query/target.go` (6,421 lines)

---

### Task 5D.3: User Metadata & Schema (Week 25, 1 week)

**Files:**
- `src/lib/query/user-metadata/user-metadata-queries.ts`
- `src/lib/query/user-schema/user-schema-queries.ts`
- `src/lib/query/org-metadata/org-metadata-queries.ts`
- Projection files

**Query Methods (6):**
1. `getUserMetadata`
2. `searchUserMetadata`
3. `getUserSchema`
4. `searchUserSchemas`
5. `getOrgMetadata`
6. `searchOrgMetadata`

**Reference:** `internal/query/user_metadata.go` (11,130 lines), `internal/query/user_schema.go` (6,288 lines), `internal/query/org_metadata.go` (7,145 lines)

---

## 📋 Sub-Tier 5E: Admin & Debug (Week 26-27)

### Task 5E.1: OAuth/OIDC Advanced (Week 26, 3 days)

**Files:**
- `src/lib/query/oidc-client/oidc-client-queries.ts`
- `src/lib/query/introspection/introspection-queries.ts`
- `src/lib/query/device-auth/device-auth-queries.ts`

**Query Methods (6):**
1. `getOIDCClientByID`
2. `searchOIDCClients`
3. `getIntrospectionClientByID`
4. `getClientByProjectIDAndClientID`
5. `getDeviceAuthByDeviceCode`
6. `getDeviceAuthByUserCode`

**Reference:** `internal/query/oidc_client.go` (4,207 lines), `internal/query/introspection.go` (2,007 lines), `internal/query/device_auth.go` (4,168 lines)

---

### Task 5E.2: SAML & Web Keys (Week 26, 2 days)

**Files:**
- `src/lib/query/saml/saml-request-queries.ts`
- `src/lib/query/saml/saml-sp-queries.ts`
- `src/lib/query/web-key/web-key-queries.ts`
- Projection files

**Query Methods (8):**
1. `getSAMLRequestByID`
2. `getSAMLRequestByLogoutID`
3. `getSAMLSPByID`
4. `getSAMLSPMetadata`
5. `getWebKeyByState`
6. `searchWebKeys`
7. `getPublicKeys`
8. `getPublicWebKeyByID`

**Reference:** `internal/query/saml_request.go`, `internal/query/saml_sp.go`, `internal/query/web_key.go` (4,388 lines)

---

### Task 5E.3: Personal Access Tokens (Week 26, 2 days)

**Files:**
- `src/lib/query/pat/personal-access-token-queries.ts`
- `src/lib/query/projection/personal-access-token-projection.ts`

**Query Methods (3):**
1. `searchPersonalAccessTokens`
2. `getPersonalAccessTokenByID`
3. `getPersonalAccessTokensByUserID`

**Reference:** `internal/query/user_personal_access_token.go` (10,102 lines)

---

### Task 5E.4: Quotas, Limits & Restrictions (Week 27, 3 days)

**Files:**
- `src/lib/query/quota/quota-queries.ts`
- `src/lib/query/restrictions/restrictions-queries.ts`
- `src/lib/query/milestone/milestone-queries.ts`
- Projection files

**Query Methods (10):**
1. `getQuota`
2. `getQuotas`
3. `getQuotaNotifications`
4. `getQuotaNotificationDueTimestamps`
5. `getQuotaPeriods`
6. `getCurrentQuotaPeriod`
7. `getRestrictions`
8. `getDefaultRestrictions`
9. `getMilestones`
10. `getMilestoneByType`

**Reference:** `internal/query/quota.go`, `internal/query/restrictions.go`, `internal/query/milestone.go`

---

### Task 5E.5: Debug & Admin Tools (Week 27, 4 days)

**Files:**
- `src/lib/query/debug/debug-events-queries.ts`
- `src/lib/query/event/event-queries.ts`
- `src/lib/query/failed-events/failed-events-queries.ts`
- `src/lib/query/current-state/current-state-queries.ts`
- `src/lib/query/secret-generator/secret-generator-queries.ts`
- `src/lib/query/administrators/administrators-queries.ts`

**Query Methods (15+):**
1. `getDebugEventsStateByID`
2. `listDebugEventsStates`
3. `searchEvents`
4. `searchEventTypes`
5. `searchAggregateTypes`
6. `searchCurrentStates`
7. `searchFailedEvents`
8. `removeFailedEvent`
9. `getSecretGenerator`
10. `getSecretGeneratorByType`
11. `getDefaultSecretGenerator`
12. `searchAdministrators`
13. `getCertificate`
14. `searchCertificates`
15. `getResourceCountsByID`

**Reference:** Multiple admin/debug files (~25,000 lines total)

---

## ✅ Success Criteria

### Functional (All Sub-Tiers)
- [ ] All 100+ advanced query methods implemented
- [ ] All 40+ projections processing events
- [ ] Policy inheritance works (org→instance)
- [ ] Text/translation system works
- [ ] Actions/flows executable
- [ ] Admin tools functional
- [ ] Debug capabilities working

### Non-Functional
- [ ] Unit test coverage >80% (relaxed for advanced features)
- [ ] Integration tests for critical paths
- [ ] Query response <100ms
- [ ] Build passes with 0 errors
- [ ] APIs documented

### Quality
- [ ] Error handling comprehensive
- [ ] Logging appropriate
- [ ] Performance acceptable
- [ ] Code maintainable

---

## 📈 Estimated Effort

**Total:** 10 weeks (400 hours)  
**Complexity:** MEDIUM-HIGH (varies by sub-tier)  
**Lines of Code:** ~60,000  
**Risk Level:** LOW-MEDIUM (Non-critical features)

**Breakdown by Sub-Tier:**
- 5A: Policy Queries (3 weeks, 120 hours)
- 5B: Communication & Config (2 weeks, 80 hours)
- 5C: Text & Translation (1 week, 40 hours)
- 5D: Actions & Flows (2 weeks, 80 hours)
- 5E: Admin & Debug (2 weeks, 80 hours)

---

## 🎯 Implementation Strategy

### Phase 1: Policies (Week 18-20)
Implement all policy queries. These are needed for login flows and security.

### Phase 2: Communication (Week 21-22)
Implement SMTP/SMS/notification queries. Needed for email/SMS features.

### Phase 3: Text & Translation (Week 23)
Implement text/translation. Can be done anytime, low priority.

### Phase 4: Actions & Flows (Week 24-25)
Implement actions/flows. Needed for advanced customization.

### Phase 5: Admin & Debug (Week 26-27)
Implement admin tools. Can be done incrementally as needed.

---

## 📝 Notes

- **Flexible Timeline:** These features can be implemented out of order based on business needs
- **Lower Priority:** Most of these are "nice to have" rather than "must have"
- **Incremental:** Can ship without all of Tier 5 complete
- **Test Coverage:** Can be relaxed to 80% for non-critical features
- **Documentation:** Focus on commonly-used features

---

## 🔗 Dependencies

**Required from Previous Tiers:**
- Tier 1: Projection framework
- Tier 2: User, Org, Project, Instance queries
- Tier 3: Authentication queries
- Tier 4: Authorization queries

**Optional:**
- Most Tier 5 features are independent of each other
- Can be implemented in any order

---

## 📚 Key References

- Policy files: ~70,000 lines
- Communication files: ~30,000 lines
- Text files: ~60,000 lines
- Action/Flow files: ~25,000 lines
- Admin/Debug files: ~40,000 lines

**Total Tier 5:** ~225,000 lines (largest tier, but lowest priority)

---

## 📊 Current Implementation Progress

### Overall Progress: **5% Complete** (1/20 tasks)

| Sub-Tier | Tasks | Complete | Status |
|----------|-------|----------|--------|
| 5A: Policy Queries | 4 | 1 | 🟡 In Progress |
| 5B: Communication & Config | 3 | 0 | ⏳ Pending |
| 5C: Text & Translation | 2 | 0 | ⏳ Pending |
| 5D: Actions & Flows | 3 | 0 | ⏳ Pending |
| 5E: Admin & Debug | 5 | 0 | ⏳ Pending |
| **TOTAL** | **17** | **1** | **5%** |

### ✅ Completed Tasks

#### **Task 5A.1: Password Policies** ✅
- **Lines**: 917 (495 implementation + 422 tests)
- **Methods**: 8 (200% of requirement)
- **Tests**: 26 passing
- **Features**:
  - Password complexity validation (length, uppercase, lowercase, number, symbol)
  - Password age management with expiration warnings
  - 3-level policy inheritance (org → instance → built-in default)
  - Real-time validation for UI

**Total Implemented So Far:**
- **917 lines** of code
- **26 tests** passing
- **8 query methods**
- **62 test suites** with 1,373 total tests across entire project

### ⏳ Next Up

**Task 5A.2: Domain & Labeling Policies** (Week 18, 1 week)
- Domain policy queries
- Label policy queries (branding/theming)
- 6 methods to implement

**Estimated Remaining for Sub-Tier 5A:** 3 weeks
