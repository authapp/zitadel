# 🔧 Infrastructure Improvements Plan

**Date:** November 2, 2025  
**Status:** Documented & Ready for Phase 3 Implementation  
**Total Effort:** ~1 week  
**Priority:** P1 (Production Scalability)

---

## 📋 Executive Summary

Three infrastructure improvements identified during SCIM integration work. Current implementation uses pragmatic temporary solutions (100ms setTimeout). Full production implementation deferred to Phase 3 for focused infrastructure work.

**Key Finding:** Infrastructure foundation already exists! Database schemas and subscription manager are in place. Implementation is primarily wiring and integration work.

---

## ✅ Current Infrastructure Status

### **What Already Exists**

**1. Event Subscription System** ✅
- File: `src/lib/eventstore/subscription.ts` (220 lines)
- `SubscriptionManager` class with async iteration
- `globalSubscriptionManager` singleton
- Eventstore already calls `globalSubscriptionManager.notify(events)` after commits

**2. Database Schemas** ✅
```sql
-- Projection state tracking
projections.projection_states (position, status, error_count, etc.)

-- Distributed locking
public.projection_locks (projection_name, instance_id, acquired_at, expires_at)

-- Failed event retry queue
projections.projection_failed_events (projection_name, failed_sequence, failure_count, error, event_data)
```

**3. Projection Classes** ✅
- ~37 projection classes exist
- All extend `Projection` base class
- All have `reduce(event)` methods
- Ready for subscription integration

---

## 🚀 Improvement 1: Real-Time Event Subscription

### **Problem**
- Projections don't subscribe to events (manual trigger only)
- SCIM handlers use `setTimeout(100ms)` waiting for projections
- No automatic real-time projection updates

### **Solution Architecture**
```typescript
┌─────────────┐      ┌──────────────────┐      ┌────────────────┐
│  Command    │─────>│   Eventstore     │─────>│ Subscription   │
│  Execution  │      │  .push(events)   │      │    Manager     │
└─────────────┘      └──────────────────┘      └────────────────┘
                              │                         │
                              │ commits                 │ notifies
                              ↓                         ↓
                     ┌──────────────────┐      ┌────────────────┐
                     │   PostgreSQL     │      │  Projections   │
                     │     events       │      │  (subscribed)  │
                     └──────────────────┘      └────────────────┘
                                                        │
                                                        │ updates
                                                        ↓
                                               ┌────────────────┐
                                               │  Query Tables  │
                                               └────────────────┘
```

### **Implementation Tasks**

#### **Task 1.1: Update Projection Base Class** (~2 hours)
**File:** `src/lib/query/projection/projection.ts`

**Changes:**
```typescript
export abstract class Projection {
  private subscription?: Subscription;
  private isRunning = false;
  
  // NEW: Start real-time subscription
  async start(ctx: Context): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Build aggregate type map for subscription
    const aggregateTypes = new Map<string, string[]>();
    for (const eventType of this.getEventTypes()) {
      const [aggregateType] = eventType.split('.');
      if (!aggregateTypes.has(aggregateType)) {
        aggregateTypes.set(aggregateType, []);
      }
      aggregateTypes.get(aggregateType)!.push(eventType);
    }
    
    // Subscribe to events
    this.subscription = globalSubscriptionManager.subscribeEventTypes(aggregateTypes);
    
    // Process in background
    this.processSubscription();
    
    // Periodic catch-up for reliability
    this.scheduleCatchUp();
  }
  
  private async processSubscription(): Promise<void> {
    if (!this.subscription) return;
    
    try {
      for await (const event of this.subscription) {
        await this.reduce(event);
      }
    } catch (error) {
      console.error(`Projection ${this.name} subscription error:`, error);
    }
  }
  
  stop(): void {
    this.subscription?.unsubscribe();
    this.isRunning = false;
  }
  
  // NEW: Required for subscription filtering
  abstract getEventTypes(): string[];
}
```

#### **Task 1.2: Update All Projections** (~2 hours)
Add `getEventTypes()` to each projection:

**Example: UserProjection**
```typescript
export class UserProjection extends Projection {
  getEventTypes(): string[] {
    return [
      'user.added',
      'user.changed',
      'user.username.changed',
      'user.removed',
      'user.deactivated',
      'user.reactivated',
      'user.locked',
      'user.unlocked',
      'user.email.changed',
      'user.email.verified',
      'user.phone.changed',
      'user.phone.verified',
      // ... all user events
    ];
  }
}
```

**Files to update:** ~37 projection files (+5-10 lines each)

#### **Task 1.3: Create Projection Manager** (~2 hours)
**File:** `src/lib/query/projection/projection-manager.ts` (NEW)

```typescript
export class ProjectionManager {
  private projections: Map<string, Projection> = new Map();
  
  register(projection: Projection): void {
    this.projections.set(projection.name, projection);
  }
  
  async startAll(): Promise<void> {
    console.log(`Starting ${this.projections.size} projections...`);
    for (const projection of this.projections.values()) {
      await projection.start();
      console.log(`✓ Started ${projection.name}`);
    }
  }
  
  async stopAll(): Promise<void> {
    for (const projection of this.projections.values()) {
      await projection.stop();
    }
  }
  
  getProjection(name: string): Projection | undefined {
    return this.projections.get(name);
  }
}

// Global singleton
export const globalProjectionManager = new ProjectionManager();
```

#### **Task 1.4: Remove setTimeout Hacks** (~1 hour)
**Files:**
- `src/api/scim/handlers/users.ts` - Remove `await new Promise(resolve => setTimeout(resolve, 100))`
- `test/integration/api/scim-users.integration.test.ts` - Remove waits
- Any other handlers with projection waits

**Before:**
```typescript
await commands.addHumanUser(...);
await new Promise(resolve => setTimeout(resolve, 100)); // REMOVE
const user = await queries.user.getUserByID(...);
```

**After:**
```typescript
await commands.addHumanUser(...);
// Projection updates immediately via subscription!
const user = await queries.user.getUserByID(...);
```

**Benefits:**
- ✅ Real-time projection updates (no lag)
- ✅ Cleaner code (no setTimeout hacks)
- ✅ Better scalability
- ✅ Event-driven architecture

---

## 📊 Improvement 2: Projection Status Tracking

### **Problem**
- No way to check if projection has processed an event
- Tests can't wait for specific position
- No visibility into projection health

### **Solution**
Real-time position tracking in `projections.projection_states` table.

### **Implementation Tasks**

#### **Task 2.1: Create ProjectionStateTracker** (~2 hours)
**File:** `src/lib/query/projection/projection-state-tracker.ts` (NEW)

```typescript
export class ProjectionStateTracker {
  constructor(private pool: DatabasePool) {}
  
  async updatePosition(
    projectionName: string,
    position: number,
    event: Event
  ): Promise<void> {
    await this.pool.query(`
      INSERT INTO projections.projection_states 
        (name, position, position_offset, last_processed_at, status, 
         event_timestamp, instance_id, aggregate_type, aggregate_id, sequence)
      VALUES ($1, $2, 0, NOW(), 'running', $3, $4, $5, $6, $7)
      ON CONFLICT (name) DO UPDATE SET
        position = EXCLUDED.position,
        last_processed_at = NOW(),
        status = 'running',
        event_timestamp = EXCLUDED.event_timestamp,
        instance_id = EXCLUDED.instance_id,
        aggregate_type = EXCLUDED.aggregate_type,
        aggregate_id = EXCLUDED.aggregate_id,
        sequence = EXCLUDED.sequence,
        error_count = 0,
        last_error = NULL
    `, [projectionName, position, event.createdAt, event.instanceID, 
        event.aggregateType, event.aggregateID, event.aggregateVersion]);
  }
  
  async getCurrentPosition(projectionName: string): Promise<number | null> {
    const result = await this.pool.queryOne(`
      SELECT position FROM projections.projection_states WHERE name = $1
    `, [projectionName]);
    return result?.position ?? null;
  }
  
  async waitForPosition(
    projectionName: string,
    targetPosition: number,
    timeout = 5000
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const current = await this.getCurrentPosition(projectionName);
      if (current !== null && current >= targetPosition) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(
      `Timeout waiting for ${projectionName} to reach position ${targetPosition}`
    );
  }
  
  async recordFailure(
    projectionName: string,
    event: Event,
    error: Error
  ): Promise<void> {
    // Insert into failed events for retry
    await this.pool.query(`
      INSERT INTO projections.projection_failed_events
        (id, projection_name, failed_sequence, failure_count, error, event_data, instance_id)
      VALUES ($1, $2, $3, 1, $4, $5, $6)
      ON CONFLICT (projection_name, failed_sequence) DO UPDATE SET
        failure_count = projection_failed_events.failure_count + 1,
        error = EXCLUDED.error,
        last_failed = NOW()
    `, [
      `${projectionName}_${event.aggregateVersion}`,
      projectionName,
      event.aggregateVersion,
      error.message,
      JSON.stringify(event),
      event.instanceID
    ]);
    
    // Update projection status
    await this.pool.query(`
      UPDATE projections.projection_states
      SET error_count = error_count + 1, last_error = $2, status = 'error'
      WHERE name = $1
    `, [projectionName, error.message]);
  }
  
  async getStatus(projectionName: string): Promise<ProjectionStatus | null> {
    const result = await this.pool.queryOne(`
      SELECT * FROM projections.projection_states WHERE name = $1
    `, [projectionName]);
    return result ? {
      name: result.name,
      position: result.position,
      status: result.status,
      errorCount: result.error_count,
      lastError: result.last_error,
      lastProcessedAt: result.last_processed_at
    } : null;
  }
}

export interface ProjectionStatus {
  name: string;
  position: number;
  status: string;
  errorCount: number;
  lastError: string | null;
  lastProcessedAt: Date | null;
}
```

#### **Task 2.2: Integrate with Projection Base** (~1 hour)
```typescript
export abstract class Projection {
  protected stateTracker: ProjectionStateTracker;
  
  async reduce(event: Event): Promise<void> {
    try {
      await this.reduceInternal(event);
      
      // Track successful processing
      await this.stateTracker.updatePosition(
        this.name,
        event.position.position,
        event
      );
    } catch (error) {
      // Record failure for retry
      await this.stateTracker.recordFailure(this.name, event, error as Error);
      throw error;
    }
  }
  
  protected abstract reduceInternal(event: Event): Promise<void>;
}
```

#### **Task 2.3: Update Test Helpers** (~1 hour)
Replace setTimeout with proper status checks:

```typescript
// test/helpers/projection-helpers.ts
export async function waitForProjection(
  projectionName: string,
  position: number,
  timeout = 5000
): Promise<void> {
  const tracker = new ProjectionStateTracker(pool);
  await tracker.waitForPosition(projectionName, position, timeout);
}
```

**Benefits:**
- ✅ Reliable test synchronization
- ✅ Projection health monitoring
- ✅ Failed event tracking
- ✅ Production observability

---

## 📧 Improvement 3: Email Verification Flow

### **Problem**
- Email change commands exist but no verification
- No verification code generation
- No email sending integration

### **Implementation Tasks**

#### **Task 3.1: Email Verification Commands** (~2 hours)
**File:** `src/lib/command/user/user-email-verification.ts` (NEW)

```typescript
export class UserEmailVerification {
  constructor(
    private eventstore: Eventstore,
    private crypto: CryptoService,
    private emailService: EmailService
  ) {}
  
  async changeEmailWithCode(
    ctx: Context,
    userID: string,
    email: string,
    options?: { returnCode?: boolean; urlTemplate?: string }
  ): Promise<{ code?: string }> {
    // Generate 6-digit verification code
    const code = this.crypto.generateCode({
      length: 6,
      type: 'numeric',
      expiry: Duration.fromHours(24)
    });
    
    // Create events
    const events = [
      createUserEmailChangedEvent(userID, email),
      createEmailVerificationCodeGeneratedEvent(userID, code.encrypted)
    ];
    
    await this.eventstore.push(ctx, ...events);
    
    // Send verification email (unless test mode)
    if (!options?.returnCode) {
      await this.emailService.sendVerification(
        email,
        code.plain,
        options?.urlTemplate
      );
      return {};
    }
    
    // Test mode: return code for verification
    return { code: code.plain };
  }
  
  async verifyEmail(
    ctx: Context,
    userID: string,
    code: string
  ): Promise<void> {
    const model = await this.loadEmailWriteModel(ctx, userID);
    
    // Verify code matches and not expired
    const isValid = await this.crypto.verifyCode(
      code,
      model.verificationCode,
      model.codeExpiry
    );
    
    if (!isValid) {
      // Record failed attempt
      await this.eventstore.push(
        ctx,
        createEmailVerificationFailedEvent(userID)
      );
      throw new Error('Invalid or expired verification code');
    }
    
    // Mark email as verified
    await this.eventstore.push(
      ctx,
      createEmailVerifiedEvent(userID)
    );
  }
}
```

#### **Task 3.2: Email Service** (~2 hours)
**File:** `src/lib/notification/email-service.ts` (NEW)

Integration with SMTP configs from database, template rendering, retry logic.

#### **Task 3.3: REST Endpoints** (~2 hours)
**File:** `src/api/rest/user/email-verification.ts` (NEW)

- POST `/api/v1/users/:id/email/verify`
- POST `/api/v1/users/:id/email/resend-code`

**Priority:** P2 (not critical for current SCIM work)

---

## 📦 Implementation Summary

| Feature | Effort | Priority | Files Created | Files Modified | Benefit |
|---------|--------|----------|---------------|----------------|---------|
| **Event Subscription** | 2-3 days | P1 | 1 | 38 | Real-time updates |
| **Projection Status** | 1-2 days | P1 | 1 | 2 | Monitoring & testing |
| **Email Verification** | 4-6 hours | P2 | 3 | 1 | User verification |
| **TOTAL** | **~1 week** | **Phase 3** | **5** | **41** | **High** |

---

## 🎯 Recommendation

### **Current Approach** ✅
- Continue with SCIM endpoint integration
- Keep 100ms setTimeout pattern (works reliably)
- No breaking changes needed
- Focus on feature delivery

### **Phase 3 Work** 📅
- Dedicated infrastructure sprint
- Implement all 3 improvements together
- Comprehensive testing
- Performance benchmarking

### **Benefits of Deferral**
1. **Focus:** Complete SCIM integration without distraction
2. **Quality:** Dedicated time for infrastructure work
3. **Testing:** Comprehensive integration testing
4. **Risk:** Lower risk of breaking working code

---

## ✅ Success Criteria

**Phase 3 Implementation Complete When:**
- [ ] All projections subscribe to events automatically
- [ ] Zero setTimeout waits in production code
- [ ] projection_states table actively updated
- [ ] Projection health dashboard available
- [ ] Email verification flow complete
- [ ] 100% test pass rate maintained
- [ ] Performance benchmarks met
- [ ] Documentation updated

---

## 📚 References

**Zitadel Go Implementation:**
- `internal/eventstore/handler/v2/handler.go` - Subscription pattern
- `internal/query/projection/projection.go` - Status tracking
- `internal/command/user_v2_email.go` - Email verification

**Current TypeScript Files:**
- ✅ `src/lib/eventstore/subscription.ts` - Already exists!
- ✅ `src/lib/database/schema/02_projections.sql` - Schema ready!
- ✅ ~37 projection classes - Ready for integration!

---

**Status:** 📋 Documented and ready for Phase 3 implementation  
**Effort:** ~1 week of focused infrastructure work  
**Priority:** P1 for production scalability  
**Current:** 100ms setTimeout workaround is acceptable ✅
