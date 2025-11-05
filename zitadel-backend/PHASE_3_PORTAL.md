# Phase 3: Portal Migration
**Authentication & User-Facing Flows**

**Duration:** 2 weeks  
**Effort:** 288 hours  
**Team:** 2-3 frontend developers
**Status:** Planned  
**Dependencies:** Phase 1 (Foundation)

---

## 🎯 OBJECTIVES

Migrate all authentication flows to new React/Next.js stack with complete feature parity to existing Zitadel Portal application.

**Timeline Note:** This phase is independent of Phase 2 (Console Core) and can be executed in parallel or sequentially based on team capacity and priorities.

---

## 📋 DELIVERABLES

### 1. Portal App Setup (16 hours)
- Create `apps/portal/` Next.js app
- Configure App Router and layouts
- Setup NextAuth.js authentication
- Configure environment variables

### 2. Core Authentication (96 hours)

**Username & Password (24h)**
- `/loginname` - Username entry page
- `/password` - Password authentication
- `/password/set` - Set new password
- `/password/change` - Change password
- `/password/reset` - Password reset flow

**Registration (24h)**
- `/register` - User registration
- `/register/user` - New user form
- `/register/org` - Organization registration

**Verification (12h)**
- `/verify` - Email/phone verification
- `/verify/email` - Email verification flow
- `/verify/phone` - Phone verification flow

**Account Management (20h)**
- `/accounts` - Account selection
- `/logout` - Logout flows
- `/logoutcallback` - OIDC logout callback

### 3. Multi-Factor Authentication (80 hours)

**MFA Setup (20h)**
- `/mfa/set` - MFA method setup
- `/mfa/verify` - Verify MFA setup
- Generate and display backup codes

**OTP Methods (24h)**
- `/otp/sms` - SMS OTP authentication
- `/otp/email` - Email OTP authentication
- `/otp/time-based` - TOTP authentication
- Resend OTP functionality

**Passkey (20h)**
- `/passkey` - Passkey authentication
- `/passkey/add` - Register new passkey
- `/passkey/verify` - Verify passkey
- WebAuthn integration

**U2F (16h)**
- `/u2f` - U2F device authentication
- `/u2f/verify` - Verify U2F token
- Hardware key support

### 4. External Identity Providers (32 hours)

**IdP Flows (32h)**
- `/idp/[provider]` - IdP selection and initiation
- `/idp/callback` - OAuth/OIDC callback handler
- `/idp/success` - Successful authentication
- `/idp/failure` - Authentication errors

**Supported Providers:**
- Google OAuth
- Microsoft Azure AD
- GitHub OAuth
- Generic OIDC
- Generic OAuth 2.0
- SAML IdP (user-facing)

### 5. SAML User Flows (24 hours)

**SAML Authentication (24h)**
- `/idp/saml` - SAML IdP selector
- `/idp/saml/[idpId]` - Specific SAML IdP
- `/idp/saml/callback` - SAML assertion handler

**Functionality:**
- Initiate SAML AuthnRequest
- Parse and validate SAML Response
- Extract user attributes from assertion
- Auto-provision users from SAML
- Handle SAML errors

### 6. SAML Admin Configuration UI (32 hours)

**Note:** This will be added to Console app under Instance Settings

**SAML IdP Management (32h)**
- List all SAML Identity Providers
- Create new SAML IdP
- Edit existing SAML IdP
- Upload SAML metadata XML
- Upload signing certificates
- Configure attribute mapping
- Enable/disable IdP
- Delete IdP

**Attribute Mapping:**
- Email claim mapping
- Username claim mapping
- First name / Last name mapping
- Custom attribute mapping

### 7. Device Authorization (8 hours)
- `/device` - Device authorization flow
- Display and verify device codes
- Approve/deny device access

---

## ✅ ACCEPTANCE CRITERIA

### Functionality
- [ ] All 28 authentication pages implemented
- [ ] All auth flows working end-to-end
- [ ] All MFA methods functional (TOTP, SMS, Email, Passkey, U2F)
- [ ] External IdP flows working (OAuth, OIDC, SAML)
- [ ] SAML SSO authentication functional
- [ ] SAML admin configuration UI complete
- [ ] Session management working
- [ ] Token refresh working
- [ ] Logout flows working

### User Experience
- [ ] Responsive design on all devices
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Loading states for all async operations
- [ ] Clear error messages
- [ ] Form validation working
- [ ] Success confirmations
- [ ] Smooth transitions between pages

### Technical
- [ ] TypeScript with no errors
- [ ] ESLint passing
- [ ] All components using shared UI library
- [ ] API client integration complete
- [ ] Proper error handling
- [ ] Security best practices followed

### Testing
- [ ] Unit tests for all components
- [ ] Integration tests for auth flows
- [ ] E2E tests for critical paths
- [ ] Manual testing complete
- [ ] Cross-browser testing

---

## 🧪 TESTING CHECKLIST

### Auth Flows
- [ ] Username/password login
- [ ] Registration flow
- [ ] Email verification
- [ ] Password reset
- [ ] Account switching
- [ ] Logout

### MFA
- [ ] TOTP setup and verification
- [ ] SMS OTP flow
- [ ] Email OTP flow
- [ ] Passkey registration
- [ ] Passkey authentication
- [ ] U2F setup and auth

### External IdP
- [ ] Google login
- [ ] Azure AD login
- [ ] Generic OIDC
- [ ] SAML SSO login
- [ ] Account linking

### SAML Admin
- [ ] Create SAML IdP
- [ ] Upload metadata
- [ ] Configure attributes
- [ ] Enable/disable IdP
- [ ] Delete IdP

---

## 🚀 SPRINT BREAKDOWN

### Week 1: Core Auth + MFA
**Days 1-2:** Portal setup + Username/Password pages  
**Days 3-4:** Registration + Verification pages  
**Days 5-7:** MFA setup + OTP methods

### Week 2: Advanced Flows + SAML
**Days 8-9:** Passkey + U2F  
**Days 10-11:** External IdP flows  
**Days 12-13:** SAML user flows + Admin UI  
**Day 14:** Testing and polish

---

## 📦 KEY COMPONENTS

### Portal-Specific Components
```typescript
// Authentication Forms
<UsernameForm />
<PasswordForm />
<RegistrationForm />
<VerificationForm />

// MFA Components
<MFASetup />
<OTPInput />
<PasskeyPrompt />
<U2FPrompt />

// IdP Components
<IdPSelector />
<SAMLCallback />
<OAuthCallback />

// Account Management
<AccountSelector />
<AccountCard />
```

### Shared Components (from packages/ui)
```typescript
<Button />
<Input />
<Card />
<Dialog />
<Toast />
<Alert />
<Loading />
```

---

## 🔗 DEPENDENCIES

### Prerequisites
- Phase 1 complete (shared components ready)
- Backend authentication APIs operational
- SAML provider backend working

### API Endpoints Required
- `/api/v1/auth/loginname`
- `/api/v1/auth/password`
- `/api/v1/auth/register`
- `/api/v1/auth/mfa/*`
- `/api/v1/auth/passkey/*`
- `/api/v2/idps/*`
- `/api/v2/saml/*`

---

## 📊 PROGRESS TRACKING

### Daily Checklist
- [ ] Pages completed today
- [ ] Components built
- [ ] Tests written
- [ ] Blockers identified

### Week 1 Milestone
- [ ] Core auth pages done
- [ ] MFA setup complete
- [ ] Basic testing done

### Week 2 Milestone
- [ ] All 28 pages complete
- [ ] SAML flows working
- [ ] All tests passing
- [ ] Ready for Phase 3

---

## ⚠️ KNOWN CHALLENGES

**Challenge 1: SAML Complexity**
- SAML flows are complex with many edge cases
- **Mitigation:** Reference existing implementation, use established libraries

**Challenge 2: WebAuthn Browser Support**
- Passkey support varies by browser
- **Mitigation:** Provide fallback options, test on all major browsers

**Challenge 3: MFA Testing**
- Testing SMS/Email OTP requires external services
- **Mitigation:** Use mock providers in development

---

**Previous Phase:** [PHASE_1_FOUNDATION.md](./PHASE_1_FOUNDATION.md)  
**Next Phase:** [PHASE_3_CONSOLE_CORE.md](./PHASE_3_CONSOLE_CORE.md)  
**Main Roadmap:** [FRONTEND_MIGRATION_ROADMAP.md](./FRONTEND_MIGRATION_ROADMAP.md)
