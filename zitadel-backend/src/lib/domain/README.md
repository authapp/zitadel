# Domain Module

Complete domain model implementation for Zitadel TypeScript backend, following Domain-Driven Design (DDD) principles and matching the Zitadel Go v2 architecture.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Module Structure](#module-structure)
- [Core Concepts](#core-concepts)
- [Domain Entities](#domain-entities)
- [Value Objects](#value-objects)
- [Aggregates](#aggregates)
- [Policies](#policies)
- [Services](#services)
- [Usage Examples](#usage-examples)

## 🎯 Overview

The domain module represents the **core business logic layer** of Zitadel. It contains:

- **Domain Entities**: Core business objects (Organization, User, Project, Application, etc.)
- **Value Objects**: Immutable objects representing domain concepts (Email, Phone, Profile, etc.)
- **Aggregates**: Event-sourced aggregate roots that handle state reconstruction
- **Policies**: Business rules and constraints (Password policies, Login policies, etc.)
- **Domain Services**: Complex business logic that doesn't belong to a single entity

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Domain Entities                          │  │
│  │  Organization, User, Project, Application, Session   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Value Objects                            │  │
│  │  Email, Phone, Profile, Address, Role, DomainName    │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Aggregates                               │  │
│  │  OrganizationAggregate, UserAggregate, etc.           │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Policies                                 │  │
│  │  Password, Login, Domain, Label, Privacy             │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Domain Services                          │  │
│  │  PasswordService, DomainService                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Module Structure

```
src/lib/domain/
├── types.ts                          # Core types and enums
├── value-objects.ts                  # Immutable value objects
├── policies.ts                       # Business policies
│
├── entities/                         # Domain entities
│   ├── organization.ts              # Organization entity
│   ├── user.ts                      # User entities (Human/Machine)
│   ├── project.ts                   # Project entity
│   ├── application.ts               # Application entities (OIDC/API/SAML)
│   ├── instance.ts                  # Instance entity
│   └── session.ts                   # Session entity
│
├── aggregates/                       # Event-sourced aggregates
│   ├── organization-aggregate.ts    # Org aggregate with event handlers
│   ├── user-aggregate.ts            # User aggregate with event handlers
│   └── project-aggregate.ts         # Project aggregate with event handlers
│
├── services/                         # Domain services
│   ├── password-service.ts          # Password validation/hashing
│   └── domain-service.ts            # Domain validation/verification
│
├── mappers/                          # Entity mappers
│   ├── object-details-mapper.ts     # ObjectDetails conversions
│   └── entity-mapper.ts             # Entity <-> DTO mappings
│
└── index.ts                          # Module exports
```

## 🔑 Core Concepts

### Domain-Driven Design Principles

1. **Entities**: Objects with identity that persist over time
2. **Value Objects**: Immutable objects defined by their attributes
3. **Aggregates**: Cluster of entities treated as a single unit
4. **Domain Services**: Operations that don't naturally fit in entities
5. **Policies**: Business rules that govern behavior

### Event Sourcing

All aggregates reconstruct their state from events:

```typescript
const aggregate = new OrganizationAggregate(orgID);
aggregate.applyEvents(events);
const org = aggregate.getOrganization();
```

## 🏢 Domain Entities

### Organization

Represents a tenant/company in the multi-tenant system.

```typescript
import { Organization, OrgState, OrgDomain } from '@/domain/entities/organization';

const org = new Organization(
  'org-123',
  'instance-id',
  'ACME Corporation',
  OrgState.ACTIVE,
  'acme.example.com'
);

// Add domain
org.addIAMDomain('zitadel.cloud');

// Set primary domain
org.setPrimaryDomain('acme.com');
```

**Key Features:**
- State management (Active, Inactive, Removed)
- Domain management (primary, verified, validation)
- Member management
- IAM domain generation

### User (Human & Machine)

Two types of users: **Human** (real people) and **Machine** (service accounts).

```typescript
import { HumanUser, MachineUser, UserState } from '@/domain/entities/user';
import { Profile, Email, Phone } from '@/domain/value-objects';

// Human user
const human = new HumanUser(
  'user-123',
  'org-123',
  'john.doe@example.com',
  UserState.ACTIVE,
  new Profile('John', 'Doe'),
  new Email('john.doe@example.com', true),
  new Phone('+1234567890', false)
);

// Machine user
const machine = new MachineUser(
  'machine-123',
  'org-123',
  'api-service',
  UserState.ACTIVE,
  'API Service Account',
  'Service for API access'
);
```

**Key Features:**
- Human: Profile, email, phone, address, password
- Machine: Name, description, access token type
- Authentication methods tracking
- State management
- User grants (project access)

### Project

Represents an application/service boundary.

```typescript
import { Project, ProjectState, ProjectRole } from '@/domain/entities/project';

const project = new Project(
  'project-123',
  'org-123',
  'Customer Portal',
  ProjectState.ACTIVE
);

// Add role
project.addRole(new ProjectRole(
  'project-123',
  'ADMIN',
  'Administrator',
  'Management'
));

// Validate roles
const isValid = project.validateRoleKeys(['ADMIN', 'USER']);
```

**Key Features:**
- Project roles definition
- Project grants (cross-org sharing)
- Project members
- Role assertion settings

### Application

Three types: **OIDC**, **API**, and **SAML**.

```typescript
import { 
  OIDCApplication, 
  OIDCGrantType, 
  OIDCResponseType 
} from '@/domain/entities/application';

const app = new OIDCApplication(
  'project-123',
  'org-123',
  'app-123',
  'project-123',
  'Web App',
  AppState.ACTIVE,
  'client-id-123',
  'client-secret',
  ['https://app.example.com/callback'],
  ['https://app.example.com'],
  [OIDCResponseType.CODE],
  [OIDCGrantType.AUTHORIZATION_CODE, OIDCGrantType.REFRESH_TOKEN]
);

// Validate redirect URI
const isValid = app.isRedirectURIValid('https://app.example.com/callback');
```

### Instance

Multi-tenant root entity.

```typescript
import { Instance, InstanceState } from '@/domain/entities/instance';

const instance = new Instance(
  'instance-123',
  'system',
  'Zitadel Instance',
  InstanceState.ACTIVE
);
```

### Session

User authentication session.

```typescript
import { Session, SessionState, SessionFactor } from '@/domain/entities/session';

const session = new Session(
  'session-123',
  'org-123',
  'user-123',
  SessionState.ACTIVE
);

// Add authentication factor
session.addFactor(new SessionFactor(AuthMethodType.PASSWORD, true));

// Check MFA level
const mfaLevel = session.getMFALevel();
```

## 💎 Value Objects

Value objects are immutable and defined by their attributes.

### Email

```typescript
import { Email } from '@/domain/value-objects';

const email = new Email('user@example.com', false);
const normalized = email.normalize(); // lowercase, trimmed
const isEqual = email.equals(otherEmail);
```

### Phone

```typescript
import { Phone } from '@/domain/value-objects';

const phone = new Phone('+1234567890', false);
const normalized = phone.normalize(); // removes spaces
```

### Profile

```typescript
import { Profile, Gender, Language } from '@/domain';

const profile = new Profile(
  'John',
  'Doe',
  'John Doe',
  'johnny',
  Language.ENGLISH,
  Gender.MALE
);

const fullName = profile.getFullName(); // "John Doe"
const displayName = profile.getDisplayName(); // "John Doe" or custom
```

### Address

```typescript
import { Address } from '@/domain/value-objects';

const address = new Address(
  'US',
  'New York',
  '10001',
  'NY',
  '123 Main St'
);
```

### DomainName

```typescript
import { DomainName } from '@/domain/value-objects';

const domain = new DomainName('example.com');
const normalized = domain.normalize(); // lowercase
```

### Role

```typescript
import { Role } from '@/domain/value-objects';

const role = new Role('ORG_OWNER', 'Organization Owner', 'Management');
```

## 📦 Aggregates

Aggregates handle event sourcing and state reconstruction.

### OrganizationAggregate

```typescript
import { OrganizationAggregate } from '@/domain/aggregates/organization-aggregate';

const aggregate = new OrganizationAggregate('org-123');

// Apply events to rebuild state
aggregate.applyEvents(events);

// Get current state
if (aggregate.exists()) {
  const org = aggregate.getOrganization();
  console.log(org.name);
}
```

**Supported Events:**
- `org.added`
- `org.changed`
- `org.deactivated`
- `org.reactivated`
- `org.removed`
- `org.domain.added`
- `org.domain.verified`
- `org.domain.primary.set`
- `org.domain.removed`
- `org.member.added/changed/removed`

### UserAggregate

```typescript
import { UserAggregate } from '@/domain/aggregates/user-aggregate';

const aggregate = new UserAggregate('user-123');
aggregate.applyEvents(events);

const user = aggregate.getUser();
if (user.type === UserType.HUMAN) {
  const humanUser = user as HumanUser;
  console.log(humanUser.email.email);
}
```

**Supported Events:**
- `user.human.added` / `user.machine.added`
- `user.username.changed`
- `user.profile.changed`
- `user.email.changed/verified`
- `user.phone.changed/verified/removed`
- `user.address.changed`
- `user.password.changed`
- `user.locked/unlocked`
- `user.deactivated/reactivated`
- `user.removed`

### ProjectAggregate

```typescript
import { ProjectAggregate } from '@/domain/aggregates/project-aggregate';

const aggregate = new ProjectAggregate('project-123');
aggregate.applyEvents(events);

const project = aggregate.getProject();
console.log(project.roles);
```

**Supported Events:**
- `project.added/changed/deactivated/reactivated/removed`
- `project.role.added/changed/removed`
- `project.grant.added/changed/deactivated/reactivated/removed`

## 📜 Policies

Business rules that govern system behavior.

### PasswordComplexityPolicy

```typescript
import { PasswordComplexityPolicy } from '@/domain/policies';

const policy = new PasswordComplexityPolicy(
  8,     // minLength
  true,  // hasUppercase
  true,  // hasLowercase
  true,  // hasNumber
  true   // hasSymbol
);

const isValid = policy.isValid('MyPassword123!');
const error = policy.getValidationError('weak'); // Returns error message
```

### PasswordAgePolicy

```typescript
import { PasswordAgePolicy } from '@/domain/policies';

const policy = new PasswordAgePolicy(
  7,   // expireWarnDays
  90   // maxAgeDays
);

const isExpired = policy.isExpired(passwordChangeDate);
const shouldWarn = policy.shouldWarn(passwordChangeDate);
```

### PasswordLockoutPolicy

```typescript
import { PasswordLockoutPolicy } from '@/domain/policies';

const policy = new PasswordLockoutPolicy(
  5,     // maxPasswordAttempts
  true   // showLockOutFailures
);

const shouldLock = policy.shouldLock(failedAttempts);
const remaining = policy.getRemainingAttempts(failedAttempts);
```

### LoginPolicy

```typescript
import { LoginPolicy, PasswordlessType } from '@/domain/policies';

const policy = new LoginPolicy(
  true,  // allowUsernamePassword
  true,  // allowRegister
  true,  // allowExternalIDP
  false, // forceMFA
  false, // forceMFALocalOnly
  PasswordlessType.ALLOWED
);

const mfaRequired = policy.isMFARequired();
const canRegister = policy.isRegistrationAllowed();
```

### Other Policies

- **DomainPolicy**: Username/domain requirements
- **LabelPolicy**: Branding and UI customization
- **PrivacyPolicy**: Terms, privacy links
- **NotificationPolicy**: Notification preferences
- **MultiFactorPolicy**: MFA enforcement

## 🔧 Services

Domain services for complex business logic.

### PasswordService

```typescript
import { PasswordService, PasswordVerifier } from '@/domain/services/password-service';

// Validate password
PasswordService.validatePassword(password, complexityPolicy);

// Hash password
const hashed = await PasswordService.hashPassword(password);

// Verify password
const isValid = await PasswordService.verifyPassword(password, hashed);

// Generate random password
const randomPassword = PasswordService.generateRandomPassword(16);

// Full verification with policies
const verifier = new PasswordVerifier(agePolicy, lockoutPolicy);
const result = await verifier.verify(
  password,
  hashedPassword,
  passwordChangeDate,
  failedAttempts
);

console.log(result.valid, result.expired, result.shouldLock);
```

### DomainService

```typescript
import { DomainService, DomainVerificationService } from '@/domain/services/domain-service';

// Generate IAM domain
const iamDomain = DomainService.generateIAMDomain('ACME Corp', 'zitadel.cloud');
// Returns: "acme-corp.zitadel.cloud"

// Validate domain
DomainService.validateDomain('example.com');

// Check uniqueness
const isUnique = DomainService.isDomainUnique('example.com', existingDomains);

// Verify domain
const verifier = new DomainVerificationService();
const verified = await verifier.verify(domain, verificationCode);
```

## 📚 Usage Examples

### Creating an Organization with Domain

```typescript
import { 
  Organization, 
  OrgState, 
  OrgDomain,
  DomainValidationType 
} from '@/domain';

const org = new Organization(
  'org-123',
  'instance-id',
  'ACME Corporation',
  OrgState.ACTIVE
);

// Add verified domain
const domain = new OrgDomain(
  'org-123',
  'acme.com',
  true,  // isPrimary
  true,  // isVerified
  DomainValidationType.DNS
);

org.domains.push(domain);
org.primaryDomain = 'acme.com';

// Validate
if (org.isValid() && org.isActive()) {
  console.log('Organization is ready');
}
```

### Creating a Human User

```typescript
import {
  HumanUser,
  UserState,
  Profile,
  Email,
  Phone,
  Address,
  Gender,
  Language
} from '@/domain';

const user = new HumanUser(
  'user-123',
  'org-123',
  'john.doe@example.com',
  UserState.ACTIVE,
  new Profile(
    'John',
    'Doe',
    'John Doe',
    'johnny',
    Language.ENGLISH,
    Gender.MALE
  ),
  new Email('john.doe@example.com', false),
  new Phone('+1234567890', false),
  new Address('US', 'New York', '10001', 'NY', '123 Main St')
);

console.log(user.getDisplayName()); // "John Doe"
console.log(user.isEmailVerified()); // false
```

### Event Sourcing with Aggregates

```typescript
import { OrganizationAggregate } from '@/domain/aggregates/organization-aggregate';
import { Eventstore } from '@/eventstore';

// Load events from eventstore
const events = await eventstore.filter({
  aggregateTypes: ['org'],
  aggregateIDs: ['org-123'],
});

// Rebuild state from events
const aggregate = new OrganizationAggregate('org-123');
aggregate.applyEvents(events);

// Get current state
if (aggregate.exists()) {
  const org = aggregate.getOrganization();
  console.log(`Organization: ${org.name}`);
  console.log(`State: ${org.state}`);
  console.log(`Domains: ${org.domains.length}`);
}
```

### Password Validation with Policies

```typescript
import {
  PasswordService,
  PasswordComplexityPolicy,
  PasswordAgePolicy,
  PasswordLockoutPolicy,
  PasswordVerifier
} from '@/domain';

// Define policies
const complexityPolicy = new PasswordComplexityPolicy(8, true, true, true, true);
const agePolicy = new PasswordAgePolicy(7, 90);
const lockoutPolicy = new PasswordLockoutPolicy(5, true);

// Validate new password
try {
  PasswordService.validatePassword(newPassword, complexityPolicy);
  const hashed = await PasswordService.hashPassword(newPassword);
  // Store hashed password
} catch (error) {
  console.error('Password validation failed:', error.message);
}

// Verify password during login
const verifier = new PasswordVerifier(agePolicy, lockoutPolicy);
const result = await verifier.verify(
  enteredPassword,
  storedHashedPassword,
  passwordChangeDate,
  currentFailedAttempts
);

if (!result.valid) {
  console.log(`Invalid password. ${result.remainingAttempts} attempts remaining`);
  if (result.shouldLock) {
    console.log('Account locked due to too many failed attempts');
  }
} else if (result.expired) {
  console.log('Password has expired. Please change your password');
} else if (result.shouldWarn) {
  console.log('Your password will expire soon');
}
```

## 🎯 Best Practices

1. **Always use value objects** for concepts like Email, Phone, etc.
2. **Validate at entity construction** - entities should always be in valid state
3. **Use aggregates for event sourcing** - don't manually reconstruct state
4. **Apply policies consistently** - use domain services for policy enforcement
5. **Keep entities pure** - no external dependencies, only domain logic
6. **Use mappers** for conversion between layers
7. **Leverage TypeScript types** - type safety is your friend

## 🔗 Integration

The domain module integrates with:

- **Command Layer**: Uses entities and aggregates for write operations
- **Query Layer**: Provides types for read models
- **Event Layer**: Event definitions for aggregates
- **API Layer**: Entity mappers for request/response transformation

## 📝 Summary

**Complete domain implementation with:**

- ✅ 6 Core entities (Organization, User, Project, Application, Instance, Session)
- ✅ 7 Value objects (Email, Phone, Profile, Address, DomainName, Role, Password)
- ✅ 3 Aggregates with full event sourcing support
- ✅ 10+ Policy types for business rules
- ✅ 2 Domain services (Password, Domain)
- ✅ Entity mappers for DTO conversion
- ✅ Complete TypeScript type safety
- ✅ Full Zitadel Go v2 compatibility

**Total**: ~3,000+ lines of production-ready domain code following DDD principles and event sourcing patterns.
