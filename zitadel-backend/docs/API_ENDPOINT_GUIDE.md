# ZITADEL API Endpoint Documentation
**Complete Guide with Real-World Examples**

**Created:** November 1, 2025  
**Purpose:** Understand what each API does and why you'd use it

---

## 📋 Quick Navigation

- [Admin Service](#admin-service) - System configuration, email/SMS, IDPs, policies
- [Instance Service](#instance-service) - Multi-tenant management
- [User Service](#user-service) - User accounts, profiles, authentication
- [Organization Service](#organization-service) - Tenants, domains, members
- [Auth Service](#auth-service) - Authenticated user operations
- [OIDC/OAuth2 Service](#oidcoauth2-service) - OAuth flows, tokens, SSO

---

## Admin Service
**Who uses it:** Platform administrators, system operators  
**Purpose:** Configure system-wide settings affecting all users

### System & Health

| Endpoint | What It Does | User Example | Admin Example |
|----------|--------------|--------------|---------------|
| **Healthz** | Check if system is running | - | Load balancer checks if instance is healthy |
| **GetSupportedLanguages** | List available UI languages | "Can I use ZITADEL in Japanese?" | "What languages can we offer employees?" |
| **SetDefaultLanguage** | Set instance default language | - | "Make German the default for our company" |
| **ListOrgs** | List all organizations | - | "Show all 500 customer organizations" |
| **GetOrgByID** | Get specific organization | - | Support: "Look up Acme Corp details" |
| **IsOrgUnique** | Check if org name available | "Is 'AcmeCorp' taken?" | Prevent duplicate org names |

**Real-World Scenario:**
```
Problem: German company with 5000 employees
Solution: Admin sets default language to 'de'
Result: All new employees see German UI automatically
```

---

### Secret Generators (Verification Codes)

| Endpoint | What It Does | When You Use It |
|----------|--------------|-----------------|
| **ListSecretGenerators** | See code generation config | "How long do email codes last?" |
| **GetSecretGenerator** | Get specific generator | "Check password reset code settings" |
| **UpdateSecretGenerator** | Change code settings | "Make codes 8 digits instead of 6" |

**Current Defaults:**
- Email verification: 6 digits, expires in 10 minutes
- Password reset: 6 digits, expires in 1 hour
- SMS OTP: 6 digits, expires in 5 minutes
- Init code: 6 digits, expires in 72 hours

**Real-World Scenario:**
```
Problem: Security audit recommends longer codes
Solution: Admin changes email codes from 6 to 8 digits
Result: Users receive 8-digit codes: "12345678" instead of "123456"
```

---

### Email Providers

| Endpoint | What It Does | User Impact | Admin Use Case |
|----------|--------------|-------------|----------------|
| **AddEmailProviderSMTP** | Configure email sending | Receives verification emails | "Use our Exchange server" |
| **UpdateEmailProviderSMTP** | Change email settings | Better email delivery | "Switch to AWS SES" |
| **AddEmailProviderHTTP** | Use HTTP API (Postmark) | Modern email service | "Use Postmark API not SMTP" |
| **ActivateEmailProvider** | Enable email sending | Starts receiving emails | "Make new config live" |
| **RemoveEmailProvider** | Delete email config | Stops email delivery | "Remove old SendGrid config" |

**Configuration Example:**
```javascript
// Configure SendGrid for transactional emails
AddEmailProviderSMTP({
  senderAddress: 'noreply@company.com',
  senderName: 'Company Security',
  host: 'smtp.sendgrid.net',
  user: 'apikey',
  password: 'SG.abc123...',
  tls: true
});

// Now sends:
// - Welcome emails
// - Password reset emails  
// - Email verification codes
// - MFA backup codes
```

---

### SMS Providers

| Endpoint | What It Does | User Impact | Admin Use Case |
|----------|--------------|-------------|----------------|
| **AddSMSProviderTwilio** | Configure SMS sending | Receives SMS codes | "Enable SMS 2FA via Twilio" |
| **UpdateSMSProviderTwilio** | Update SMS settings | Different phone number | "Switch to new Twilio number" |
| **ActivateSMSProvider** | Enable SMS | Can use SMS 2FA | "Make Twilio config live" |
| **RemoveSMSProvider** | Delete SMS config | No more SMS codes | "Remove old provider" |

**Real-World Scenario:**
```
Problem: Company wants SMS 2FA for executives
Solution: Configure Twilio with company phone number
Result: Executives receive codes: "Your code is 123456"
```

---

### Identity Providers (SSO)

| Endpoint | What It Does | User Experience | Admin Purpose |
|----------|--------------|-----------------|---------------|
| **AddOIDCIDP** | Add Google/Azure AD login | "Sign in with Google" button | "Enable Google Workspace SSO" |
| **AddOAuthIDP** | Add GitHub/GitLab login | "Sign in with GitHub" button | "Let developers use GitHub" |
| **UpdateIDP** | Change IDP settings | Button name changes | "Rebrand to 'Company SSO'" |
| **RemoveIDP** | Delete SSO provider | Button disappears | "Decommission old Azure AD" |

**SSO Examples:**

**Google Workspace:**
```javascript
AddOIDCIDP({
  name: 'Google Workspace',
  issuer: 'https://accounts.google.com',
  clientId: '123.apps.googleusercontent.com',
  clientSecret: 'GOCSPX-...',
  isAutoCreation: true  // Auto-create accounts
});
```
**User sees:** "Sign in with Google" button  
**Result:** Employees click button, no password needed

**GitHub (Developers):**
```javascript
AddOAuthIDP({
  name: 'GitHub',
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  userEndpoint: 'https://api.github.com/user',
  clientId: 'Iv1.abc...',
  clientSecret: 'ghp_...'
});
```
**User sees:** "Sign in with GitHub" button  
**Result:** Developers authenticate with GitHub accounts

---

### Login & Branding Policies

| Policy Type | What It Controls | User Impact | Admin Decision |
|-------------|------------------|-------------|----------------|
| **LoginPolicy** | Login requirements | Must use MFA, can self-register | "Force MFA for everyone" |
| **LabelPolicy** | Visual branding | Colors, logo, fonts | "Match company branding" |
| **PrivacyPolicy** | Legal links | Terms, privacy links | "Add GDPR-compliant links" |
| **LockoutPolicy** | Account lockout | Locked after 5 failed attempts | "Lock after 3 attempts" |

**Login Policy Configuration:**
```javascript
UpdateDefaultLoginPolicy({
  forceMfa: true,              // Everyone MUST use MFA
  allowRegister: false,        // No self-registration
  allowUsernamePassword: true, // Passwords allowed
  allowExternalIdp: true,      // SSO allowed
  hidePasswordReset: false,    // Show "Forgot password?"
  passwordCheckLifetime: '5m'  // Re-verify password after 5min
});
```

**Before:** Users could skip MFA, self-register  
**After:** All users forced to enable MFA, admin must invite

**Branding Example:**
```javascript
UpdateLabelPolicy({
  primaryColor: '#FF6B35',     // Company orange
  logoUrl: 'https://cdn.acme.com/logo.png',
  fontUrl: 'https://fonts.googleapis.com/css?family=Inter',
  disableWatermark: true       // Remove "Powered by ZITADEL"
});
```

**Before:** Generic ZITADEL branding  
**After:** Login page matches company website

**Lockout Policy:**
```javascript
UpdateLockoutPolicy({
  maxPasswordAttempts: 3,  // Lock after 3 wrong passwords
  maxOtpAttempts: 3,       // Lock after 3 wrong OTP codes
  showLockOutFailures: true // Tell user attempts remaining
});
```

**User experience:**
1. Wrong password: "2 attempts remaining"
2. Wrong password: "1 attempt remaining"
3. Wrong password: "Account locked. Contact admin."

---

## Instance Service
**Who uses it:** Platform operators in multi-tenant setup  
**Purpose:** Manage isolated customer instances

| Endpoint | What It Does | Platform Scenario |
|----------|--------------|-------------------|
| **SetupInstance** | Create new instance | "Customer signed up, provision instance" |
| **ListInstances** | List all instances | "Show 500 customer instances" |
| **GetInstance** | Get instance details | "Lookup Acme Corp configuration" |
| **RemoveInstance** | Delete instance | "Customer churned, delete all data" |
| **AddInstanceDomain** | Add custom domain | "Enable auth.acme.com" |
| **SetDefaultInstanceDomain** | Set primary domain | "Switch to custom domain" |
| **SetInstanceFeatures** | Enable features | "Upgrade to Enterprise features" |
| **AddInstanceMember** | Add platform admin | "Make John an IAM admin" |

**Multi-Tenant Example:**
```
SaaS Platform: auth.yourplatform.com

Customer A (Acme Corp):
- Instance: instance_abc123
- Domain: acme.yourplatform.com
- Custom: auth.acme.com
- Features: [SSO, Actions, Custom Schema]
- Users: 5,000 employees

Customer B (TechStart):
- Instance: instance_xyz789
- Domain: techstart.yourplatform.com
- Features: [Basic Login]
- Users: 50 employees

Each instance is completely isolated
```

---

## User Service
**Who uses it:** HR, admins, user management systems  
**Purpose:** Manage user accounts and profiles

### User Lifecycle

| Endpoint | What It Does | HR Example | User Example |
|----------|--------------|------------|--------------|
| **AddHumanUser** | Create user account | "New hire John, create account" | - |
| **AddMachineUser** | Create service account | "CI/CD needs API access" | - |
| **UpdateUser** | Change username | "Employee changed name" | - |
| **DeactivateUser** | Suspend account | "On medical leave" | Can't log in |
| **ReactivateUser** | Restore account | "Returned from leave" | Can log in again |
| **LockUser** | Security lock | "Compromised password" | Account locked |
| **UnlockUser** | Remove lock | "Issue resolved" | Can log in |
| **RemoveUser** | Delete permanently | "Employee left" | All data deleted |

**Onboarding Flow:**
```javascript
// 1. HR creates account
AddHumanUser({
  userName: 'john.doe',
  email: 'john@company.com',
  firstName: 'John',
  lastName: 'Doe',
  password: 'TempPass123!',
  requirePasswordChange: true
});

// 2. John logs in first time
//    - Must change password
//    - Can set up MFA

// 3. HR assigns to groups/roles
AddUserGrant({
  userId: 'john-id',
  projectId: 'project-id',
  roleKeys: ['employee', 'developer']
});
```

**Offboarding Flow:**
```javascript
// Day 1: Employee gives notice
DeactivateUser({ userId: 'john-id' });
// Can't log in, but data retained

// Day 30: Final day
RemoveUser({ userId: 'john-id' });
// Permanently deleted per policy
```

---

### Profile Management

| Endpoint | What It Does | When Used |
|----------|--------------|-----------|
| **SetUserProfile** | Update name, gender, language | "Got married, change last name" |
| **SetUserEmail** | Change email address | "Switched departments" |
| **VerifyEmail** | Confirm email with code | "Verify new email" |
| **SetUserPhone** | Add phone number | "Set up SMS 2FA" |
| **VerifyPhone** | Confirm phone with code | "Verify phone number" |
| **RemoveUserPhone** | Delete phone number | "No longer want SMS codes" |

---

### Authentication Factors (MFA)

| Endpoint | What It Does | User Benefit |
|----------|--------------|--------------|
| **AddOTPSMS** | Enable SMS codes | Receive codes via text |
| **AddOTPEmail** | Enable email codes | Receive codes via email |
| **AddTOTP** | Add authenticator app | Use Google Authenticator |
| **AddU2F** | Add security key | Use YubiKey |
| **AddPasswordless** | Add Face ID/Touch ID | Login without password |

**MFA Setup Flow:**
```javascript
// User adds TOTP (Google Authenticator)
const totp = await AddTOTP({ userId: 'user-id' });

// Returns:
{
  secret: 'JBSWY3DPEHPK3PXP',
  qrCode: 'otpauth://totp/ZITADEL:john@company.com?secret=...'
}

// User scans QR code
// Enters verification code: "123456"
VerifyTOTP({ userId: 'user-id', code: '123456' });

// TOTP enabled!
// Next login requires app code
```

---

### Metadata (Custom Fields)

| Endpoint | What It Does | Use Case |
|----------|--------------|----------|
| **SetUserMetadata** | Store custom data | "Save department: Engineering" |
| **GetUserMetadata** | Retrieve custom data | "Check user's cost center" |
| **ListUserMetadata** | Get all metadata | "Show all custom fields" |
| **RemoveUserMetadata** | Delete custom field | "Remove temporary flag" |

**Example:**
```javascript
// Store HR data
SetUserMetadata({
  userId: 'john-id',
  key: 'department',
  value: 'Engineering'
});

SetUserMetadata({
  userId: 'john-id',
  key: 'costCenter',
  value: 'CC-1234'
});

// Later retrieve
GetUserMetadata({ userId: 'john-id', key: 'department' });
// Returns: "Engineering"
```

---

## Organization Service
**Who uses it:** Tenant admins, department managers  
**Purpose:** Manage organization (tenant) settings

| Endpoint | What It Does | Manager Use Case |
|----------|--------------|------------------|
| **AddOrganization** | Create organization | "Create 'Engineering Dept' org" |
| **UpdateOrganization** | Change org name | "Rebrand to new name" |
| **DeactivateOrganization** | Suspend org | "Project on hold" |
| **RemoveOrganization** | Delete org | "Department dissolved" |
| **AddOrganizationDomain** | Add domain | "Add engineering.company.com" |
| **VerifyOrganizationDomain** | Prove ownership | "Add DNS TXT record" |
| **SetPrimaryOrganizationDomain** | Set default domain | "Use new domain" |
| **AddOrganizationMember** | Add member | "Make Sarah an org admin" |
| **UpdateOrganizationMember** | Change roles | "Promote to manager" |

**Multi-Domain Example:**
```javascript
// Company has multiple domains
AddOrganizationDomain({ domain: 'acme.com' });
AddOrganizationDomain({ domain: 'acmecorp.com' });
AddOrganizationDomain({ domain: 'acme.co.uk' });

// Users can login with:
// - john@acme.com
// - sarah@acmecorp.com  
// - david@acme.co.uk

// All belong to same organization
```

---

## Auth Service (Authenticated User APIs)
**Who uses it:** End users (logged in)  
**Purpose:** Users manage their own accounts

| Endpoint | What USER Does |
|----------|----------------|
| **GetMyUser** | "Show my profile" |
| **UpdateMyUserProfile** | "Change my name" |
| **UpdateMyUserEmail** | "Change my email" |
| **VerifyMyUserEmail** | "Enter verification code" |
| **UpdateMyUserPhone** | "Add phone number" |
| **RemoveMyUser** | "Delete my account (GDPR)" |
| **ListMySessions** | "See where I'm logged in" |
| **TerminateSession** | "Log out my phone" |
| **ListMyUserGrants** | "What apps can I access?" |
| **GetMyZitadelPermissions** | "What can I do?" |

**User Self-Service Example:**
```javascript
// User changes their own email
UpdateMyUserEmail({ email: 'newemail@company.com' });

// Receives code: "123456"
VerifyMyUserEmail({ code: '123456' });

// Email updated!
```

**Session Management:**
```javascript
// User sees active sessions
ListMySessions();

// Returns:
[
  { id: 'session1', userAgent: 'Chrome/Windows', createdAt: '1 hour ago' },
  { id: 'session2', userAgent: 'Safari/iPhone', createdAt: '2 days ago' },
  { id: 'session3', userAgent: 'Firefox/Mac', createdAt: '1 week ago' }
]

// User: "I don't recognize Firefox/Mac"
TerminateSession({ sessionId: 'session3' });

// That device logged out immediately
```

---

## OIDC/OAuth2 Service
**Who uses it:** Applications, developers  
**Purpose:** OAuth/OpenID Connect authentication

### Core OAuth Endpoints

| Endpoint | What It Does | Developer Use |
|----------|--------------|---------------|
| **/.well-known/openid-configuration** | Discovery metadata | "Where's the auth endpoint?" |
| **/.well-known/jwks.json** | Public keys | "Verify JWT signatures" |
| **/oauth/authorize** | Start login | "Redirect user to login" |
| **/oauth/token** | Exchange code for token | "Get access token" |
| **/oauth/userinfo** | Get user profile | "Show user's name/email" |
| **/oauth/introspect** | Check token validity | "Is this token still valid?" |
| **/oauth/revoke** | Revoke token | "Log out" |

**OAuth Authorization Code Flow:**
```
1. App redirects user:
   GET /oauth/authorize?
     client_id=abc123&
     redirect_uri=https://app.com/callback&
     response_type=code&
     scope=openid email profile

2. User logs in, consents

3. ZITADEL redirects back:
   https://app.com/callback?code=xyz789

4. App exchanges code:
   POST /oauth/token
   {
     grant_type: 'authorization_code',
     code: 'xyz789',
     client_id: 'abc123',
     client_secret: 'secret',
     redirect_uri: 'https://app.com/callback'
   }

5. Receives tokens:
   {
     access_token: 'eyJhbGc...',
     id_token: 'eyJhbGc...',
     refresh_token: 'abc123...',
     expires_in: 3600
   }

6. Get user info:
   GET /oauth/userinfo
   Authorization: Bearer eyJhbGc...

7. Receives:
   {
     sub: 'user123',
     email: 'john@company.com',
     name: 'John Doe',
     email_verified: true
   }
```

---

### Advanced OAuth Features

#### Device Authorization (RFC 8628)
**What it is:** Login flow for devices without browsers (TVs, CLI tools)  
**When used:** Smart TVs, IoT devices, terminal applications

**Flow:**
```
1. Device requests code:
   POST /oauth/device_authorization
   Response: {
     device_code: 'abc123',
     user_code: 'WDJB-MJHT',
     verification_uri: 'https://auth.company.com/device'
   }

2. Device shows: "Go to auth.company.com/device and enter: WDJB-MJHT"

3. User visits URL on phone/computer, enters code

4. Device polls for token:
   POST /oauth/token
   {
     grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
     device_code: 'abc123',
     client_id: 'cli-tool'
   }

5. Initially: { error: 'authorization_pending' }
   
6. After user approves: { access_token: '...', ... }

7. Device authenticated!
```

**Real-World:** GitHub CLI, AWS CLI, Smart TV apps

---

#### Dynamic Client Registration (RFC 7591)
**What it is:** Applications self-register without admin intervention  
**When used:** Developer platforms, multi-tenant SaaS

**Example:**
```javascript
// Developer registers their app
POST /oauth/register
{
  redirect_uris: ['https://myapp.com/callback'],
  client_name: 'My Cool App',
  application_type: 'web',
  grant_types: ['authorization_code'],
  response_types: ['code']
}

// Receives credentials
{
  client_id: 'auto-generated-id',
  client_secret: 'auto-generated-secret',
  client_id_issued_at: 1730476800,
  client_secret_expires_at: 0
}

// App can immediately use OAuth!
```

**Real-World:** Like GitHub OAuth Apps - developers self-register

---

#### Pushed Authorization Requests (PAR, RFC 9126)
**What it is:** Send OAuth parameters securely via POST instead of URL  
**When used:** High-security applications, prevent parameter tampering

**Without PAR (parameters in URL):**
```
❌ GET /oauth/authorize?
    client_id=abc&
    redirect_uri=https://app.com/callback&
    scope=openid%20email%20profile&
    state=xyz&
    nonce=123&
    code_challenge=abc...&
    code_challenge_method=S256

Problem: 2000+ character URL, visible in logs
```

**With PAR (parameters sent securely):**
```
✅ Step 1: POST /oauth/par
{
  client_id: 'abc',
  redirect_uri: 'https://app.com/callback',
  scope: 'openid email profile',
  state: 'xyz',
  nonce: '123',
  code_challenge: 'abc...',
  code_challenge_method: 'S256'
}

Response: {
  request_uri: 'urn:ietf:params:oauth:request_uri:abc123',
  expires_in: 90
}

✅ Step 2: GET /oauth/authorize?
    client_id=abc&
    request_uri=urn:ietf:params:oauth:request_uri:abc123

Result: Short URL, parameters secure
```

**Real-World:** Banking apps, government portals

---

#### DPoP (Demonstration of Proof of Possession, RFC 9449)
**What it is:** Bind access tokens to specific devices  
**When used:** Prevent token theft/replay attacks

**Without DPoP:**
```
❌ Attacker steals access token from network
❌ Can use token from any device
```

**With DPoP:**
```
✅ App generates key pair
✅ Each request includes proof (signed with private key)
✅ Token bound to that device
✅ Stolen token useless without private key
```

**Real-World:** Mobile banking, high-value transactions

---

## Summary: Who Uses What?

| Role | Primary APIs | Example Tasks |
|------|--------------|---------------|
| **Platform Admin** | Admin, Instance | Configure email, enable features, manage customers |
| **Tenant Admin** | Organization, User | Manage company users, configure SSO |
| **HR/IT** | User Service | Create accounts, offboard employees |
| **End User** | Auth Service | Update profile, manage sessions, delete account |
| **Developer** | OIDC/OAuth2 | Integrate apps, implement SSO |
| **Security Team** | Admin Policies | Enforce MFA, configure lockouts, audit |

---

## Quick Decision Guide

**Need to...**
- Send emails? → Configure Email Provider (Admin)
- Enable SMS 2FA? → Configure SMS Provider (Admin)
- Add Google SSO? → Add OIDC IDP (Admin)
- Create user accounts? → User Service
- Let users self-manage? → Auth Service
- Integrate your app? → OIDC/OAuth2
- Manage customers? → Instance Service
- Configure login rules? → Login Policy (Admin)
- Brand login page? → Label Policy (Admin)

---

**Need more details?** Check the specific endpoint implementation in:
- `src/api/grpc/admin/v1/admin_service.ts`
- `src/api/grpc/instance/v2/instance_service.ts`
- `src/api/grpc/user/v1/user_service.ts`
- `src/api/oidc/router.ts`
