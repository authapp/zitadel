# Phase 2 Implementation Tracker
# Command Module Parity - Weeks 11-16

**Start Date:** TBD (After Phase 1 Week 9-10 Complete)  
**Target Completion:** ~6 weeks from start  
**Phase 1 Final Parity:** 78% (after Week 9-10)  
**Phase 2 Goal:** 85% (+7% gain)  
**Status:** BLOCKED - Waiting for Phase 1 Week 9-10 completion

**⚠️ IMPORTANT:** This Phase 2 plan CANNOT start until Phase 1 Week 9-10 (Application Configuration) is 100% complete. Week 9-10 is P0 and part of Phase 1.

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

**⚠️ NOTE:** Week 9-10 (Application Configuration) has been moved to Phase 1. Phase 2 now starts with Week 11.

### **Week 11-12: Policy Enhancement Commands** (P1)

**Status:** NOT STARTED  
**Priority:** P1 (Enterprise features)  
**Target Parity:** 78% → 81% (+3%)

#### Deliverables
- [ ] `label-policy-commands.ts` - Branding and UI customization
- [ ] `privacy-policy-commands.ts` - Privacy policy configuration
- [ ] `notification-policy-commands.ts` - Notification settings
- [ ] `custom-text-commands.ts` - i18n customization
- [ ] Integration tests: 30+ tests

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

**Status:** NOT STARTED  
**Priority:** P1 (SSO integrations)  
**Target Parity:** 81% → 83% (+2%)

#### Deliverables
- [ ] `idp-template-commands.ts` - Instance-level IDP templates
- [ ] `idp-oidc-commands.ts` - OIDC provider configuration
- [ ] `idp-oauth-commands.ts` - OAuth provider configuration
- [ ] Integration tests: 25+ tests

#### Commands to Implement (10 total)

**IDP Template Commands (4 commands):**
- [ ] `addIDPTemplate()` - Create IDP template for instance
- [ ] `changeIDPTemplate()` - Update IDP template
- [ ] `removeIDPTemplate()` - Remove IDP template
- [ ] `activateIDPTemplate()` - Activate IDP for use

**OIDC Provider Commands (3 commands):**
- [ ] `addOIDCProvider()` - Configure OIDC provider (Google, Azure AD, etc.)
- [ ] `updateOIDCProvider()` - Update OIDC settings
- [ ] `removeOIDCProvider()` - Remove OIDC provider

**OAuth Provider Commands (3 commands):**
- [ ] `addOAuthProvider()` - Configure OAuth 2.0 provider (GitHub, GitLab, etc.)
- [ ] `updateOAuthProvider()` - Update OAuth settings
- [ ] `removeOAuthProvider()` - Remove OAuth provider

#### Files to Create
```
src/lib/command/idp/idp-template-commands.ts
src/lib/command/idp/idp-template-write-model.ts
src/lib/command/idp/idp-oidc-commands.ts
src/lib/command/idp/idp-oauth-commands.ts

test/integration/commands/idp-template.test.ts
test/integration/commands/idp-oidc.test.ts
test/integration/commands/idp-oauth.test.ts
```

#### Reference Files (Zitadel Go)
```
internal/command/idp.go
internal/command/idp_oidc_config.go
internal/command/idp_oauth_config.go
internal/command/idp_jwt_config.go
```

#### Success Criteria
- ✅ Generic OIDC provider support
- ✅ Generic OAuth 2.0 provider support
- ✅ Provider-specific configs (Google, GitHub, Azure AD)
- ✅ Scopes and claims mapping
- ✅ IDP templates for reusable configs
- ✅ Activation/deactivation logic
- ✅ 25+ integration tests passing

---

### **Week 14: Notification Infrastructure** (P1)

**Status:** NOT STARTED  
**Priority:** P1 (Email/SMS delivery)  
**Target Parity:** 83% → 84% (+1%)

#### Deliverables
- [ ] `smtp-config-commands.ts` - Email provider configuration
- [ ] `sms-config-commands.ts` - SMS provider configuration
- [ ] Integration tests: 20+ tests

#### Commands to Implement (8 total)

**SMTP Configuration Commands (4 commands):**
- [ ] `addSMTPConfig()` - Configure SMTP server for emails
- [ ] `changeSMTPConfig()` - Update SMTP settings
- [ ] `testSMTPConfig()` - Test email delivery
- [ ] `removeSMTPConfig()` - Remove SMTP config

**SMS Configuration Commands (4 commands):**
- [ ] `addSMSProvider()` - Configure SMS provider (Twilio, HTTP)
- [ ] `changeSMSProvider()` - Update SMS settings
- [ ] `testSMSProvider()` - Test SMS delivery
- [ ] `removeSMSProvider()` - Remove SMS provider

#### Files to Create
```
src/lib/command/notification/smtp-config-commands.ts
src/lib/command/notification/smtp-config-write-model.ts
src/lib/command/notification/sms-config-commands.ts
src/lib/command/notification/sms-config-write-model.ts

test/integration/commands/smtp-config.test.ts
test/integration/commands/sms-config.test.ts
```

#### Reference Files (Zitadel Go)
```
internal/command/smtp.go
internal/command/sms.go
internal/command/sms_twilio.go
internal/command/sms_http.go
```

#### Success Criteria
- ✅ SMTP configuration (host, port, auth)
- ✅ TLS/SSL support
- ✅ From address configuration
- ✅ Test email functionality
- ✅ Twilio SMS integration
- ✅ Generic HTTP SMS provider
- ✅ Test SMS functionality
- ✅ 20+ integration tests passing

---

### **Week 15: Security & Token Management** (P1)

**Status:** NOT STARTED  
**Priority:** P1 (API access & security)  
**Target Parity:** 84% → 85% (+1%)

#### Deliverables
- [ ] `personal-access-token-commands.ts` - PAT management
- [ ] `machine-key-commands.ts` - Service account keys
- [ ] `key-commands.ts` - Encryption key management
- [ ] Integration tests: 20+ tests

#### Commands to Implement (10 total)

**Personal Access Token Commands (4 commands):**
- [ ] `addPersonalAccessToken()` - Create PAT for user
- [ ] `removePersonalAccessToken()` - Revoke PAT
- [ ] `regeneratePersonalAccessToken()` - Regenerate token
- [ ] `listPersonalAccessTokens()` - Query user PATs

**Machine Key Commands (4 commands):**
- [ ] `addMachineKey()` - Create service account key
- [ ] `removeMachineKey()` - Delete service account key
- [ ] `regenerateMachineKey()` - Regenerate key
- [ ] `listMachineKeys()` - Query machine keys

**Encryption Key Commands (2 commands):**
- [ ] `generateEncryptionKey()` - Generate encryption key
- [ ] `rotateEncryptionKey()` - Rotate encryption keys

#### Files to Create
```
src/lib/command/user/personal-access-token-commands.ts
src/lib/command/user/machine-key-commands.ts
src/lib/command/crypto/key-commands.ts
src/lib/command/crypto/key-write-model.ts

test/integration/commands/personal-access-token.test.ts
test/integration/commands/machine-key.test.ts
test/integration/commands/key-management.test.ts
```

#### Reference Files (Zitadel Go)
```
internal/command/user_personal_access_token.go
internal/command/user_machine_key.go
internal/command/crypto.go
```

#### Success Criteria
- ✅ PAT creation with scopes
- ✅ PAT expiration support
- ✅ Machine key generation (JWT keys)
- ✅ Key rotation support
- ✅ Secure token hashing
- ✅ Expiration tracking
- ✅ 20+ integration tests passing

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

| Week | Focus Area | Commands | Tests | Parity Gain |
|------|-----------|----------|-------|-------------|
| **11-12** | Policy Enhancement | 15 | 30 | +3% (78%→81%) |
| **13** | Identity Providers | 10 | 25 | +2% (81%→83%) |
| **14** | Notifications | 8 | 20 | +1% (83%→84%) |
| **15** | Security & Tokens | 10 | 20 | +1% (84%→85%) |
| **16** | Logout & Sessions | 5 | 15 | 0% (85%→85%) |
| **Total** | **5 Areas** | **48** | **110** | **+7%** |

### Cumulative Progress

| Milestone | Commands | Tests | Overall Parity |
|-----------|----------|-------|----------------|
| Phase 1 Complete (Week 8) | 53 | 152 | 75% |
| **Phase 1 Final (Week 10)** | **65** | **~187** | **78%** ⬅️ **Phase 2 starts here** |
| Week 12 | 80 | 217 | 81% |
| Week 13 | 90 | 242 | 83% |
| Week 14 | 98 | 262 | 84% |
| **Phase 2 Complete (Week 16)** | **113** | **~297** | **85%** |

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
