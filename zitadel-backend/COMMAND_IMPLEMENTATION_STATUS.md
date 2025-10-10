# Command Implementation Status

**Comparison between Zitadel Go v2 and TypeScript Backend**

Generated: 2025-10-10

---

## 📊 **Overall Summary**

**Last Updated:** 2025-10-10 (Phase 4 Complete)

| Category | Go Implementation Files | TypeScript Files | Coverage | Status |
|----------|------------------------|------------------|----------|---------|
| **Organization** | 10 files | 2 files | ~50% | ✅ Phase 4.1 |
| **User** | 25+ files | 2 files | ~35% | ✅ Phase 4.4 |
| **Project** | 10 files | 2 files | ~60% | ✅ Phase 4.2 |
| **Application** | 4 files | 1 file | ~55% | ✅ Phase 4.3 |
| **Instance** | 20+ files | 1 file | ~30% | ✅ Phase 3 |
| **Authentication** | 5 files | 1 file | ~60% | ✅ Phase 3 |
| **Session** | 3 files | 1 file | ~80% | ✅ Phase 3 |
| **IDP** | 10+ files | 0 files | 0% | ⏳ Pending |
| **Policies** | 15+ files | 2 files | ~15% | ⏳ Phase 5 |
| **Actions** | 2 files | 0 files | 0% | ⏳ Pending |
| **OIDC/SAML** | 4 files | 0 files | 0% | ⏳ Pending |
| **Notifications** | 5 files | 0 files | 0% | ⏳ Pending |
| **Other** | 10+ files | 0 files | 0% | ⏳ Pending |
| **TOTAL** | ~120 files | 11 files | **~35%** | **Phase 4 Done** |

**Phase 4 Achievement:** +21 commands, +10% coverage increase

---

## ✅ **IMPLEMENTED COMMANDS**

### **1. Organization Commands** ✅ **Improved (50%)**

**File:** `src/lib/command/org/org-commands.ts`

| Command | Go Function | TypeScript Function | Status | Notes |
|---------|------------|---------------------|--------|-------|
| Add Org | `AddOrg()` | `addOrg()` | ✅ Complete | Uses domain model validation |
| Change Org | `ChangeOrg()` | `changeOrg()` | ✅ Complete | |
| Deactivate Org | `DeactivateOrg()` | `deactivateOrg()` | ✅ Complete | |
| Reactivate Org | `ReactivateOrg()` | `reactivateOrg()` | ✅ Complete | |
| Remove Org | `RemoveOrg()` | `removeOrg()` | ✅ Complete | In org-setup-commands.ts |
| Setup Org | `SetUpOrg()` | `setupOrg()` | ✅ Complete | In org-setup-commands.ts |
| Add Org Member | `AddOrgMember()` | `addOrgMember()` | ✅ Complete | |
| Change Org Member | `ChangeOrgMember()` | `changeOrgMember()` | ✅ Complete | |
| Remove Org Member | `RemoveOrgMember()` | `removeOrgMember()` | ✅ Complete | |
| Add Domain | `AddOrgDomain()` | `addDomain()` | ✅ Complete | |
| Verify Domain | `VerifyOrgDomain()` | `verifyDomain()` | ✅ Complete | |
| Set Primary Domain | `SetPrimaryOrgDomain()` | `setPrimaryDomain()` | ✅ Complete | |
| Remove Domain | `RemoveOrgDomain()` | `removeDomain()` | ✅ **Phase 4.1** | Validates not primary |
| Generate Domain Validation | `GenerateOrgDomainValidation()` | `generateDomainValidation()` | ✅ **Phase 4.1** | HTTP/DNS validation |
| Validate Domain | `ValidateOrgDomain()` | `validateOrgDomain()` | ✅ **Phase 4.1** | With user claiming |

**Missing from Go:**
- `org_metadata.go` - Organization metadata management
- `org_action.go` - Organization-level actions
- `org_flow.go` - Organization trigger flows
- 10+ policy commands (see Policy section below)
- 5+ IDP config commands
- Custom text/message commands

---

### **2. User Commands** ✅ **Improved (35%)**

**Files:** `src/lib/command/user/user-commands.ts`, `src/lib/command/user/user-grant-commands.ts`

| Command | Go Files | TypeScript Function | Status | Notes |
|---------|----------|---------------------|--------|-------|
| Add Human User | `user_human.go` | `addHumanUser()` | ✅ Complete | |
| Change Profile | `user_human_profile.go` | `changeProfile()` | ✅ Complete | |
| Change Email | `user_human_email.go` | `changeEmail()` | ✅ Complete | |
| Verify Email | `user_human_email.go` | `verifyEmail()` | ✅ Complete | |
| Change Phone | `user_human_phone.go` | `changePhone()` | ✅ Complete | |
| Verify Phone | `user_human_phone.go` | `verifyPhone()` | ✅ Complete | |
| Remove Phone | `user_human_phone.go` | `removePhone()` | ✅ Complete | |
| Change Address | `user_human_address.go` | `changeAddress()` | ✅ Complete | |
| Change Password | `user_human_password.go` | `changePassword()` | ✅ Complete | |
| Lock User | `user.go` | `lockUser()` | ✅ Complete | |
| Unlock User | `user.go` | `unlockUser()` | ✅ Complete | |
| Deactivate User | `user.go` | `deactivateUser()` | ✅ Complete | |
| Reactivate User | `user.go` | `reactivateUser()` | ✅ Complete | |
| Remove User | `user.go` | `removeUser()` | ✅ Complete | |
| Add Machine User | `user_machine.go` | `addMachineUser()` | ✅ Complete | |
| Change Machine | `user_machine.go` | `changeMachine()` | ✅ Complete | |
| Add Machine Key | `user_machine_key.go` | `addMachineKey()` | ✅ Complete | |
| Remove Machine Key | `user_machine_key.go` | `removeMachineKey()` | ✅ Complete | |
| Generate Machine Secret | `user_machine_secret.go` | `generateMachineSecret()` | ✅ **Phase 4.4** | Returns client secret |
| Remove Machine Secret | `user_machine_secret.go` | `removeMachineSecret()` | ✅ **Phase 4.4** | |
| Add Personal Access Token | `user_personal_access_token.go` | `addPersonalAccessToken()` | ✅ **Phase 4.4** | With expiration |
| Remove PAT | `user_personal_access_token.go` | `removePersonalAccessToken()` | ✅ **Phase 4.4** | |
| Add User Grant | `user_grant.go` | `addUserGrant()` | ✅ **Phase 4.4** | Project access |
| Change User Grant | `user_grant.go` | `changeUserGrant()` | ✅ **Phase 4.4** | Role updates |
| Remove User Grant | `user_grant.go` | `removeUserGrant()` | ✅ **Phase 4.4** | Revoke access |

**Missing from Go:**
- `user_human_init.go` - User initialization/registration
- `user_human_otp.go` - OTP (SMS/Email) setup
- `user_human_webauthn.go` - WebAuthn/Passkey management
- `user_human_avatar.go` - Avatar management
- `user_human_refresh_token.go` - Refresh token operations
- `user_idp_link.go` - External IDP linking
- `user_metadata.go` - User metadata management
- `user_grant.go` - User grants (project access)
- `user_schema.go` - User schema management
- `user_v2_*.go` - v2 user API commands (10+ files)
- `user_v3_*.go` - v3 user API commands (3 files)

---

### **3. Project Commands** ✅ **Improved (60%)**

**File:** `src/lib/command/project/project-commands.ts`

| Command | Go Function | TypeScript Function | Status | Notes |
|---------|------------|---------------------|--------|-------|
| Add Project | `AddProject()` | `addProject()` | ✅ Complete | |
| Change Project | `ChangeProject()` | `changeProject()` | ✅ Complete | |
| Deactivate Project | `DeactivateProject()` | `deactivateProject()` | ✅ Complete | |
| Reactivate Project | `ReactivateProject()` | `reactivateProject()` | ✅ Complete | |
| Remove Project | `RemoveProject()` | `removeProject()` | ✅ **Phase 4.2** | With cascading |
| Add Project Role | `AddProjectRole()` | `addProjectRole()` | ✅ Complete | |
| Change Project Role | `ChangeProjectRole()` | `changeProjectRole()` | ✅ Complete | |
| Remove Project Role | `RemoveProjectRole()` | `removeProjectRole()` | ✅ Complete | |
| Add Project Member | `AddProjectMember()` | `addProjectMember()` | ✅ Complete | |
| Change Project Member | `ChangeProjectMember()` | `changeProjectMember()` | ✅ Complete | |
| Remove Project Member | `RemoveProjectMember()` | `removeProjectMember()` | ✅ **Phase 4.2** | |
| Add Project Grant | `AddProjectGrant()` | `addProjectGrant()` | ✅ Complete | |
| Change Project Grant | `ChangeProjectGrant()` | `changeProjectGrant()` | ✅ Complete | |
| Deactivate Project Grant | `DeactivateProjectGrant()` | `deactivateProjectGrant()` | ✅ **Phase 4.2** | State validation |
| Reactivate Project Grant | `ReactivateProjectGrant()` | `reactivateProjectGrant()` | ✅ **Phase 4.2** | State validation |
| Remove Project Grant | `RemoveProjectGrant()` | `removeProjectGrant()` | ✅ **Phase 4.2** | |

**Missing from Go:**
- `project_grant_member.go` - Project grant member management

---

### **4. Application Commands** ✅ **Improved (55%)**

**File:** `src/lib/command/application/app-commands.ts`

| Command | Go Files | TypeScript Function | Status | Notes |
|---------|----------|---------------------|--------|-------|
| Add OIDC App | `project_application_oidc.go` | `addOIDCApp()` | ✅ Complete | |
| Update OIDC App | `project_application_oidc.go` | `updateOIDCApp()` | ✅ Complete | |
| Add API App | `project_application_api.go` | `addAPIApp()` | ✅ Complete | |
| Update API App | `project_application_api.go` | `updateAPIApp()` | ✅ Complete | |
| Change App Secret | `project_application.go` | `changeAppSecret()` | ✅ Complete | |
| Add App Key | `project_application_key.go` | `addAppKey()` | ✅ Complete | |
| Remove App Key | `project_application_key.go` | `removeAppKey()` | ✅ **Phase 4.3** | |
| Add SAML App | `project_application_saml.go` | `addSAMLApp()` | ✅ **Phase 4.3** | With metadata |
| Update SAML App | `project_application_saml.go` | `updateSAMLApp()` | ✅ **Phase 4.3** | |
| Remove Application | `project_application.go` | `removeApplication()` | ✅ **Phase 4.3** | |
| Deactivate Application | `project_application.go` | `deactivateApplication()` | ✅ **Phase 4.3** | State validation |
| Reactivate Application | `project_application.go` | `reactivateApplication()` | ✅ **Phase 4.3** | State validation |

---

### **5. Instance Commands** ⚠️ **Partial (30%)**

**File:** `src/lib/command/instance/instance-commands.ts`

| Command | Go Function | TypeScript Function | Status | Notes |
|---------|------------|---------------------|--------|-------|
| Setup Instance | `SetUpInstance()` | `setupInstance()` | ✅ Complete | |
| Add Instance Domain | `AddInstanceDomain()` | `addInstanceDomain()` | ✅ Complete | |
| Set Default Domain | `SetDefaultInstanceDomain()` | `setDefaultInstanceDomain()` | ✅ Complete | |
| Remove Instance Domain | `RemoveInstanceDomain()` | `removeInstanceDomain()` | ✅ Complete | |
| Set Instance Features | `SetInstanceFeatures()` | `setInstanceFeatures()` | ✅ Complete | |
| Reset Instance Features | `ResetInstanceFeatures()` | `resetInstanceFeatures()` | ✅ Complete | |
| Add Instance Member | `AddInstanceMember()` | `addInstanceMember()` | ✅ Complete | |
| Change Instance Member | `ChangeInstanceMember()` | `changeInstanceMember()` | ✅ Complete | |
| Remove Instance Member | `RemoveInstanceMember()` | `removeInstanceMember()` | ✅ Complete | |
| Remove Instance | `RemoveInstance()` | ❌ Missing | Need to implement |

**Missing from Go (20+ commands):**
- `instance_idp.go` / `instance_idp_*.go` - IDP configuration (5 files)
- `instance_policy_*.go` - All policy management (10 files)
- `instance_custom_*.go` - Custom texts/messages (4 files)
- `instance_settings.go` - Instance settings
- `instance_trusted_domain.go` - Trusted domains
- `instance_role_permissions.go` - Role permissions
- `instance_oidc_settings.go` - OIDC settings
- Debug notification commands (2 files)

---

### **6. Session Commands** ✅ **Good (80%)**

**File:** `src/lib/command/session/session-commands.ts`

| Command | Go Function | TypeScript Function | Status | Notes |
|---------|------------|---------------------|--------|-------|
| Create Session | `CreateSession()` | `createSession()` | ✅ Complete | |
| Update Session | `UpdateSession()` | `updateSession()` | ✅ Complete | |
| Terminate Session | `TerminateSession()` | `terminateSession()` | ✅ Complete | |
| Set Session Token | `SetSessionToken()` | `setSessionToken()` | ✅ Complete | |
| Check Session Token | `CheckSessionToken()` | `checkSessionToken()` | ✅ Complete | |
| Set Auth Factor | `SetAuthFactor()` | `setAuthFactor()` | ✅ Complete | |
| Set Session Metadata | `SetSessionMetadata()` | `setSessionMetadata()` | ✅ Complete | |
| Delete Session Metadata | `DeleteSessionMetadata()` | `deleteSessionMetadata()` | ✅ Complete | |

**Missing from Go:**
- `session_otp.go` - OTP session management
- `session_webauthn.go` - WebAuthn session management
- `oidc_session.go` - OIDC session specifics
- `logout_session.go` - Logout operations

---

### **7. Authentication Commands** ⚠️ **Partial (60%)**

**File:** `src/lib/command/auth/auth-commands.ts`

| Command | Go Function | TypeScript Function | Status | Notes |
|---------|------------|---------------------|--------|-------|
| Add Auth Request | `AddAuthRequest()` | `addAuthRequest()` | ✅ Complete | |
| Select User | `SelectUser()` | `selectUser()` | ✅ Complete | |
| Check Password | `CheckPassword()` | `checkPassword()` | ✅ Complete | |
| Check TOTP | `CheckTOTP()` | `checkTOTP()` | ✅ Complete | |
| Succeed Auth Request | `SucceedAuthRequest()` | `succeedAuthRequest()` | ✅ Complete | |
| Fail Auth Request | `FailAuthRequest()` | `failAuthRequest()` | ✅ Complete | |

**Missing from Go:**
- `device_auth.go` - Device authorization flow
- `saml_request.go` - SAML authentication
- `idp_intent.go` - External IDP authentication

---

### **8. Policy Commands** ❌ **Minimal (15%)**

**Files:** 
- `src/lib/command/policy/login-policy-commands.ts`
- `src/lib/command/policy/password-age-policy-commands.ts`

| Policy Type | Go Files | TypeScript Implementation | Status |
|-------------|----------|---------------------------|--------|
| Login Policy | `org_policy_login.go`, `instance_policy_login.go` | ✅ Partial | 5 commands |
| Password Age Policy | `org_policy_password_age.go`, `instance_policy_password_age.go` | ✅ Partial | 4 commands |
| Password Complexity | `org_policy_password_complexity.go`, `instance_policy_password_complexity.go` | ❌ Missing | 0 commands |
| Password Lockout | `org_policy_lockout.go`, `instance_policy_password_lockout.go` | ❌ Missing | 0 commands |
| Domain Policy | `org_policy_domain.go`, `instance_policy_domain.go` | ❌ Missing | 0 commands |
| Label Policy | `org_policy_label.go`, `instance_policy_label.go` | ❌ Missing | 0 commands |
| Privacy Policy | `org_policy_privacy.go`, `instance_policy_privacy.go` | ❌ Missing | 0 commands |
| Notification Policy | `org_policy_notification.go`, `instance_policy_notification.go` | ❌ Missing | 0 commands |
| Mail Template Policy | `org_policy_mail_template.go`, `instance_policy_mail_template.go` | ❌ Missing | 0 commands |
| Security Policy | `instance_policy_security.go` | ❌ Missing | 0 commands |

**Estimated Missing Commands:** ~60+ policy commands

---

## ❌ **NOT IMPLEMENTED (0%)**

### **9. Identity Provider (IDP)** ❌ **0%**

**Go Files:**
- `idp.go` - Generic IDP operations
- `org_idp.go` - Organization IDP configuration
- `org_idp_config.go` - Legacy IDP config
- `org_idp_jwt_config.go` - JWT IDP config
- `org_idp_oidc_config.go` - OIDC IDP config
- `instance_idp.go` - Instance IDP configuration
- `instance_idp_*.go` - Instance IDP configs (3 files)
- `idp_intent.go` - IDP authentication intent

**Estimated Commands:** ~40+ IDP commands

---

### **10. Actions & Flows** ❌ **0%**

**Go Files:**
- `action_v2_target.go` - Action targets/webhooks
- `action_v2_execution.go` - Action execution
- `org_action.go` - Organization actions
- `org_flow.go` - Organization trigger flows
- `flow_model.go` - Flow management

**Estimated Commands:** ~15+ action commands

---

### **11. Custom Texts & Messages** ❌ **0%**

**Go Files:**
- `custom_login_text.go` - Login page texts
- `org_custom_login_text.go` - Org login texts
- `instance_custom_login_text.go` - Instance login texts
- `org_custom_message_text.go` - Org message texts
- `instance_custom_message_text.go` - Instance message texts
- `hosted_login_translation.go` - Hosted login translations

**Estimated Commands:** ~30+ text/message commands

---

### **12. Notifications** ❌ **0%**

**Go Files:**
- `smtp.go` - SMTP configuration
- `sms_config.go` - SMS configuration
- `instance_debug_notification_*.go` - Debug notifications (2 files)
- `email.go` - Email operations
- `phone.go` - Phone operations

**Estimated Commands:** ~20+ notification commands

---

### **13. OIDC & SAML Sessions** ❌ **0%**

**Go Files:**
- `oidc_session.go` - OIDC session management
- `saml_session.go` - SAML session management
- `saml_request.go` - SAML requests

**Estimated Commands:** ~15+ session commands

---

### **14. System & Advanced Features** ❌ **0%**

**Go Files:**
- `key_pair.go` - Key pair management
- `web_key.go` - Web key management
- `limits.go` - Limits/quotas
- `quota.go` - Quota management
- `quota_report.go` - Quota reporting
- `restrictions.go` - Restrictions
- `milestone.go` - Milestones
- `system_features.go` - System features
- `statics.go` - Static assets
- `debug_events.go` - Debug events

**Estimated Commands:** ~40+ system commands

---

## 📈 **IMPLEMENTATION PRIORITY RECOMMENDATIONS**

### **Phase 4: Critical Missing Commands (High Priority)**

1. **Organization Domain Commands** (2-3 days)
   - ❌ `removeDomain()` - Remove organization domain
   - ❌ `generateDomainValidation()` - Generate domain validation token
   - ❌ `validateDomain()` - Validate domain ownership

2. **Project Lifecycle** (2-3 days)
   - ❌ `removeProject()` - Remove project
   - ❌ `removeProjectMember()` - Remove project member
   - ❌ `deactivateProjectGrant()` - Deactivate grant
   - ❌ `reactivateProjectGrant()` - Reactivate grant
   - ❌ `removeProjectGrant()` - Remove grant

3. **Application Lifecycle** (3-4 days)
   - ❌ `addSAMLApp()` - SAML application support
   - ❌ `updateSAMLApp()` - Update SAML app
   - ❌ `removeApplication()` - Remove application
   - ❌ `deactivateApplication()` - Deactivate app
   - ❌ `reactivateApplication()` - Reactivate app
   - ❌ `removeAppKey()` - Remove app key

4. **User Advanced Features** (3-4 days)
   - ❌ `addMachineSecret()` - Machine user secrets
   - ❌ `addPersonalAccessToken()` - PAT generation
   - ❌ `removePersonalAccessToken()` - PAT removal
   - ❌ `addUserGrant()` - User project grants
   - ❌ `changeUserGrant()` - Change grants
   - ❌ `removeUserGrant()` - Remove grants

---

### **Phase 5: Core Policies (High Priority)**

1. **Password Policies** (3-4 days)
   - ❌ Password Complexity Policy (6 commands)
   - ❌ Password Lockout Policy (6 commands)

2. **Domain & Privacy Policies** (3-4 days)
   - ❌ Domain Policy (6 commands)
   - ❌ Privacy Policy (6 commands)

3. **Notification & Mail Policies** (3-4 days)
   - ❌ Notification Policy (6 commands)
   - ❌ Mail Template Policy (6 commands)

---

### **Phase 6: Identity Providers (Medium Priority)**

1. **Generic IDP** (5-7 days)
   - ❌ Add IDP (generic)
   - ❌ Update IDP
   - ❌ Remove IDP
   - ❌ Activate/Deactivate IDP

2. **OIDC IDP** (3-4 days)
   - ❌ Add OIDC IDP
   - ❌ Update OIDC IDP
   - ❌ Configure OIDC settings

3. **JWT IDP** (2-3 days)
   - ❌ Add JWT IDP
   - ❌ Update JWT IDP

4. **IDP Links** (2-3 days)
   - ❌ Link user to IDP
   - ❌ Unlink user from IDP
   - ❌ IDP intent handling

---

### **Phase 7: User Advanced (Medium Priority)**

1. **WebAuthn/Passkey** (5-7 days)
   - ❌ Register WebAuthn
   - ❌ Remove WebAuthn
   - ❌ Passkey management

2. **OTP Management** (3-4 days)
   - ❌ Setup TOTP
   - ❌ Remove TOTP
   - ❌ Setup OTP (SMS/Email)

3. **User Metadata** (2-3 days)
   - ❌ Set metadata
   - ❌ Delete metadata
   - ❌ Bulk metadata operations

4. **User Schema** (3-4 days)
   - ❌ Create schema
   - ❌ Update schema
   - ❌ Delete schema

---

### **Phase 8: Actions & Flows (Medium Priority)**

1. **Action Targets** (3-4 days)
   - ❌ Add target
   - ❌ Update target
   - ❌ Remove target

2. **Action Execution** (3-4 days)
   - ❌ Add execution
   - ❌ Update execution
   - ❌ Remove execution

3. **Trigger Flows** (2-3 days)
   - ❌ Configure flows
   - ❌ Set trigger actions

---

### **Phase 9: Notifications (Low Priority)**

1. **SMTP Configuration** (2-3 days)
   - ❌ Add SMTP
   - ❌ Update SMTP
   - ❌ Test SMTP

2. **SMS Configuration** (2-3 days)
   - ❌ Add SMS provider
   - ❌ Update SMS provider
   - ❌ Test SMS

---

### **Phase 10: OIDC/SAML Sessions (Low Priority)**

1. **OIDC Sessions** (3-4 days)
   - ❌ Create OIDC session
   - ❌ Update OIDC session
   - ❌ Terminate OIDC session

2. **SAML Sessions** (3-4 days)
   - ❌ Create SAML session
   - ❌ Handle SAML request
   - ❌ Terminate SAML session

---

### **Phase 11: Custom Texts (Low Priority)**

1. **Login Texts** (3-4 days)
   - ❌ Set custom login texts
   - ❌ Reset to default

2. **Message Texts** (3-4 days)
   - ❌ Set custom message texts
   - ❌ Reset to default

---

### **Phase 12: System Features (Low Priority)**

1. **Key Management** (3-4 days)
   - ❌ Key pair generation
   - ❌ Web key management

2. **Quotas & Limits** (3-4 days)
   - ❌ Set quotas
   - ❌ Quota reporting
   - ❌ Restrictions

---

## 🎯 **FEATURE PARITY ANALYSIS**

### **Current Coverage: ~25%**

**Strong Areas:**
- ✅ Session Management (80%)
- ✅ Basic Authentication (60%)
- ✅ Project Core Operations (50%)

**Weak Areas:**
- ⚠️ User Management (20%) - Missing v2/v3 APIs, WebAuthn, OTP, metadata
- ⚠️ Organization (40%) - Missing policies, actions, IDPs, metadata
- ⚠️ Application (40%) - Missing SAML, lifecycle operations
- ⚠️ Instance (30%) - Missing policies, IDPs, settings
- ❌ Policies (15%) - Missing 8 out of 10 policy types
- ❌ IDPs (0%) - Complete category missing
- ❌ Actions/Flows (0%) - Complete category missing
- ❌ Notifications (0%) - Complete category missing
- ❌ OIDC/SAML Sessions (0%) - Complete category missing
- ❌ Custom Texts (0%) - Complete category missing
- ❌ System Features (0%) - Complete category missing

### **Estimated Work Remaining**

| Phase | Estimated Days | Commands to Implement |
|-------|---------------|----------------------|
| Phase 4 (Critical) | 10-14 days | ~20 commands |
| Phase 5 (Policies) | 12-16 days | ~30 commands |
| Phase 6 (IDPs) | 12-18 days | ~40 commands |
| Phase 7 (User Advanced) | 13-18 days | ~25 commands |
| Phase 8 (Actions) | 8-11 days | ~15 commands |
| Phase 9 (Notifications) | 4-6 days | ~20 commands |
| Phase 10 (OIDC/SAML) | 6-8 days | ~15 commands |
| Phase 11 (Custom Texts) | 6-8 days | ~30 commands |
| Phase 12 (System) | 6-8 days | ~40 commands |
| **TOTAL** | **77-107 days** | **~235 commands** |

**With 2 developers: ~2-3 months of work**
**With 1 developer: ~4-5 months of work**

---

## 📝 **NOTES**

1. **Domain Model Integration**: The `addOrg()` command was recently updated to use domain model validation following Go patterns. This pattern should be applied to all other commands.

2. **Missing Write Models**: Many commands require corresponding write models that may not exist yet.

3. **Query Layer**: Commands often depend on query projections for validation (e.g., checking if entities exist).

4. **Event Compatibility**: All events must be compatible with Zitadel Go v2 event schema.

5. **Test Coverage**: Each new command should include unit tests following existing patterns.

---

## 🔄 **NEXT IMMEDIATE STEPS**

1. **Complete Phase 4** - Critical missing commands (2 weeks)
2. **Apply Domain Pattern** - Update all existing commands to use domain model validation (1 week)
3. **Implement Core Policies** - Phase 5 (2-3 weeks)
4. **IDP Integration** - Phase 6 (2-3 weeks)

**Priority Focus:** Get to 50% feature parity within next 4-6 weeks.
