# Phase 4: Console Advanced
**Advanced Admin Features & Configuration**

**Duration:** 4 weeks  
**Effort:** 558 hours  
**Team:** 2-3 frontend developers

---

## 🎯 OBJECTIVES

Implement advanced admin features including instance settings, policies, actions, identity providers, and SAML configuration UI.

---

## 📋 DELIVERABLES

### 1. Instance Settings (164 hours)

**Instance Overview (24h)**
- Instance information dashboard
- System statistics
- Health monitoring
- License information
- Feature flags overview

**General Settings (28h)**
- Instance name and description
- Primary domain configuration
- Additional domains management
- Default language
- Supported languages
- Timezone settings

**Security Settings (32h)**
- Password complexity requirements
- Session timeout configuration
- Login attempt limits
- IP allowlist/blocklist
- CORS configuration
- Security headers

**Domain Management (24h)**
- Domain list table
- Add custom domain
- Verify domain ownership
- SSL certificate status
- Default domain selection
- Remove domain

**SMTP Configuration (28h)**
- SMTP server settings
- Authentication credentials
- TLS/SSL configuration
- Test email functionality
- Email templates preview
- Sender configuration

**SMS Provider (24h)**
- Provider selection (Twilio, AWS SNS)
- Provider credentials
- Test SMS functionality
- Phone number configuration
- Default SMS templates

### 2. Policies Module (148 hours)

**Login Policy (24h)**
- Username/email login toggle
- External IdP options
- Passwordless options
- Multi-factor requirements
- Registration settings
- Password reset options

**Password Policy (20h)**
- Minimum length
- Character requirements
- Password history
- Expiration settings
- Complexity rules
- Password strength meter config

**Lockout Policy (16h)**
- Max failed attempts
- Lockout duration
- Progressive delays
- IP-based lockout
- Account recovery options

**Privacy Policy (16h)**
- Privacy policy URL
- Terms of service URL
- Help/Support URL
- Custom links
- Legal text display

**Notification Policy (16h)**
- Email notification toggles
- SMS notification toggles
- Password change notifications
- Login notifications
- Admin notifications

**Label Policy (20h)**
- Primary color
- Background color
- Font color
- Logo upload
- Icon upload
- Hide Zitadel branding
- Custom CSS

**Domain Policy (16h)**
- Domain validation rules
- Allowed domains
- Blocked domains
- Email domain restrictions

**OIDC Configuration (20h)**
- Token lifetimes
- Refresh token settings
- Access token format
- ID token claims
- Authorization code lifetime

---

### 3. Actions Module (96 hours)

**Actions List v2 (20h)**
- Actions table with filters
- Action status indicators
- Execution count
- Last executed time
- Create action button
- Action templates

**Actions List v1 (16h)**
- Legacy actions view
- Migration helper
- Deprecation warnings

**Action Detail/Editor (24h)**
- Action name and description
- JavaScript code editor with syntax highlighting
- Trigger configuration
- Timeout settings
- Test action functionality
- Execution logs viewer

**Flow Management (20h)**
- Flow list (pre-auth, post-auth, etc.)
- Add action to flow
- Reorder actions
- Enable/disable actions
- Flow diagram visualization

**Action Keys (12h)**
- API key management for actions
- Generate new key
- Revoke key
- Key usage tracking

---

### 4. Identity Providers (96 hours)

**IdP List Page (16h)**
- All IdPs table
- Filter by type (OIDC, OAuth, SAML, LDAP)
- IdP status
- Usage statistics
- Create IdP button

**IdP Configuration (28h)**
- Create IdP wizard
- General settings
- Provider selection
- Callback URL display
- Enable/disable toggle

**OIDC IdP (24h)**
- Client ID and secret
- Discovery endpoint
- Authorization endpoint
- Token endpoint
- Scopes configuration
- Claim mapping

**OAuth IdP (20h)**
- Client ID and secret
- Authorization URL
- Token URL
- User info URL
- Scope configuration

**SAML IdP Admin UI (32h)**
- SAML IdP list
- Create SAML IdP
- Upload metadata XML
- Parse metadata automatically
- Entity ID configuration
- SSO URL
- Certificate upload
- Attribute mapping UI
- Name ID format
- Binding method selection
- Enable/disable IdP
- Test SAML connection

**LDAP Configuration (12h)**
- LDAP server URL
- Bind DN and password
- Base DN
- Search filter
- Attribute mapping
- TLS configuration

---

### 5. Grants Management (32h)**

**Grant Overview (12h)**
- All grants dashboard
- User grants table
- Project grants table
- Organization grants

**Grant Assignment (12h)**
- Assign user to project
- Assign roles
- Grant detail view
- Revoke grant

**Bulk Grant Operations (8h)**
- Bulk assign users
- Bulk revoke grants
- Import grants from CSV

---

### 6. Audit Logs (22h)

**Audit Log Viewer (16h)**
- Event log table
- Filter by date range
- Filter by event type
- Filter by user
- Filter by resource
- Export logs

**Log Detail (6h)**
- Event details
- Before/after state
- User information
- Timestamp
- IP address

---

## ✅ ACCEPTANCE CRITERIA

### Instance Settings
- [ ] All instance settings configurable
- [ ] SMTP configuration working
- [ ] SMS provider configured
- [ ] Domain management functional
- [ ] Test email working
- [ ] Test SMS working

### Policies
- [ ] All 8 policy types configurable
- [ ] Policy inheritance working
- [ ] Default policies applied
- [ ] Organization-level overrides
- [ ] Validation working
- [ ] Preview functionality

### Actions
- [ ] Create custom actions
- [ ] Code editor with syntax highlighting
- [ ] Test actions before deployment
- [ ] View execution logs
- [ ] Manage action flows
- [ ] Action keys working

### Identity Providers
- [ ] All IdP types configurable (OIDC, OAuth, SAML, LDAP)
- [ ] SAML metadata upload working
- [ ] Certificate management
- [ ] Attribute mapping UI functional
- [ ] Test IdP connections
- [ ] Enable/disable IdPs
- [ ] User linking working

### Audit Logs
- [ ] View all system events
- [ ] Filter and search working
- [ ] Export functionality
- [ ] Real-time updates

---

## 🧪 TESTING REQUIREMENTS

### Unit Tests
- [ ] Policy form validation
- [ ] Action code validation
- [ ] SAML metadata parsing
- [ ] Attribute mapping logic

### Integration Tests
- [ ] Save and load policies
- [ ] Execute test actions
- [ ] SAML IdP creation flow
- [ ] Grant assignment flow

### E2E Tests
- [ ] Complete policy configuration
- [ ] Create and test action
- [ ] Setup SAML IdP end-to-end
- [ ] Assign and revoke grants

---

## 🚀 SPRINT BREAKDOWN

### Week 1: Instance Settings
- Days 1-2: Overview and general settings
- Days 3-4: Security settings
- Day 5: SMTP and SMS

### Week 2: Policies
- Days 6-7: Login and password policies
- Days 8-9: Label and domain policies
- Day 10: OIDC and other policies

### Week 3: Actions + IdPs (Part 1)
- Days 11-12: Actions module
- Days 13-15: IdP configuration (OIDC, OAuth)

### Week 4: IdPs (Part 2) + Advanced
- Days 16-17: SAML Admin UI
- Day 18: LDAP configuration
- Days 19-20: Grants and audit logs

---

## 📦 KEY COMPONENTS

### Instance Settings Components
```typescript
<InstanceOverview />
<DomainManager />
<SMTPConfig />
<SMSProviderConfig />
<SecuritySettings />
<FeatureFlagEditor />
```

### Policy Components
```typescript
<PolicyEditor />
<PasswordPolicyForm />
<LabelPolicyForm />
<ColorPicker />
<LogoUploader />
<PolicyInheritanceTree />
```

### Actions Components
```typescript
<ActionList />
<ActionEditor />
<CodeEditor />
<FlowManager />
<FlowDiagram />
<ActionKeyManager />
<ExecutionLogViewer />
```

### IdP Components
```typescript
<IdPList />
<IdPWizard />
<OIDCConfigForm />
<SAMLConfigForm />
<SAMLMetadataUploader />
<AttributeMappingEditor />
<CertificateUploader />
<IdPTestDialog />
```

---

## 🔗 DEPENDENCIES

### Prerequisites
- Phase 3 complete (Console core working)
- Backend admin APIs for policies
- Backend IdP APIs
- Backend action execution engine

### Critical APIs
```
Policies:
- GET/PUT /v2/policies/login
- GET/PUT /v2/policies/password
- GET/PUT /v2/policies/label

Actions:
- GET /v2/actions
- POST /v2/actions
- GET /v2/flows

IdPs:
- GET /v2/idps
- POST /v2/idps/oidc
- POST /v2/idps/saml
- POST /v2/idps/saml/metadata

SAML:
- POST /v2/saml/idp
- PUT /v2/saml/idp/{id}
- POST /v2/saml/idp/{id}/metadata
- POST /v2/saml/idp/{id}/certificate
```

---

## ⚠️ KNOWN CHALLENGES

**Challenge 1: SAML Complexity**
- SAML configuration has many options
- **Mitigation:** Provide metadata upload for auto-config, good defaults

**Challenge 2: Action Code Editor**
- Need syntax highlighting and validation
- **Mitigation:** Use Monaco Editor (VS Code editor)

**Challenge 3: Policy Inheritance**
- Understanding which policy applies where
- **Mitigation:** Show inheritance tree, highlight overrides

---

**Previous Phase:** [PHASE_3_CONSOLE_CORE.md](./PHASE_3_CONSOLE_CORE.md)  
**Next Phase:** [PHASE_5_POLISH.md](./PHASE_5_POLISH.md)  
**Main Roadmap:** [FRONTEND_MIGRATION_ROADMAP.md](./FRONTEND_MIGRATION_ROADMAP.md)
