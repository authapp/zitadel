# Database Schema Detailed Comparison: Zitadel Go vs TypeScript

**Date:** October 22, 2025  
**Purpose:** Compare actual database tables, columns, and indexes

---

## 📊 Summary

| Category | Go Implementation | TypeScript Implementation | Status |
|----------|-------------------|---------------------------|--------|
| **Total Tables** | ~60+ projection tables | ~20 projection tables | 33% coverage |
| **Table Naming** | `projections.*` | `*_projection` | Different convention |
| **Normalization** | More normalized (split tables) | More denormalized (single tables) | Different approach |
| **Indexes** | Extensive (5-10 per table) | Moderate (3-6 per table) | Less coverage |

---

## 🗂️ Table-by-Table Comparison

### 1. Users

#### **Zitadel Go: 4 Tables (Normalized)**

**Table 1: `projections.users14`** (Main user table)
```sql
Columns:
- id TEXT PRIMARY KEY
- creation_date TIMESTAMP
- change_date TIMESTAMP
- sequence BIGINT
- state ENUM
- resource_owner TEXT
- instance_id TEXT
- username TEXT
- type ENUM

Primary Key: (instance_id, id)
Indexes:
- username
- resource_owner
```

**Table 2: `projections.users14_humans`** (Human user details)
```sql
Columns:
- user_id TEXT
- instance_id TEXT
- first_name TEXT
- last_name TEXT
- nick_name TEXT (nullable)
- display_name TEXT (nullable)
- preferred_language TEXT (nullable)
- gender ENUM (nullable)
- avatar_key TEXT (nullable)
- email TEXT
- is_email_verified BOOLEAN (default false)
- phone TEXT (nullable)
- is_phone_verified BOOLEAN (nullable)
- password_change_required BOOLEAN
- password_changed TIMESTAMP (nullable)
- mfa_init_skipped TIMESTAMP (nullable)

Primary Key: (instance_id, user_id)
Foreign Key: → users14(instance_id, id)
Indexes:
- (instance_id, LOWER(email))
```

**Table 3: `projections.users14_machines`** (Machine user details)
```sql
Columns:
- user_id TEXT
- instance_id TEXT
- name TEXT
- description TEXT (nullable)
- secret TEXT (nullable)
- access_token_type ENUM (default 0)

Primary Key: (instance_id, user_id)
Foreign Key: → users14(instance_id, id)
```

**Table 4: `projections.users14_notifications`** (Notification tracking)
```sql
Columns:
- user_id TEXT
- instance_id TEXT
- last_email TEXT (nullable)
- verified_email TEXT (nullable)
- verified_email_lower TEXT (nullable)
- last_phone TEXT (nullable)
- verified_phone TEXT (nullable)
- password_set BOOLEAN (default false)

Primary Key: (instance_id, user_id)
Foreign Key: → users14(instance_id, id)
```

#### **TypeScript: 1 Table (Denormalized)**

**Table: `users_projection`**
```sql
Columns:
- id VARCHAR(255) PRIMARY KEY
- instance_id VARCHAR(255) NOT NULL
- resource_owner VARCHAR(255) NOT NULL
- username VARCHAR(255) NOT NULL
- email VARCHAR(255)
- email_verified BOOLEAN (default false)
- email_verified_at TIMESTAMP WITH TIME ZONE
- phone VARCHAR(50)
- phone_verified BOOLEAN (default false)
- phone_verified_at TIMESTAMP WITH TIME ZONE
- first_name VARCHAR(255)
- last_name VARCHAR(255)
- display_name VARCHAR(255)
- nickname VARCHAR(255)
- preferred_language VARCHAR(10)
- gender VARCHAR(50)
- avatar_url TEXT
- preferred_login_name VARCHAR(255)
- login_names TEXT[] -- Array
- state VARCHAR(50) NOT NULL (default 'active')
- user_type VARCHAR(50) NOT NULL (default 'human')
- password_hash TEXT
- password_changed_at TIMESTAMP WITH TIME ZONE
- password_change_required BOOLEAN (default false)
- mfa_enabled BOOLEAN (default false)
- created_at TIMESTAMP WITH TIME ZONE NOT NULL (default NOW())
- updated_at TIMESTAMP WITH TIME ZONE NOT NULL (default NOW())
- deleted_at TIMESTAMP WITH TIME ZONE

Constraints:
- UNIQUE (instance_id, username)
- UNIQUE (instance_id, email)

Indexes:
- idx_users_projection_instance (instance_id)
- idx_users_projection_resource_owner (resource_owner)
- idx_users_projection_email (email)
- idx_users_projection_login_names GIN(login_names)
- idx_users_projection_state (state)
- idx_users_projection_created_at (created_at DESC)
```

#### **Differences:**
- ❌ Go: **4 normalized tables**, TypeScript: **1 denormalized table**
- ❌ Go: Separate human/machine/notification tables
- ❌ TypeScript: Missing `sequence` column (audit trail)
- ❌ TypeScript: Missing `mfa_init_skipped` timestamp
- ❌ TypeScript: Missing verified_email_lower column
- ✅ TypeScript: Has `login_names` array (convenience)
- ✅ TypeScript: Has `deleted_at` (soft delete support)
- ❌ TypeScript: Missing notification tracking columns

---

### 2. Projects

#### **Zitadel Go**

**Table: `projections.projects4`**
```sql
Columns:
- id TEXT
- creation_date TIMESTAMP
- change_date TIMESTAMP
- sequence BIGINT
- state ENUM
- resource_owner TEXT
- instance_id TEXT
- name TEXT
- project_role_assertion BOOLEAN
- project_role_check BOOLEAN
- has_project_check BOOLEAN
- private_labeling_setting ENUM

Primary Key: (instance_id, id)
Indexes:
- resource_owner
```

#### **TypeScript**

**Table: `projects_projection`**
```sql
Columns:
- id TEXT PRIMARY KEY
- name TEXT NOT NULL
- resource_owner TEXT NOT NULL
- state TEXT NOT NULL (default 'active')
- project_role_assertion BOOLEAN NOT NULL (default false)
- project_role_check BOOLEAN NOT NULL (default false)
- has_project_check BOOLEAN NOT NULL (default false)
- private_labeling_setting TEXT NOT NULL (default 'unspecified')
- created_at TIMESTAMP WITH TIME ZONE NOT NULL
- updated_at TIMESTAMP WITH TIME ZONE NOT NULL
- sequence BIGINT NOT NULL (default 0)

Indexes:
- idx_projects_resource_owner (resource_owner)
- idx_projects_state (state)
- idx_projects_name (name)
- idx_projects_created_at (created_at DESC)
- idx_projects_name_fts GIN(to_tsvector('english', name))
```

#### **Differences:**
- ❌ TypeScript: Missing `instance_id` in primary key (multi-tenancy concern!)
- ❌ TypeScript: Missing `change_date` column
- ✅ TypeScript: Has full-text search index on name
- ✅ TypeScript: Additional state and name indexes

---

### 3. Organizations

#### **Zitadel Go**

**Table: `projections.orgs1`**
```sql
Columns:
- id TEXT
- creation_date TIMESTAMP
- change_date TIMESTAMP
- sequence BIGINT
- state ENUM
- resource_owner TEXT
- instance_id TEXT
- name TEXT
- primary_domain TEXT

Primary Key: (instance_id, id)
Indexes:
- primary_domain
```

#### **TypeScript**

**Table: `orgs_projection`**
```sql
Columns:
- id TEXT PRIMARY KEY
- name TEXT NOT NULL
- state TEXT NOT NULL (default 'active')
- primary_domain TEXT
- created_at TIMESTAMP WITH TIME ZONE NOT NULL
- updated_at TIMESTAMP WITH TIME ZONE NOT NULL
- sequence BIGINT NOT NULL (default 0)

Indexes:
- idx_orgs_name (name)
- idx_orgs_state (state)
- idx_orgs_primary_domain (primary_domain)
- idx_orgs_created_at (created_at DESC)
```

#### **Differences:**
- ❌ TypeScript: Missing `instance_id` column (critical for multi-tenancy!)
- ❌ TypeScript: Missing `resource_owner` column
- ❌ TypeScript: Missing `change_date` column
- ✅ TypeScript: Additional indexes for name and state

---

### 4. Applications

#### **Zitadel Go**

**Table: `projections.apps7`**
```sql
Columns:
- id TEXT
- project_id TEXT
- creation_date TIMESTAMP
- change_date TIMESTAMP
- sequence BIGINT
- state ENUM
- resource_owner TEXT
- instance_id TEXT
- name TEXT
- oidc_version ENUM
- oidc_client_id TEXT
- oidc_client_secret TEXT (encrypted)
- oidc_redirect_uris TEXT[]
- oidc_response_types INT[]
- oidc_grant_types INT[]
- oidc_app_type ENUM
- oidc_auth_method_type ENUM
- oidc_post_logout_redirect_uris TEXT[]
- oidc_is_dev_mode BOOLEAN
- oidc_access_token_type ENUM
- oidc_access_token_role_assertion BOOLEAN
- oidc_id_token_role_assertion BOOLEAN
- oidc_id_token_userinfo_assertion BOOLEAN
- oidc_clock_skew BIGINT
- oidc_additional_origins TEXT[]
- oidc_skip_native_app_success_page BOOLEAN
- api_client_id TEXT
- api_client_secret TEXT (encrypted)
- api_auth_method_type ENUM
- saml_entity_id TEXT
- saml_metadata TEXT
- saml_metadata_url TEXT
... (many more SAML fields)

Primary Key: (instance_id, id)
Indexes:
- project_id
- oidc_client_id
- api_client_id
```

#### **TypeScript**

**Table: `applications_projection`**
```sql
Columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- name TEXT NOT NULL
- state TEXT NOT NULL (default 'active')
- app_type TEXT NOT NULL
- oidc_version TEXT
- oidc_client_id TEXT UNIQUE
- oidc_client_secret TEXT
- oidc_redirect_uris TEXT[]
- oidc_response_types TEXT[]
- oidc_grant_types TEXT[]
- oidc_app_type TEXT
- oidc_auth_method TEXT
- oidc_post_logout_redirect_uris TEXT[]
- oidc_access_token_type TEXT
- oidc_access_token_role_assertion BOOLEAN
- oidc_id_token_role_assertion BOOLEAN
- oidc_id_token_userinfo_assertion BOOLEAN
- oidc_dev_mode BOOLEAN (default false)
- oidc_additional_origins TEXT[]
- api_client_id TEXT
- api_client_secret TEXT
- api_auth_method TEXT
- saml_entity_id TEXT
- saml_metadata_url TEXT
- created_at TIMESTAMP WITH TIME ZONE NOT NULL
- updated_at TIMESTAMP WITH TIME ZONE NOT NULL
- sequence BIGINT NOT NULL (default 0)

Indexes:
- idx_applications_project_id (project_id)
- idx_applications_oidc_client_id (oidc_client_id)
- idx_applications_api_client_id (api_client_id)
- idx_applications_state (state)
- idx_applications_app_type (app_type)
```

#### **Differences:**
- ❌ TypeScript: Missing `instance_id`, `resource_owner`
- ❌ TypeScript: Missing many SAML-specific columns
- ❌ TypeScript: Missing `change_date`
- ❌ TypeScript: Missing `oidc_clock_skew`, `oidc_skip_native_app_success_page`
- ✅ TypeScript: Simplified array types (TEXT[] vs INT[])

---

## 📋 Missing Tables in TypeScript

### Critical Missing Tables

| Go Table | Purpose | Impact |
|----------|---------|--------|
| `projections.user_auth_methods` | Track user authentication methods | **HIGH** - Can't track MFA status |
| `projections.personal_access_tokens3` | API tokens | **HIGH** - No API authentication |
| `projections.keys4` | Encryption keys | **HIGH** - Security concern |
| `projections.lockout_policies3` | Account lockout | **HIGH** - Security gap |
| `projections.password_age_policies2` | Password expiration | **MEDIUM** - Security policy |
| `projections.user_metadata2` | Custom user data | **MEDIUM** - Extensibility |
| `projections.org_metadata2` | Custom org data | **MEDIUM** - Extensibility |
| `projections.device_auth_requests2` | Device OAuth flow | **MEDIUM** - Mobile/TV support |
| `projections.actions3` | Custom actions | **MEDIUM** - Extensibility |
| `projections.executions1` | Action execution | **MEDIUM** - Workflow |
| `projections.flow_triggers3` | Workflow triggers | **MEDIUM** - Automation |

### Additional Missing Tables (25+ more)

- `projections.custom_texts2` - UI translations
- `projections.message_texts2` - Email/SMS templates
- `projections.hosted_login_translations` - Login page i18n
- `projections.milestones3` - Analytics
- `projections.quotas` - Rate limiting
- `projections.limits` - Feature limits
- `projections.restrictions` - Access restrictions
- `projections.organization_settings` - Org config
- `projections.instance_features2` - Feature flags
- `projections.system_features` - System flags
- `projections.notification_providers` - Notification config
- `projections.debug_events` - Debug logging
- `projections.debug_notification` - Debug notifications
- And more...

---

## 🔍 Column-Level Differences

### Common Missing Columns Across Tables

1. **`instance_id`** - Missing in many TypeScript tables
   - **Critical for multi-tenancy!**
   - Go uses composite PK: `(instance_id, id)`
   - TypeScript often uses simple PK: `id`

2. **`sequence`** - Missing or inconsistent
   - Go: `BIGINT` for event ordering
   - TypeScript: Sometimes present, sometimes default 0

3. **`change_date`** - Missing in TypeScript
   - Go: Tracks last modification timestamp
   - TypeScript: Only has `updated_at`

4. **`resource_owner`** - Missing in many TypeScript tables
   - Go: Always present for ownership tracking
   - TypeScript: Sometimes missing

### Data Type Differences

| Go Type | TypeScript Type | Issue |
|---------|-----------------|-------|
| `ENUM` | `TEXT` / `VARCHAR` | Less type safety |
| `INT[]` | `TEXT[]` | Lost numeric array support |
| Encrypted fields | Plain `TEXT` | Security concern? |
| `BIGINT` for dates | `TIMESTAMP` | Different approach |

---

## 🔑 Index Comparison

### Zitadel Go Index Pattern
- **Composite PKs:** Always `(instance_id, id)` for multi-tenancy
- **Foreign Keys:** Explicit FK constraints
- **Covering Indexes:** Many functional indexes like `LOWER(email)`
- **Index Count:** 5-10 per table typically

### TypeScript Index Pattern
- **Simple PKs:** Often just `id`
- **Foreign Keys:** Not always defined
- **Functional Indexes:** Some GIN indexes (FTS, arrays)
- **Index Count:** 3-6 per table typically

### Critical Missing Indexes

1. **Composite Primary Keys with instance_id**
   - TypeScript tables lack multi-tenant isolation at PK level
   
2. **Foreign Key Constraints**
   - TypeScript has fewer FK constraints
   - Could lead to orphaned records

3. **Functional Indexes**
   - Go has more `LOWER()` indexes for case-insensitive search
   - TypeScript relies more on application-level handling

---

## 🎯 Multi-Tenancy Concerns

### **CRITICAL ISSUE**: Missing `instance_id` in Primary Keys

**Zitadel Go Approach:**
```sql
PRIMARY KEY (instance_id, id)
```
- Every table scoped by instance_id
- Perfect tenant isolation at database level
- Prevents cross-tenant data leakage

**TypeScript Current Approach:**
```sql
PRIMARY KEY (id)
```
- Single-tenant primary keys
- Relies on application-level filtering
- **Risk of cross-tenant data access!**

### Affected Tables in TypeScript

Tables missing `instance_id` in PK:
- ✅ `users_projection` - Has instance_id column
- ❌ `projects_projection` - **Missing instance_id!**
- ❌ `orgs_projection` - **Missing instance_id!**
- ❌ `applications_projection` - **Missing instance_id!**
- ✅ `instances_projection` - Has it (naturally)
- And more...

### Recommendation
**Add `instance_id` to ALL projection tables** and update primary keys to composite keys `(instance_id, id)` for proper multi-tenant isolation.

---

## 📊 Schema Design Philosophy Comparison

### Zitadel Go
- **Normalization:** High (separate tables for related entities)
- **Primary Keys:** Composite `(instance_id, id)`
- **Foreign Keys:** Extensive, enforced at DB level
- **Indexes:** Comprehensive (5-10 per table)
- **Type Safety:** Strong (ENUMs, proper types)
- **Multi-Tenancy:** Database-level isolation
- **Approach:** More complex, more constraints

### TypeScript Backend
- **Normalization:** Lower (denormalized single tables)
- **Primary Keys:** Simple `id`
- **Foreign Keys:** Minimal
- **Indexes:** Moderate (3-6 per table)
- **Type Safety:** Moderate (TEXT for many ENUMs)
- **Multi-Tenancy:** Application-level filtering
- **Approach:** Simpler, fewer constraints

---

## ⚠️ Critical Issues

### 1. Multi-Tenancy Risk (CRITICAL)
- TypeScript tables lack `instance_id` in many PKs
- Risk of cross-tenant data access
- **Recommendation:** Add instance_id to all tables, update PKs

### 2. Missing Audit Trail
- Many tables missing `change_date`
- Missing `sequence` numbers in some tables
- **Recommendation:** Standardize audit columns

### 3. Type Safety
- TEXT instead of ENUMs in many places
- Relies on application validation
- **Recommendation:** Use CHECK constraints or ENUMs

### 4. Missing Tables
- 40+ projection tables not implemented
- Core features like PAT, user metadata missing
- **Recommendation:** Implement critical missing tables

### 5. Index Coverage
- Fewer indexes than Go implementation
- May impact query performance
- **Recommendation:** Add missing functional indexes

---

## ✅ What TypeScript Does Well

1. **Denormalization** - Simpler queries, fewer JOINs
2. **Modern Features** - GIN indexes, arrays, JSON, FTS
3. **Timestamp Management** - Automatic `updated_at` triggers
4. **Soft Deletes** - `deleted_at` column pattern
5. **Simplicity** - Easier to understand schema

---

## 🎯 Recommendations

### Immediate (Critical)
1. ✅ **Add `instance_id` to all tables** and update primary keys
2. ✅ **Add missing audit columns** (`change_date`, consistent `sequence`)
3. ✅ **Add FK constraints** for referential integrity
4. ✅ **Implement critical missing tables** (user_auth_methods, PAT, keys)

### Short-term (Important)
5. ✅ Add missing indexes (especially functional indexes)
6. ✅ Convert TEXT to ENUMs where appropriate
7. ✅ Implement metadata tables
8. ✅ Add lockout and password age policies

### Medium-term (Enhancement)
9. Implement remaining 30+ projection tables
10. Add user schemas and custom text tables
11. Implement actions/flows/executions
12. Add quota and limits tables

---

## 📈 Migration Complexity

**Schema Migration Effort:**
- **Add instance_id to existing tables:** 2-3 days
- **Add missing critical tables:** 1-2 weeks
- **Full parity with Go schema:** 3-4 months
- **Testing and validation:** 2-3 weeks

**Risk Level:** MEDIUM-HIGH
- Existing data needs migration
- Application code needs updates
- Multi-tenancy pattern change

---

**Status:** TypeScript backend has ~33% table coverage with simplified schema design. Critical multi-tenancy improvements needed before production use.
