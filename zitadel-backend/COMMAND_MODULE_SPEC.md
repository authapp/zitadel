# Zitadel Command Module - Complete Specification

**Date:** 2025-10-08  
**Based on:** Zitadel Go v2.x  
**Purpose:** Write-side (CQRS) implementation for all business logic

---

## 🎯 Overview

The **Command Module** is the **write-side** of the CQRS architecture. It:
- Creates and validates **business commands**
- Pushes **events** to the eventstore
- Enforces **business rules** and **constraints**
- Manages **aggregate lifecycles**
- Handles **optimistic concurrency**

### Key Principles
- ✅ Commands create events, never directly mutate state
- ✅ Validation before persistence - fail fast
- ✅ Optimistic concurrency via aggregate versions
- ✅ Unique constraints enforced at event level
- ✅ Event sourcing - all changes tracked

---

## 🔗 Dependencies

### Required Infrastructure (Already Implemented ✅)

**1. Eventstore** - Event storage & retrieval
**2. Cache** - Permission & constraint caching  
**3. Static** - File/avatar storage
**4. ID Generator** - Distributed ID generation
**5. Crypto** - Encryption, hashing, code generation

### Required Services (To Implement)

**6. Permission Checker** - RBAC authorization
**7. Domain Validator** - Domain ownership verification
**8. Notification** - Email/SMS sending
**9. WebAuthn** - Passkey/FIDO2 support

---

## 🏗️ Core Architecture

### Commands Class

```typescript
class Commands {
  // Core
  private eventstore: Eventstore;
  private cache: Cache;
  private static: Static;
  private idGenerator: IDGenerator;
  private crypto: CryptoService;
  
  // Config
  private externalDomain: string;
  private zitadelRoles: RoleMapping[];
  private webauthnConfig: WebAuthnConfig;
  
  // Validators
  private checkPermission: PermissionCheck;
  private domainValidator: DomainValidator;
  
  // Methods for each aggregate
  // User, Organization, Project, Application, etc.
}
```

---

## 🔧 Core Patterns

### 1. Write Model Pattern

```typescript
abstract class WriteModel {
  aggregateID: string;
  aggregateType: string;
  aggregateVersion: bigint;
  resourceOwner: string;
  instanceID: string;
  
  abstract reduce(event: Event): void;
}

class UserWriteModel extends WriteModel {
  username?: string;
  state: UserState = UserState.UNSPECIFIED;
  
  reduce(event: Event): void {
    switch (event.eventType) {
      case 'user.created':
        this.username = event.payload.username;
        this.state = UserState.ACTIVE;
        break;
    }
  }
}
```

### 2. Preparation Pattern (v2)

```typescript
type Validation = () => Promise<CreateCommands>;
type CreateCommands = (ctx: Context, filter: FilterToQueryReducer) => Promise<Command[]>;

async function prepareCommands(
  ctx: Context,
  filter: FilterToQueryReducer,
  ...validations: Validation[]
): Promise<Command[]> {
  const creators = await Promise.all(validations.map(v => v()));
  const commands: Command[] = [];
  
  for (const creator of creators) {
    const cmds = await creator(ctx, transactionFilter(filter, commands));
    commands.push(...cmds);
  }
  
  return commands;
}
```

### 3. Command Execution Flow

```typescript
async addUser(data: AddUserData): Promise<ObjectDetails> {
  // 1. Validate input
  await this.validateUser(data);
  
  // 2. Check permissions
  await this.checkPermission(ctx, 'org.user.write', data.orgID);
  
  // 3. Load write model
  const wm = await this.userWriteModel(data.userID, data.orgID);
  if (wm.state !== UserState.UNSPECIFIED) {
    throw alreadyExistsError();
  }
  
  // 4. Create command
  const command: Command = {
    eventType: 'user.created',
    aggregateType: 'user',
    aggregateID: data.userID,
    owner: data.orgID,
    payload: data,
    uniqueConstraints: [
      newAddEventUniqueConstraint('username', data.username),
    ],
  };
  
  // 5. Push to eventstore
  const events = await this.eventstore.push(command);
  
  // 6. Update write model
  await appendAndReduce(wm, ...events);
  
  return writeModelToObjectDetails(wm);
}
```

---

## 📦 Command Groups

### 🏢 Organization (58 commands)
- **Core:** Add, Change, Deactivate, Reactivate, Remove
- **Domains:** Add, Validate, SetPrimary, Remove
- **Members:** Add, Change, Remove
- **Policies:** 12 policy types (Domain, Login, Password, etc.)
- **IDPs:** 8 provider types (OIDC, SAML, Google, GitHub, etc.)
- **Metadata:** Set, BulkSet, Remove, BulkRemove
- **Custom Text:** Login, Message, Init, PasswordReset

### 👤 User (60+ commands)
- **Core:** Add (Human/Machine), Deactivate, Reactivate, Lock, Unlock, Remove
- **Profile:** Change name, avatar, address
- **Email:** Change, Verify, Resend
- **Phone:** Change, Verify, Remove, Resend
- **Password:** Set, Change, RequestReset, SendReset
- **MFA:** OTP (Add, Verify, Remove), WebAuthn (Add, Remove)
- **Machine:** Keys, PATs
- **Grants:** Add, Change, Remove
- **Metadata:** Set, BulkSet, Remove
- **IDP Links:** Add, Remove
- **Schema:** Create, Update, Deactivate, Delete

### 📁 Project (32 commands)
- **Core:** Add, Change, Deactivate, Reactivate, Remove
- **Roles:** Add, Change, Remove, BulkAdd
- **Members:** Add, Change, Remove
- **Grants:** Add, Change, Deactivate, Reactivate, Remove
- **Grant Members:** Add, Change, Remove

### 🎮 Application (18 commands)
- **OIDC:** Add, Update, ChangeSecret, AddRedirectURI, etc.
- **API:** Add, Update, ChangeSecret, AddKey, etc.
- **SAML:** Add, Update, RegenerateCert, UpdateMetadata
- **Keys:** Add, Remove (JWT signing)

### 🔐 Session (8 commands)
- **Core:** Create, Update, Terminate
- **Tokens:** Set, Check
- **Factors:** User, WebAuthn, OTP, IDP Intent
- **Metadata:** Set, Delete

### 🏛️ Instance (50+ commands)
- **Core:** Setup, Create, Update, Remove
- **Domains:** Add, ChangeDefault, Remove
- **Features:** Set, SetDefault, Reset
- **Policies:** All default policies
- **IDPs:** All provider types
- **Custom Text:** All text types
- **SMTP:** Add, Change, Activate, Deactivate, Test, Remove
- **SMS:** Add, Change, Activate, Deactivate, Remove
- **Security:** Add, Change, Remove
- **Members:** Add, Change, Remove

### 🎭 Identity Provider (10 commands)
- **Providers:** OIDC, OAuth, JWT, LDAP, Azure AD, GitHub, GitLab, Google, Apple
- **Intent:** Start, Add, Succeed, Fail (external login flow)

### ⚡ Action v2 (8 commands)
- **Targets:** Add, Update, Change (Name/Endpoint/Timeout/Async), Remove
- **Executions:** Set, Delete, SetInclude, SetExclude

### 🔑 Authentication (6 commands)
- **Requests:** Add, SelectUser, SelectExternalIDP, LinkExternal, AutoRegister
- **Checks:** Password, TOTP, U2F, Passkey

### 📱 Device Authorization (4 commands)
- **Flow:** Add, Approve, Cancel, Remove (OAuth device flow)

### 🎨 Branding (12 commands)
- **Login Text:** Add, Remove, SetDefault
- **Message Text:** Add, Remove, SetDefault
- **Label Policy:** Add, Change, Activate, Remove (logos/icons/fonts)

### 🌍 Domain & Email (8 commands)
- **Email:** Add, Change, Verify, Resend
- **Domain:** Add, GenerateValidation, Validate, SetPrimary, Remove

### 📊 Quota & Limits (4 commands)
- **Quotas:** Add, Set, Remove, SetNotifications

### 🔔 Notification (4 commands)
- **Providers:** Add, Update, Remove
- **Debug:** AddFile, RemoveFile

### 🌊 Flow (3 commands)
- **Actions:** SetTriggerActions, ClearFlow, ClearFlowType

### 📝 Metadata (Generic)
- **Any Aggregate:** Set, BulkSet, Remove, BulkRemove

### 🔧 Crypto & Keys (8 commands)
- **Machine Keys:** Add, Remove
- **App Keys:** Add, Remove
- **PATs:** Add, Remove
- **Secrets:** Hash, Verify

---

## 📈 Implementation Priorities

### Phase 1: Foundation (MVP)
**Duration:** 3 weeks

1. **Infrastructure** (Week 1)
   - Commands class setup
   - Write model base
   - Preparation pattern
   - Validation utilities
   - Permission checking

2. **User Commands** (Week 2)
   - AddHumanUser, AddMachineUser
   - ChangeUsername, ChangeProfile
   - ChangeEmail, VerifyEmail
   - ChangePassword, SetPassword
   - Deactivate, Reactivate, Remove

3. **Organization Commands** (Week 3)
   - AddOrg, ChangeOrg
   - Deactivate, Reactivate, Remove
   - AddMember, ChangeMember, RemoveMember
   - AddDomain, ValidateDomain
   - AddDomainPolicy, AddLoginPolicy

### Phase 2: Projects & Apps (MVP)
**Duration:** 2 weeks

4. **Project Commands** (Week 4)
   - AddProject, ChangeProject
   - AddRole, ChangeRole, RemoveRole
   - AddMember, ChangeMember
   - AddGrant, ChangeGrant

5. **Application Commands** (Week 5)
   - AddOIDCApp, UpdateOIDCApp
   - AddAPIApp, UpdateAPIApp
   - ChangeSecret, AddKey

### Phase 3: Advanced Features
**Duration:** 3 weeks

6. **Session & Auth** (Week 6)
   - Session management
   - Authentication flows
   - MFA support

7. **Instance & Policies** (Week 7)
   - Instance setup
   - Default policies
   - Feature flags

8. **Extended Features** (Week 8)
   - IDPs, Actions, Flows
   - Branding, Custom text
   - Quotas, Notifications

---

## 📊 Complexity Estimates

| Command Group | # Commands | Complexity | Time |
|--------------|-----------|------------|------|
| User | 60+ | High | 2 weeks |
| Organization | 58 | High | 2 weeks |
| Project | 32 | Medium | 1 week |
| Application | 18 | Medium | 1 week |
| Session | 8 | Medium | 3 days |
| Instance | 50+ | High | 2 weeks |
| IDP | 10 | Medium | 3 days |
| Action v2 | 8 | Low | 2 days |
| Auth | 6 | Medium | 3 days |
| Device Auth | 4 | Low | 1 day |
| Branding | 12 | Low | 2 days |
| Domain/Email | 8 | Low | 2 days |
| Others | 30+ | Low-Medium | 1 week |

**Total: ~12-14 weeks for complete implementation**

---

## 📝 Next Steps

1. ✅ Review this specification
2. ⏳ Implement Commands infrastructure
3. ⏳ Start with User commands (highest priority)
4. ⏳ Add integration tests for each command
5. ⏳ Build out remaining aggregates

---

**Status:** ✅ Specification Complete  
**Ready for Implementation:** YES
