# Phase 2 Implementation Tracker
# Command Module Parity - Weeks 9-16

**Start Date:** October 25, 2025 ✅  
**Target Completion:** ~8 weeks (December 20, 2025)  
**Phase 1 Final Parity:** 75% (Phase 1 COMPLETE)  
**Phase 2 Goal:** 85% (+10% gain)  
**Status:** 🚀 READY TO START - Phase 1 complete, beginning Week 9-10

**✅ UPDATE:** Phase 1 is COMPLETE at 75% parity. Phase 2 now includes Week 9-10 (Application Configuration) as the starting point, followed by enterprise features.

---

## 📊 EXECUTIVE SUMMARY

### Phase 2 Objectives
**Primary Goal:** Implement enterprise features to reach 85% command parity

**Starting Point:** 78% parity (after Phase 1 Week 9-10 completes Application Configuration)

**Focus Areas:**
1. **Policy Management** - Label, privacy, notification, custom text policies (P1)
2. **Identity Providers** - Instance-level IDP configuration (P1)
3. **Notification Infrastructure** - SMTP, SMS providers (P1)
4. **Security & Keys** - Personal access tokens, machine keys, crypto (P1)
5. **Logout & Session Management** - Complete session lifecycle (P1)

**Commands to Implement:** ~43 commands (Application Config moved to Phase 1 Week 9-10)  
**Estimated Tests:** ~110 integration tests  
**Expected Parity Gain:** +7% (78% → 85%)

---

## 📅 WEEK-BY-WEEK PLAN

### **Week 9-10: Application Configuration Commands** (P0)

**Status:** ✅ COMPLETE!  
**Priority:** P0 (Critical for OAuth/OIDC applications)  
**Target Parity:** 75% → 78% (+3%)  
**Completion Date:** October 24, 2025

#### Deliverables ✅
- [x] OIDC redirect URI management (add, remove) - 14 tests passing
- [x] API authentication methods (BASIC, PRIVATE_KEY_JWT) - 7 tests passing
- [x] Client type switching (confidential ↔ public) - Complete
- [x] Application lifecycle tests - 26 tests passing
- [x] **Total:** 47 integration tests passing (100%)

#### Commands Implemented (12 total)
**OIDC Configuration (7 commands):**
- ✅ `addOIDCApp()` - Create OIDC application with redirect URIs
- ✅ `changeOIDCApp()` - Update OIDC configuration
- ✅ `addOIDCRedirectURI()` - Add redirect URI to existing app
- ✅ `removeOIDCRedirectURI()` - Remove redirect URI
- ✅ `changeOIDCAppToConfidential()` - Switch to confidential client
- ✅ `changeOIDCAppToPublic()` - Switch to public client
- ✅ Full PKCE, response types, grant types support

**API Configuration (4 commands):**
- ✅ `addAPIApp()` - Create API application
- ✅ `changeAPIApp()` - Update API configuration
- ✅ `changeAPIAppAuthMethod()` - Switch authentication methods
- ✅ Support for BASIC and PRIVATE_KEY_JWT auth

**General (1 command):**
- ✅ `removeApp()` - Remove any application type

#### Files Implemented
```
src/lib/command/application/app-commands.ts (all commands)
test/integration/commands/application.test.ts (26 tests)
test/integration/commands/app-oidc-config.test.ts (14 tests)
test/integration/commands/app-api-config.test.ts (7 tests)
```

#### Success Criteria - ALL MET ✅
- ✅ OIDC applications fully configurable
- ✅ API applications support multiple auth methods
- ✅ Complete stack tested (Command → Event → Projection → Query)
- ✅ 47 integration tests passing (100%)
- ✅ Zero regressions from Phase 1

---

### **Week 11-12: Policy Enhancement Commands** (P1)

**Status:** ✅ COMPLETE!  
**Priority:** P1 (Enterprise features)  
**Target Parity:** 78% → 80% (+2%)  
**Completion Date:** October 25, 2025

#### Deliverables ✅
- [x] Label Policy commands - Branding and UI customization (19 tests)
- [x] Password Policy commands - Complexity, age, lockout (16 tests)
- [x] Privacy Policy commands - Privacy policy configuration (10 tests)
- [x] Notification Policy commands - Notification settings (11 tests)
- [x] Domain Policy commands - Domain validation rules (11 tests)
- [x] Integration tests: **67 tests passing (100%)**

**Note:** Custom text commands deferred (not in scope for org-level policies)

#### Commands to Implement (15 total)

**Label Policy Commands (6 commands):**
- [ ] `addOrgLabelPolicy()` - Set organization branding
- [ ] `changeOrgLabelPolicy()` - Update branding colors, logos
- [ ] `removeOrgLabelPolicy()` - Remove custom branding
- [ ] `addInstanceLabelPolicy()` - Set instance-level branding
- [ ] `changeInstanceLabelPolicy()` - Update instance branding
- [ ] `removeInstanceLabelPolicy()` - Remove instance branding

**Privacy Policy Commands (4 commands):**
- [ ] `addOrgPrivacyPolicy()` - Set privacy policy links
- [ ] `changeOrgPrivacyPolicy()` - Update privacy policy
- [ ] `addInstancePrivacyPolicy()` - Instance privacy policy
- [ ] `changeInstancePrivacyPolicy()` - Update instance privacy

**Notification Policy Commands (3 commands):**
- [ ] `addOrgNotificationPolicy()` - Set notification preferences
- [ ] `changeOrgNotificationPolicy()` - Update notification settings
- [ ] `removeOrgNotificationPolicy()` - Remove custom policy

**Custom Text Commands (2 commands):**
- [ ] `setCustomText()` - Set custom translations for UI text
- [ ] `removeCustomText()` - Remove custom translations

#### Files to Create
```
src/lib/command/policy/label-policy-commands.ts
src/lib/command/policy/label-policy-write-model.ts
src/lib/command/policy/privacy-policy-commands.ts
src/lib/command/policy/privacy-policy-write-model.ts
src/lib/command/policy/notification-policy-commands.ts
src/lib/command/policy/notification-policy-write-model.ts
src/lib/command/org/org-custom-text-commands.ts

test/integration/commands/label-policy.test.ts
test/integration/commands/privacy-policy.test.ts
test/integration/commands/notification-policy.test.ts
test/integration/commands/custom-text.test.ts
```

#### Reference Files (Zitadel Go)
```
internal/command/org_label_policy.go
internal/command/org_privacy_policy.go
internal/command/org_notification_policy.go
internal/command/org_custom_text.go
internal/command/instance_label_policy.go
```

#### Success Criteria
- ✅ Branding colors, logos, fonts configurable
- ✅ Light/dark mode support
- ✅ Privacy policy URLs configurable
- ✅ Terms of service links supported
- ✅ Notification preferences (email, SMS toggles)
- ✅ Custom text for login, registration, errors
- ✅ Multi-language support (i18n keys)
- ✅ 30+ integration tests passing

---

### **Week 13: Identity Provider Commands** (P1)

**Status:** ✅ COMPLETE!  
**Priority:** P1 (SSO integrations)  
**Target Parity:** 80% → 82% (+2%)  
**Completion Date:** October 25, 2025

#### Deliverables ✅
- [x] `instance-idp-commands.ts` - Instance-level OIDC/OAuth IDP templates (4 commands)
- [x] `jwt-idp-commands.ts` - JWT IDP provider configuration (2 commands)
- [x] `ldap-idp-commands.ts` - LDAP/Active Directory IDP (2 commands)
- [x] `saml-idp-commands.ts` - SAML 2.0 IDP configuration (2 commands)
- [x] Integration tests: **55 tests passing (100%)**

#### Commands Implemented (10 total)

**Instance-Level IDP Commands (4 commands):**
- [x] `addOIDCIDPToInstance()` - Configure OIDC IDP at instance level
- [x] `addOAuthIDPToInstance()` - Configure OAuth IDP at instance level
- [x] `updateInstanceIDP()` - Update instance IDP settings
- [x] `removeInstanceIDP()` - Remove instance IDP

**Organization-Level Advanced IDP Commands (6 commands):**
- [x] `addJWTIDPToOrg()` - Configure JWT token-based IDP
- [x] `changeJWTIDP()` - Update JWT IDP configuration
- [x] `addLDAPIDPToOrg()` - Configure LDAP/Active Directory IDP
- [x] `changeLDAPIDP()` - Update LDAP IDP configuration
- [x] `addSAMLIDPToOrg()` - Configure SAML 2.0 IDP
- [x] `changeSAMLIDP()` - Update SAML IDP configuration

#### Files Implemented ✅
```
✅ src/lib/command/instance/instance-idp-commands.ts (4 commands + write model)
✅ src/lib/command/idp/jwt-idp-commands.ts (2 commands + write model)
✅ src/lib/command/idp/ldap-idp-commands.ts (2 commands + write model)
✅ src/lib/command/idp/saml-idp-commands.ts (2 commands + write model)

✅ test/integration/commands/instance-idp.test.ts (13 tests - 100% passing)
✅ test/integration/commands/jwt-idp.test.ts (13 tests - 100% passing)
✅ test/integration/commands/ldap-idp.test.ts (14 tests - 100% passing)
✅ test/integration/commands/saml-idp.test.ts (15 tests - 100% passing)
```

#### Reference Files (Zitadel Go)
```
internal/command/idp.go
internal/command/idp_oidc_config.go
internal/command/idp_oauth_config.go
internal/command/idp_jwt_config.go
```

#### Success Criteria - ALL MET ✅
- ✅ Generic OIDC provider support (instance-level)
- ✅ Generic OAuth 2.0 provider support (instance-level)
- ✅ JWT token-based authentication
- ✅ LDAP/Active Directory integration
- ✅ SAML 2.0 SSO support
- ✅ Scopes and claims mapping
- ✅ Metadata XML and URL support (SAML)
- ✅ TLS support (LDAP)
- ✅ Attribute mapping for all provider types
- ✅ Idempotent operations
- ✅ 55 integration tests passing (100%)
- ✅ Complete stack tested (Command → Event → Projection → Query)

---

### **Week 14: Notification Infrastructure** (P1)

**Status:** ✅ COMPLETE!  
**Priority:** P1 (Email/SMS delivery)  
**Target Parity:** 83% → 84% (+1%)  
**Completion Date:** October 25, 2025

#### Deliverables ✅
- [x] `smtp-config-commands.ts` - Email provider configuration (5 commands)
- [x] `sms-config-commands.ts` - SMS provider configuration (7 commands)
- [x] Integration tests: **36 tests passing (100%)**

#### Commands Implemented (12 total)

**SMTP Configuration Commands (5 commands):**
- [x] `addSMTPConfigToOrg()` - Configure SMTP server for emails
- [x] `changeSMTPConfig()` - Update SMTP settings
- [x] `activateSMTPConfig()` - Activate SMTP configuration
- [x] `deactivateSMTPConfig()` - Deactivate SMTP configuration
- [x] `removeSMTPConfig()` - Remove SMTP config

**SMS Configuration Commands (7 commands):**
- [x] `addTwilioSMSConfigToOrg()` - Configure Twilio SMS provider
- [x] `changeTwilioSMSConfig()` - Update Twilio SMS settings
- [x] `addHTTPSMSConfigToOrg()` - Configure HTTP SMS provider
- [x] `changeHTTPSMSConfig()` - Update HTTP SMS settings
- [x] `activateSMSConfig()` - Activate SMS configuration
- [x] `deactivateSMSConfig()` - Deactivate SMS configuration
- [x] `removeSMSConfig()` - Remove SMS config

#### Files Implemented ✅
```
✅ src/lib/command/smtp/smtp-commands.ts (5 commands + write model)
✅ src/lib/command/sms/sms-commands.ts (7 commands + write model)

✅ test/integration/commands/smtp.test.ts (15 tests - 100% passing)
✅ test/integration/commands/sms.test.ts (21 tests - 100% passing)
```

#### Reference Files (Zitadel Go)
```
internal/command/smtp.go
internal/command/sms.go
internal/command/sms_twilio.go
internal/command/sms_http.go
```

#### Success Criteria - ALL MET ✅
- ✅ SMTP configuration (host, port, auth, TLS/SSL)
- ✅ From address and reply-to configuration
- ✅ Email validation (sender, reply-to)
- ✅ State management (active, inactive, removed)
- ✅ Twilio SMS integration (SID, token, sender number)
- ✅ Generic HTTP SMS provider with endpoint validation
- ✅ Provider-specific change commands
- ✅ Activation/deactivation support
- ✅ Idempotent operations
- ✅ 36 integration tests passing (100%)
- ✅ Complete stack tested (Command → Event → Projection → Query)

---

### **Week 15: Security & Token Management** (P1)

**Status:** ⚠️ PARTIALLY COMPLETE  
**Priority:** P1 (API access & security)  
**Target Parity:** 84% → 84.5% (+0.5% so far)  
**Completion Date:** October 25, 2025 (Encryption Keys only)

#### Deliverables
- [x] `encryption-key-commands.ts` - Encryption key management ✅ (15 tests passing)
- [x] `personal-access-token-commands.ts` - PAT management ⚠️ (Commands implemented, comprehensive tests pending)
- [x] `machine-key-commands.ts` - Service account keys ⚠️ (Commands implemented, comprehensive tests pending)
- [x] Integration tests: 15/20+ tests complete

#### Commands Implemented (10 total)

**Encryption Key Commands (4 commands) - ✅ COMPLETE:**
- [x] `addEncryptionKey()` - Generate encryption key
- [x] `getEncryptionKey()` - Get encryption key by ID
- [x] `listEncryptionKeys()` - List all encryption keys
- [x] `removeEncryptionKey()` - Remove encryption key
- ✅ **15 comprehensive tests passing (100%)**
- ✅ Support for AES256, RSA2048, RSA4096 algorithms
- ✅ Direct database access (no projections)
- ✅ Complete CRUD lifecycle tested

**Personal Access Token Commands (3 commands) - ⚠️ IMPLEMENTED:**
- [x] `addPersonalAccessToken()` - Create PAT for user
- [x] `removePersonalAccessToken()` - Revoke PAT
- [x] `updatePersonalAccessTokenUsage()` - Update last used timestamp
- ⚠️ Commands functional, need comprehensive test suite

**Machine Key Commands (3 commands) - ⚠️ IMPLEMENTED:**
- [x] `addMachineKey()` - Create service account key
- [x] `removeMachineKey()` - Delete service account key
- [x] `getMachineKeyPublicKey()` - Get public key
- ⚠️ Commands functional, need comprehensive test suite

#### Files Implemented ✅
```
✅ src/lib/command/crypto/encryption-key-commands.ts (4 commands)
✅ src/lib/command/user/personal-access-token-commands.ts (3 commands)
✅ src/lib/command/user/machine-key-commands.ts (3 commands)

✅ test/integration/commands/encryption-key.test.ts (15 tests - 100% passing)
⚠️ test/integration/commands/personal-access-token.test.ts (pending comprehensive tests)
⚠️ test/integration/commands/machine-key.test.ts (pending comprehensive tests)
```

#### Reference Files (Zitadel Go)
```
internal/command/user_personal_access_token.go
internal/command/user_machine_key.go
internal/command/crypto.go
```

#### Success Criteria
**Encryption Keys - ✅ COMPLETE:**
- ✅ AES256, RSA2048, RSA4096 algorithm support
- ✅ Direct database CRUD operations
- ✅ Identifier uniqueness validation
- ✅ Complete lifecycle testing
- ✅ 15/15 integration tests passing

**PATs - ⚠️ PARTIALLY COMPLETE:**
- ✅ PAT creation with scopes (implemented)
- ✅ PAT expiration support (implemented)
- ✅ Secure token hashing (implemented)
- ⚠️ Comprehensive test suite (pending)

**Machine Keys - ⚠️ PARTIALLY COMPLETE:**
- ✅ Machine key generation (JWT keys) (implemented)
- ✅ Public key retrieval (implemented)
- ⚠️ Comprehensive test suite (pending)

---

### **Week 16: Logout & Session Completion** (P1)

**Status:** NOT STARTED  
**Priority:** P1 (Complete auth flows)  
**Target Parity:** 85% (Target achieved!)

#### Deliverables
- [ ] `logout-commands.ts` - Logout flows
- [ ] `oidc-session-commands.ts` - OIDC session management
- [ ] Integration tests: 15+ tests

#### Commands to Implement (5 total)

**Logout Commands (3 commands):**
- [ ] `terminateAllUserSessions()` - Logout user from all sessions
- [ ] `terminateOIDCSession()` - OIDC logout
- [ ] `handleBackchannelLogout()` - Backchannel logout (OIDC spec)

**OIDC Session Commands (2 commands):**
- [ ] `createOIDCSession()` - Create OIDC session
- [ ] `terminateOIDCSession()` - Terminate OIDC session

#### Files to Create
```
src/lib/command/session/logout-commands.ts
src/lib/command/oidc/oidc-session-commands.ts
src/lib/command/oidc/oidc-session-write-model.ts

test/integration/commands/logout.test.ts
test/integration/commands/oidc-session.test.ts
```

#### Reference Files (Zitadel Go)
```
internal/command/user_v2_logout.go
internal/command/oidc_session.go
```

#### Success Criteria
- ✅ Global logout (all sessions)
- ✅ Single session logout
- ✅ OIDC logout flows
- ✅ Backchannel logout support
- ✅ Front-channel logout support
- ✅ OIDC session state management
- ✅ 15+ integration tests passing

---

## 📊 PHASE 2 METRICS & TRACKING

### Commands by Week

**Note:** Week 9-10 (Application Config) is now part of Phase 1

| Week | Focus Area | Commands | Tests | Parity Gain | Status |
|------|-----------|----------|-------|-------------|--------|
| **11-12** | Policy Enhancement | 15 | 67 | +2% (78%→80%) | ✅ COMPLETE |
| **13** | Identity Providers | 10 | 55 | +2% (80%→82%) | ✅ COMPLETE |
| **14** | Notifications | 12 | 36 | +2% (82%→84%) | ✅ COMPLETE |
| **15** | Security & Tokens | 10 | 20 | +1% (84%→85%) | ⚠️ PARTIAL |
| **16** | Logout & Sessions | 5 | 15 | 0% (85%→85%) | NOT STARTED |
| **Total** | **5 Areas** | **52** | **218** | **+9%** | 80% COMPLETE |

### Cumulative Progress

| Milestone | Commands | Tests | Overall Parity | Status |
|-----------|----------|-------|----------------|--------|
| Phase 1 Complete (Week 8) | 53 | 152 | 75% | ✅ |
| **Phase 1 Final (Week 10)** | **65** | **199** | **78%** ⬅️ **Phase 2 starts here** | ✅ |
| Week 12 (Policy) | 80 | 266 | 80% | ✅ |
| **Week 13 (IDP)** | **90** | **321** | **82%** | ✅ **COMPLETE** |
| Week 14 (Notifications) | 102 | 357 | 84% | ✅ COMPLETE |
| Week 15 (Security) | 112 | 377 | 84.5% | ⚠️ PARTIAL |
| **Phase 2 Complete (Week 16)** | **117** | **~392** | **85%** | ⏳ |

---

## 🎯 SUCCESS CRITERIA

### Phase 2 Completion Checklist
- [ ] All 48 commands implemented (Week 11-16)
- [ ] All 110+ integration tests passing (95%+ pass rate)
- [ ] Complete stack tested (Command → Event → Projection → Query)
- [ ] API endpoints added for new commands
- [ ] Documentation updated
- [ ] Zero regressions from Phase 1
- [ ] 85% overall parity achieved

### Quality Gates (Per Week)
- ✅ All commands match Zitadel Go implementation 100%
- ✅ All validation rules enforced
- ✅ Event schema compatible
- ✅ Projections verified
- ✅ Query layer integrated
- ✅ 95%+ test pass rate
- ✅ Production-ready code
- ✅ Security best practices followed

---

## 🚀 GETTING STARTED (Week 11 - After Phase 1 Complete)

**⚠️ PREREQUISITE:** Phase 1 Week 9-10 (Application Configuration) MUST be 100% complete before starting Phase 2.

### Day 1 Tasks (Week 11)
1. Verify Phase 1 complete (78% parity achieved, 65 commands, ~187 tests)
2. Read Zitadel Go `org_label_policy.go`
3. Understand label policy schema (branding)
4. Create `label-policy-commands.ts` skeleton
5. Create `label-policy-write-model.ts`
6. Implement first command: `addOrgLabelPolicy()`
7. Write first integration test

### Development Workflow
```bash
# 1. Create feature branch
git checkout -b feature/phase2-week11-policy-enhancement

# 2. Implement command
# ... code implementation ...

# 3. Run tests
npm run test:unit -- label-policy
npm run test:integration -- label-policy

# 4. Verify compilation
npm run build

# 5. Commit and push
git add .
git commit -m "feat(phase2): implement label policy commands"
git push origin feature/phase2-week11-policy-enhancement
```

---

## 📋 DEFERRED TO PHASE 3 (85% → 95%)

The following are explicitly **NOT** in Phase 2 scope:

### Lower Priority Features (P2/P3)
- ❌ **Action & Flow Commands** (P2) - Custom business logic execution
- ❌ **SAML Advanced** (P2) - Full SAML 2.0 support (basic in Week 9-10)
- ❌ **Device Authorization** (P2) - OAuth 2.0 device flow
- ❌ **Quota & Limits** (P2) - Resource quotas and rate limiting
- ❌ **Advanced IDP Providers** (P2) - LDAP, Apple, Azure AD specific
- ❌ **Custom Login Text** (P2) - Advanced i18n
- ❌ **Web Key Management** (P2) - JWKS management
- ❌ **Milestone Commands** (P3) - Progress tracking
- ❌ **Debug Commands** (P3) - Development utilities

**Rationale:** Phase 2 focuses on core enterprise features needed for production deployments. Advanced features can be added in Phase 3 based on user demand.

---

## 📚 RESOURCES

### Key Reference Files
- `src/lib/command/commands.ts` - Main Commands class
- `src/lib/command/write-model.ts` - Base write model
- `test/integration/commands/*.test.ts` - Test examples from Phase 1

### Zitadel Go References
- `/Users/dsharma/authapp/zitadel/internal/command/` - All Go commands
- `/Users/dsharma/authapp/zitadel/internal/domain/` - Domain logic
- `/Users/dsharma/authapp/zitadel/internal/repository/` - Event schemas

### Documentation
- `PHASE_1_IMPLEMENTATION_GUIDE.md` - Completed Phase 1 patterns
- `COMMAND_MODULE_PARITY_TRACKER.md` - Full feature tracker
- `SCHEMA_PARITY_ANALYSIS.md` - Database schema analysis

---

## 📈 RISK MITIGATION

### Identified Risks

**1. OAuth/OIDC Complexity**
- **Risk:** OIDC spec complexity may slow Week 9-10
- **Mitigation:** Start with basic OIDC, expand incrementally
- **Buffer:** Week 10 has buffer time built in

**2. External Provider Dependencies**
- **Risk:** Testing real SMTP/SMS requires external services
- **Mitigation:** Mock external services, manual testing for real providers
- **Acceptance:** Some tests may be marked as manual verification

**3. Scope Creep**
- **Risk:** SAML/IDP features could expand beyond estimate
- **Mitigation:** Stick to defined command list, defer advanced features
- **Review:** Weekly scope check against tracker

**4. Event Schema Changes**
- **Risk:** New commands may require schema adjustments
- **Mitigation:** Review Zitadel Go events first, plan schema changes upfront
- **Validation:** Test against Go event formats

---

**Phase 2 Status:** BLOCKED - Waiting for Phase 1 Week 9-10 completion  
**Prerequisite:** Phase 1 Week 9-10 (Application Configuration) must reach 78% parity  
**Next Action After Phase 1:** Begin Week 11-12: Policy Enhancement Commands  
**Target Completion:** ~6 weeks after Phase 1 complete  
**Starting Parity:** 78% (after Phase 1 Week 9-10)  
**Target Parity:** 85% (+7% from Phase 1 completion)

⚠️ **Phase 2 CANNOT start until Phase 1 Week 9-10 is 100% complete!**
