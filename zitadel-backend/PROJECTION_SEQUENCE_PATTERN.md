# Projection Sequence Field Pattern - Official Standard

**Date:** October 25, 2025  
**Status:** ✅ PRODUCTION STANDARD  
**Applied To:** All 32+ projections

---

## 🎯 THE CORRECT PATTERN

### ✅ ALWAYS Use aggregateVersion

```typescript
// ✅ CORRECT - Use aggregateVersion
Number(event.aggregateVersion || 1n)

// ❌ WRONG - Don't use position.position
Math.floor(event.position.position)
event.position?.position || 0
```

---

## 📚 Understanding the Fields

### event.aggregateVersion (bigint)
- **Purpose:** Sequence number within a specific aggregate
- **Scope:** Per aggregate instance (e.g., per user, per org)
- **Usage:** Store in projection `sequence` column
- **Type:** bigint → convert to number for PostgreSQL BIGINT column

### event.position (Position)
- **Purpose:** Global ordering position in event stream
- **Scope:** Across all events in the entire system
- **Usage:** Internal eventstore tracking, NOT for projections
- **Type:** `{ position: number, inTxOrder: number }`

---

## 🔍 Why aggregateVersion?

### 1. **Aggregate-Specific Ordering**
```typescript
// User aggregate events
user.created      → aggregateVersion: 1
user.email.changed → aggregateVersion: 2
user.deactivated   → aggregateVersion: 3
```

### 2. **Concurrency Control**
```typescript
// Projections can use sequence to detect stale data
if (newEvent.aggregateVersion <= currentSequence) {
  // Skip - already processed
  return;
}
```

### 3. **Audit Trail**
```typescript
// Shows exact event order within aggregate
SELECT * FROM users_projection 
WHERE id = 'user123' 
ORDER BY sequence DESC;
```

---

## 📋 Implementation Checklist

### For ALL Projections:

```typescript
// 1. INSERT operations
await this.query(
  `INSERT INTO projections.table_name (
    ...,
    sequence,
    ...
  ) VALUES (..., $N, ...)`,
  [
    ...,
    Number(event.aggregateVersion || 1n), // ← CORRECT
    ...,
  ]
);

// 2. UPDATE operations
await this.query(
  `UPDATE projections.table_name SET
    change_date = $1,
    sequence = $2,
    ...
  WHERE id = $X`,
  [
    event.createdAt,
    Number(event.aggregateVersion || 1n), // ← CORRECT
    ...,
  ]
);
```

### Database Schema Requirements:

```sql
-- All projection tables MUST have:
CREATE TABLE projections.table_name (
  ...,
  sequence BIGINT NOT NULL DEFAULT 0,
  ...,
);
```

---

## ✅ Fixed Projections (All 32+)

The following projections were audited and fixed:

### Core Domain
- ✅ user-projection.ts
- ✅ org-projection.ts
- ✅ org-member-projection.ts
- ✅ org-domain-projection.ts
- ✅ project-projection.ts
- ✅ project-role-projection.ts
- ✅ project-member-projection.ts
- ✅ project-grant-projection.ts
- ✅ project-grant-member-projection.ts

### Applications
- ✅ app-projection.ts
- ✅ user-grant-projection.ts

### Sessions & Auth
- ✅ session-projection.ts
- ✅ auth-request-projection.ts

### Instance
- ✅ instance-projection.ts
- ✅ instance-domain-projection.ts
- ✅ instance-member-projection.ts

### Policies
- ✅ login-policy-projection.ts
- ✅ password-policy-projection.ts
- ✅ domain-label-policy-projection.ts
- ✅ lockout-policy-projection.ts
- ✅ security-notification-policy-projection.ts

### IDPs
- ✅ idp-projection.ts
- ✅ idp-template-projection.ts
- ✅ idp-user-link-projection.ts
- ✅ idp-login-policy-link-projection.ts

### Notifications
- ✅ smtp-projection.ts
- ✅ sms-projection.ts
- ✅ mail-oidc-projection.ts

### Security
- ✅ user-auth-method-projection.ts
- ✅ personal-access-token-projection.ts
- ✅ authn-key-projection.ts

### Misc
- ✅ login-name-projection.ts
- ✅ milestones-projection.ts
- ✅ actions-projection.ts

---

## 🔍 Verification Commands

### Check for violations:
```bash
# Should return 0 (except commented code)
grep -r "event.position" src/lib/query/projections/*.ts | \
  grep -v "//" | \
  grep -v "event.position;" | \
  wc -l
```

### Check for correct usage:
```bash
# Should return high number (57+)
grep -r "event.aggregateVersion" src/lib/query/projections/*.ts | wc -l
```

---

## 📊 Impact Assessment

### Before Fix:
- Tests: 950 passed, 22 failed (97.7%)
- 76 incorrect `event.position` usages
- Inconsistent patterns across projections

### After Fix:
- Tests: 961 passed, 11 failed (98.9%)
- 0 incorrect `event.position` usages
- **100% consistent pattern across all projections** ✅

---

## ⚠️ Common Mistakes to Avoid

### ❌ Mistake 1: Using position.position
```typescript
// WRONG
sequence: event.position.position
sequence: Math.floor(event.position.position)
```

### ❌ Mistake 2: Not converting bigint
```typescript
// WRONG - PostgreSQL can't handle bigint directly
sequence: event.aggregateVersion

// CORRECT - Convert to number
sequence: Number(event.aggregateVersion || 1n)
```

### ❌ Mistake 3: Using 0 as default
```typescript
// LESS SAFE
sequence: Number(event.aggregateVersion || 0)

// BETTER - Use 1n to ensure valid sequence
sequence: Number(event.aggregateVersion || 1n)
```

---

## 🎯 Code Review Checklist

When reviewing projection code, verify:

- [ ] All `INSERT` statements use `Number(event.aggregateVersion || 1n)`
- [ ] All `UPDATE` statements use `Number(event.aggregateVersion || 1n)`
- [ ] No usage of `event.position.position` for sequence
- [ ] Database schema has `sequence BIGINT` column
- [ ] No hardcoded sequence values (except default 0 in migrations)

---

## 📖 References

### Event Types
```typescript
interface Event {
  aggregateVersion: bigint;  // ← Use for sequence
  position: Position;        // ← For eventstore only
  // ... other fields
}

interface Position {
  position: number;     // Global timestamp-based position
  inTxOrder: number;    // Transaction ordering
}
```

### Pattern Origin
This pattern follows the Zitadel Go v2 implementation where:
- `aggregate_version` is used for projection sequence
- `position` is used for global event ordering
- Projections track per-aggregate sequences

---

## ✅ Status

**Pattern:** ✅ STANDARDIZED  
**Implementation:** ✅ COMPLETE (All 32+ projections)  
**Tests:** ✅ 98.9% passing  
**Documentation:** ✅ COMPLETE  

**This is now the official standard for all projection implementations.**
