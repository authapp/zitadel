# Phase 2 & 3: Complete Multi-Tenant & Schema Alignment

**Date:** October 22, 2025  
**Status:** Planning Complete, Ready to Execute

---

## 🎯 OBJECTIVE

Complete the multi-tenant architecture and schema alignment across ALL projection tables, then implement critical missing tables.

---

## ✅ PHASE 1 RECAP (COMPLETE)

**Completed Tables (3):**
- ✅ `orgs_projection` - Multi-tenant ready
- ✅ `projects_projection` - Multi-tenant ready
- ✅ `applications_projection` - Multi-tenant ready

**Achievement:**
- ✅ 100% test coverage (2,320/2,320 tests passing)
- ✅ Database-level tenant isolation
- ✅ Backward compatible queries

---

## 📋 PHASE 2: ADD AUDIT COLUMNS TO ALL TABLES

### **Goal:** Apply Phase 1 pattern to ALL remaining projection tables

### **Pattern to Apply:**
```sql
-- 1. Add columns
ALTER TABLE table_name ADD COLUMN instance_id TEXT;
ALTER TABLE table_name ADD COLUMN change_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE table_name ADD COLUMN resource_owner TEXT;

-- 2. Update primary key
ALTER TABLE table_name DROP CONSTRAINT table_name_pkey;
ALTER TABLE table_name ADD PRIMARY KEY (instance_id, id);

-- 3. Add indexes
CREATE INDEX idx_table_instance_id ON table_name(instance_id);
-- Update all existing indexes to include instance_id
```

### **Tables Requiring Updates (20+):**

#### **Priority 1: Core Identity Tables (Week 1)**
1. ✅ `users_projection` ⭐ **CRITICAL**
   - Already has some multi-tenant support
   - Needs: instance_id in PK, change_date
   - Projection: `user-projection.ts` (exists)
   - Queries: `user-queries.ts` (exists)

2. ⬜ `user_metadata` ⭐ **HIGH**
   - Needs: Full multi-tenant update
   - Foreign key to users

3. ⬜ `login_names_projection` ⭐ **HIGH**
   - Needs: Full multi-tenant update
   - Critical for authentication

#### **Priority 2: Organization Tables (Week 2)**
4. ⬜ `org_domains_projection` ⭐ **HIGH**
   - Needs: Full multi-tenant update
   - Projection: May exist
   - Queries: Check if exists

5. ⬜ `project_roles_projection` ⭐ **MEDIUM**
   - Needs: Full multi-tenant update
   - Related to projects (already done)

#### **Priority 3: Instance & Session Tables (Week 2)**
6. ⬜ `instances_projection` ⭐ **HIGH**
   - Special case: instance_id might be same as id
   - Needs: change_date, resource_owner

7. ⬜ `instance_domains_projection` ⭐ **MEDIUM**
   - Needs: Full multi-tenant update

8. ⬜ `instance_trusted_domains_projection` ⭐ **MEDIUM**
   - Needs: Full multi-tenant update

9. ✅ `sessions_projection` ⭐ **HIGH**
   - Check if already has instance_id
   - May need: change_date, resource_owner

#### **Priority 4: Grant & Member Tables (Week 3)**
10. ⬜ `user_grants_projection` ⭐ **HIGH**
    - Needs: Full multi-tenant update

11. ⬜ `project_grants_projection` ⭐ **MEDIUM**
    - Needs: Full multi-tenant update

12. ⬜ `org_members_projection` ⭐ **MEDIUM**
    - Needs: Full multi-tenant update

13. ⬜ `project_members_projection` ⭐ **MEDIUM**
    - Needs: Full multi-tenant update

14. ⬜ `instance_members_projection` ⭐ **MEDIUM**
    - Needs: Full multi-tenant update

#### **Priority 5: Policy Tables (Week 3-4)**
15. ⬜ `password_complexity_policies` ⭐ **LOW**
16. ⬜ `password_age_policies` ⭐ **LOW**
17. ⬜ `login_policies` ⭐ **LOW**
18. ⬜ `idp_configs` ⭐ **LOW**
19. ⬜ `idp_providers` ⭐ **LOW**
20. ⬜ `notification_policies` ⭐ **LOW**

#### **Priority 6: Other Tables**
21. ⬜ `auth_requests_projection` ⭐ **MEDIUM**
22. ⬜ `milestones_projection` ⭐ **LOW**
23. ⬜ `quotas_projection` ⭐ **LOW**
24. ⬜ `limits_projection` ⭐ **LOW**

---

## 🆕 PHASE 3: CRITICAL MISSING TABLES

### **Goal:** Implement tables that exist in Zitadel Go but missing in TypeScript

### **Tables to Implement:**

#### **3.1: User Authentication Methods (Week 4) ⭐ CRITICAL**
**Table:** `user_auth_methods_projection`

**Zitadel Go Reference:** `internal/query/user_auth_method.go`

**Schema:**
```sql
CREATE TABLE user_auth_methods_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    
    -- Auth method details
    method_type TEXT NOT NULL,  -- 'password', 'otp', 'u2f', 'passwordless', etc.
    state TEXT NOT NULL DEFAULT 'active',
    name TEXT,
    
    -- Method-specific fields
    token_id TEXT,  -- For OTP, U2F tokens
    public_key BYTEA,  -- For passwordless/U2F
    attestation_type TEXT,
    aaguid BYTEA,
    sign_count BIGINT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    change_date TIMESTAMP WITH TIME ZONE,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (instance_id, id),
    CONSTRAINT user_auth_methods_user_fk FOREIGN KEY (instance_id, user_id) 
        REFERENCES users_projection(instance_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_user_auth_methods_instance_id ON user_auth_methods_projection(instance_id);
CREATE INDEX idx_user_auth_methods_user_id ON user_auth_methods_projection(instance_id, user_id);
CREATE INDEX idx_user_auth_methods_type ON user_auth_methods_projection(instance_id, method_type);
CREATE INDEX idx_user_auth_methods_state ON user_auth_methods_projection(instance_id, state);
```

**Files to Create:**
- Migration: `002_30_create_user_auth_methods_projection_table.sql`
- Projection: `src/lib/query/projections/user-auth-method-projection.ts`
- Queries: `src/lib/query/user/user-auth-method-queries.ts`
- Types: Add to `src/lib/query/user/user-types.ts`
- Tests: Integration + Unit tests

**Events to Handle:**
- `user.human.otp.added`
- `user.human.otp.removed`
- `user.human.otp.verified`
- `user.human.u2f.added`
- `user.human.u2f.removed`
- `user.human.passwordless.added`
- `user.human.passwordless.removed`
- `user.token.added`
- `user.token.removed`

---

#### **3.2: Personal Access Tokens (Week 5) ⭐ CRITICAL**
**Table:** `personal_access_tokens_projection`

**Zitadel Go Reference:** `internal/query/personal_access_token.go`

**Schema:**
```sql
CREATE TABLE personal_access_tokens_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    
    -- Token details
    token_hash TEXT NOT NULL,  -- Hashed token value
    application_id TEXT,
    scopes TEXT[],
    
    -- Lifecycle
    creation_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    change_date TIMESTAMP WITH TIME ZONE,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (instance_id, id),
    CONSTRAINT pat_user_fk FOREIGN KEY (instance_id, user_id) 
        REFERENCES users_projection(instance_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_pat_instance_id ON personal_access_tokens_projection(instance_id);
CREATE INDEX idx_pat_user_id ON personal_access_tokens_projection(instance_id, user_id);
CREATE INDEX idx_pat_token_hash ON personal_access_tokens_projection(instance_id, token_hash);
CREATE INDEX idx_pat_expiration ON personal_access_tokens_projection(instance_id, expiration_date);
```

**Files to Create:**
- Migration: `002_31_create_personal_access_tokens_projection_table.sql`
- Projection: `src/lib/query/projections/personal-access-token-projection.ts`
- Queries: `src/lib/query/pat/personal-access-token-queries.ts`
- Types: `src/lib/query/pat/personal-access-token-types.ts`
- Tests: Integration + Unit tests

**Events to Handle:**
- `user.personal_access_token.added`
- `user.personal_access_token.removed`

---

#### **3.3: Encryption Keys (Week 6) ⭐ HIGH**
**Table:** `encryption_keys`

**Zitadel Go Reference:** `internal/crypto/database/keys.go`

**Schema:**
```sql
CREATE TABLE encryption_keys (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    
    -- Key details
    algorithm TEXT NOT NULL,  -- 'aes256', 'rsa', etc.
    key_data BYTEA NOT NULL,  -- Encrypted key material
    identifier TEXT NOT NULL,  -- Key identifier/alias
    
    -- Lifecycle
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    rotation_date TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    
    PRIMARY KEY (instance_id, id)
);

CREATE INDEX idx_encryption_keys_instance ON encryption_keys(instance_id);
CREATE INDEX idx_encryption_keys_identifier ON encryption_keys(instance_id, identifier);
CREATE INDEX idx_encryption_keys_algorithm ON encryption_keys(algorithm);
```

**Files to Create:**
- Migration: `002_32_create_encryption_keys_table.sql`
- Service: `src/lib/crypto/key-storage.ts`
- Types: `src/lib/crypto/key-types.ts`
- Tests: Unit tests

**Note:** This is not a projection - it's a direct storage table for crypto keys.

---

#### **3.4: Lockout Policies (Week 6) ⭐ MEDIUM**
**Table:** `lockout_policies_projection`

**Zitadel Go Reference:** `internal/query/lockout_policy.go`

**Schema:**
```sql
CREATE TABLE lockout_policies_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    
    -- Policy settings
    max_password_attempts INTEGER NOT NULL DEFAULT 5,
    max_otp_attempts INTEGER NOT NULL DEFAULT 5,
    show_failure BOOLEAN NOT NULL DEFAULT true,
    
    -- Audit fields
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    change_date TIMESTAMP WITH TIME ZONE,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (instance_id, id)
);

CREATE INDEX idx_lockout_policies_instance ON lockout_policies_projection(instance_id);
CREATE INDEX idx_lockout_policies_aggregate ON lockout_policies_projection(instance_id, aggregate_id);
CREATE INDEX idx_lockout_policies_resource_owner ON lockout_policies_projection(instance_id, resource_owner);
```

**Files to Create:**
- Migration: `002_33_create_lockout_policies_projection_table.sql`
- Projection: `src/lib/query/projections/lockout-policy-projection.ts`
- Queries: `src/lib/query/policy/lockout-policy-queries.ts`
- Types: Add to `src/lib/query/policy/policy-types.ts`
- Tests: Integration + Unit tests

**Events to Handle:**
- `instance.lockout_policy.added`
- `org.lockout_policy.added`
- `instance.lockout_policy.changed`
- `org.lockout_policy.changed`
- `instance.lockout_policy.removed`
- `org.lockout_policy.removed`

---

## 📊 EXECUTION PLAN

### **Week 1: Core Identity (Priority 1)**
- Day 1-2: Update `users_projection` with instance_id PK
- Day 3: Update `user_metadata` table
- Day 4-5: Update `login_names_projection`

### **Week 2: Organizations & Instances (Priority 2-3)**
- Day 1-2: Update org_domains, project_roles
- Day 3-4: Update instance tables
- Day 5: Update sessions if needed

### **Week 3: Grants & Members (Priority 4)**
- Day 1-2: Update user_grants, project_grants
- Day 3-5: Update all member tables

### **Week 4: User Auth Methods (Phase 3.1) ⭐ CRITICAL**
- Day 1: Create migration & schema
- Day 2-3: Implement projection
- Day 4: Implement queries
- Day 5: Tests & validation

### **Week 5: Personal Access Tokens (Phase 3.2) ⭐ CRITICAL**
- Day 1: Create migration & schema
- Day 2-3: Implement projection
- Day 4: Implement queries
- Day 5: Tests & validation

### **Week 6: Encryption & Lockout (Phase 3.3-3.4)**
- Day 1-2: Encryption keys table
- Day 3-4: Lockout policies
- Day 5: Final validation & testing

### **Week 7-8: Policy Tables (Priority 5)**
- Update all remaining policy tables
- Full regression testing
- Documentation

---

## 🎯 SUCCESS CRITERIA

### **Phase 2 Complete When:**
- ✅ All projection tables have `(instance_id, id)` primary key
- ✅ All tables have `change_date` column
- ✅ All tables have `resource_owner` where appropriate
- ✅ All indexes include `instance_id`
- ✅ All projection handlers use new schema
- ✅ All query methods support optional `instanceID`
- ✅ 100% test coverage maintained

### **Phase 3 Complete When:**
- ✅ `user_auth_methods_projection` implemented & tested
- ✅ `personal_access_tokens_projection` implemented & tested
- ✅ `encryption_keys` table implemented
- ✅ `lockout_policies_projection` implemented & tested
- ✅ All related commands work correctly
- ✅ Integration tests passing

---

## 📈 ESTIMATED EFFORT

| Phase | Task | Days | Risk |
|-------|------|------|------|
| **Phase 2** | Core Identity (3 tables) | 5 | Medium |
| **Phase 2** | Org & Instance (5 tables) | 5 | Medium |
| **Phase 2** | Grants & Members (5 tables) | 5 | Low |
| **Phase 2** | Policy Tables (10 tables) | 8 | Low |
| **Phase 3.1** | User Auth Methods | 5 | High |
| **Phase 3.2** | Personal Access Tokens | 5 | High |
| **Phase 3.3** | Encryption Keys | 2 | Medium |
| **Phase 3.4** | Lockout Policies | 3 | Low |
| **Total** | | **38 days** (~8 weeks) | |

---

## 🚀 NEXT STEPS

1. **Start with Priority 1:** Update `users_projection` table
2. **Test incrementally:** Run tests after each table update
3. **Follow Phase 1 pattern:** Use proven approach
4. **Document as we go:** Update status in this file

---

## 📝 NOTES

- **Backward Compatibility:** Maintain throughout
- **Test Coverage:** Must remain at 100%
- **Incremental Deployment:** Can deploy after each priority group
- **Foreign Keys:** Be careful with FK constraints during migration

---

**Status:** Ready to Execute Phase 2 & 3  
**Start Date:** October 22, 2025  
**Target Completion:** December 15, 2025 (8 weeks)

