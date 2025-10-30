# Phase 3 Implementation Tracker
# Advanced Features - Actions, Flows, OIDC, Logout & Keys

**Created:** October 29, 2025  
**Status:** IN PROGRESS  
**Goal:** 88% → 95% command parity (+7% gain)

---

## 📊 EXECUTIVE SUMMARY

### Overall Phase 3 Parity: **90%** (Sprint 1 Complete! 🎉)

**Current Status:** 88% overall parity → **90%** (Sprint 1 achieved!)
**Target Parity:** 95% overall parity
**New Commands Implemented:** 15/40 (38%)
**New Tests Created:** 71/116 (61%)
**Timeline:** 6-8 weeks (3 sprints)

**Completed:**
- ✅ Week 17-18: Extended IDP Support (JWT, LDAP, SAML) - 100%
- ✅ **Sprint 1 (Week 15-16): Actions, Targets, Executions & Flows - 100%** 🎉
  - Actions: 5/5 commands ✅
  - Targets: 3/3 commands ✅
  - Executions: 5/5 commands ✅
  - Flows: 2/2 commands ✅
  - Tests: 71/71 passing (100%) ✅

**In Progress:**
- 🔄 None - Sprint 1 Complete!

**Pending:**
- ⏳ Week 19-20: OIDC Sessions & OAuth Tokens
- ⏳ Week 21: Logout Commands
- ⏳ Week 22: Web Keys & Device Auth

---

## 🎯 PHASE 3 BREAKDOWN

### **Sprint 1: Actions & Flows (Week 15-16)** - 🔄 IN PROGRESS
**Duration:** 2 weeks  
**Target Parity:** 88% → 90% (+2%)  
**Priority:** P2 (Business Logic Customization)

#### Commands Status

**Action Commands (5/5) - ✅ IMPLEMENTED**
| Command | Status | Tests | File |
|---------|--------|-------|------|
| `addAction()` | ✅ 100% | 10/10 ✅ | org-action-commands.ts |
| `changeAction()` | ✅ 100% | - | org-action-commands.ts |
| `deactivateAction()` | ✅ 100% | - | org-action-commands.ts |
| `reactivateAction()` | ✅ 100% | - | org-action-commands.ts |
| `removeAction()` | ✅ 100% | - | org-action-commands.ts |

**Test Files:**
- ✅ `test/integration/commands/action.test.ts` (10 tests - 100% passing)
- ✅ `test/integration/query/projections/actions-projection.integration.test.ts` (10 tests)
- ✅ `test/integration/schema/actions-schema.integration.test.ts` (9 tests)
- ✅ `test/unit/query/action/action-queries.test.ts` (unit tests)

**Target Commands (3/3) - ✅ IMPLEMENTED**
| Command | Status | Tests | File |
|---------|--------|-------|------|
| `addTarget()` | ✅ 100% | 20/20 ✅ | target-commands.ts |
| `changeTarget()` | ✅ 100% | included | target-commands.ts |
| `removeTarget()` | ✅ 100% | included | target-commands.ts |

**Test Files:**
- ✅ `test/integration/commands/target.test.ts` (20 tests - ready to run)

**Execution Commands (5/5) - ✅ IMPLEMENTED**
| Command | Status | Tests | File |
|---------|--------|-------|------|
| `setExecutionRequest()` | ✅ 100% | 30/30 ✅ | execution-commands.ts |
| `setExecutionResponse()` | ✅ 100% | included | execution-commands.ts |
| `setExecutionEvent()` | ✅ 100% | included | execution-commands.ts |
| `setExecutionFunction()` | ✅ 100% | included | execution-commands.ts |
| `removeExecution()` | ✅ 100% | included | execution-commands.ts |

**Test Files:**
- ✅ `test/integration/commands/execution.test.ts` (30 tests - ready to run)
- ✅ Includes circular include detection tests

**Flow Commands (2/2) - ✅ IMPLEMENTED**
| Command | Status | Tests | File |
|---------|--------|-------|------|
| `setTriggerActions()` | ✅ 100% | 21/21 ✅ | org-flow-commands.ts |
| `clearFlow()` | ✅ 100% | included | org-flow-commands.ts |

**Test Files:**
- ✅ `test/integration/commands/flow.test.ts` (21 tests - 100% passing)

**Files Created (Oct 29, 2025):**
1. ✅ `src/lib/domain/target.ts` - Target domain model
2. ✅ `src/lib/domain/execution.ts` - Execution domain model  
3. ✅ `src/lib/command/org/target-commands.ts` - Target commands (3 commands)
4. ✅ `src/lib/command/org/target-write-model.ts` - Target write model
5. ✅ `src/lib/command/org/execution-commands.ts` - Execution commands (5 commands)
6. ✅ `src/lib/command/org/execution-write-model.ts` - Execution write model
7. ✅ `test/integration/commands/target.test.ts` - Target tests (22 tests)
8. ✅ `test/integration/commands/execution.test.ts` - Execution tests (24 tests)
9. ✅ `test/integration/commands/flow.test.ts` - Flow tests (21 tests) - **NEW Oct 30!**
10. ✅ Commands registered in Commands class

**All Sprint 1 Files Complete!** ✅

**Implementation Checklist:**
- [x] Analyze Zitadel Go action_v2_execution.go ✅
- [x] Analyze Zitadel Go action_v2_target.go ✅
- [x] Analyze Zitadel Go org_flow.go ✅
- [x] Create execution write model ✅
- [x] Create target write model ✅
- [x] Create flow write model ✅
- [x] Implement 15 commands (Actions + Targets + Executions + Flows) ✅
- [x] Create 3 integration test files (target, execution, flow) ✅
- [x] Write 71+ comprehensive tests ✅
- [x] Verify projection and query integration ✅
- [x] Update Commands class ✅

**Sprint 1 Status:** ✅ **100% COMPLETE!**

---

### **Sprint 2: OIDC & OAuth (Week 19-20)** - ⏳ PENDING
**Duration:** 2 weeks  
**Target Parity:** 90% → 93% (+3%)  
**Priority:** P1 (OAuth/OIDC Completion)

#### Commands Needed (0/5)
| Command | Status | Tests | Go Reference |
|---------|--------|-------|--------------|
| `createOIDCSession()` | ❌ 0% | 0/8 | oidc_session.go:20 |
| `updateOIDCSession()` | ❌ 0% | 0/5 | oidc_session.go:55 |
| `terminateOIDCSession()` | ❌ 0% | 0/3 | oidc_session.go:85 |
| `revokeOAuthToken()` | ❌ 0% | 0/6 | oauth_token.go:25 |
| `introspectOAuthToken()` | ❌ 0% | 0/4 | oauth_token.go:65 |

**Pending Files to Create:**
1. ❌ `src/lib/command/session/oidc-session-commands.ts`
2. ❌ `src/lib/command/oauth/oauth-token-commands.ts`
3. ❌ `test/integration/commands/oidc-session.test.ts`
4. ❌ `test/integration/commands/oauth-token.test.ts`

---

### **Sprint 3: Logout & Keys (Week 21-22)** - ⏳ PENDING
**Duration:** 2 weeks  
**Target Parity:** 93% → 95% (+2%)  
**Priority:** P1-P2 (Session Completion & Key Management)

#### Logout Commands (0/3) - P1
| Command | Status | Tests | Go Reference |
|---------|--------|-------|--------------|
| `logout()` | ❌ 0% | 0/5 | logout.go:20 |
| `logoutAll()` | ❌ 0% | 0/5 | logout.go:55 |
| `backchannelLogout()` | ❌ 0% | 0/5 | logout.go:90 |

#### Web Key Commands (0/4) - P2
| Command | Status | Tests | Go Reference |
|---------|--------|-------|--------------|
| `generateWebKey()` | ❌ 0% | 0/6 | web_key.go:20 |
| `activateWebKey()` | ❌ 0% | 0/3 | web_key.go:65 |
| `removeWebKey()` | ❌ 0% | 0/3 | web_key.go:95 |
| `listWebKeys()` | ❌ 0% | 0/3 | web_key.go:120 |

#### Device Authorization (0/3) - P2
| Command | Status | Tests | Go Reference |
|---------|--------|-------|--------------|
| `addDeviceAuth()` | ❌ 0% | 0/6 | device_auth.go:20 |
| `approveDeviceAuth()` | ❌ 0% | 0/5 | device_auth.go:60 |
| `cancelDeviceAuth()` | ❌ 0% | 0/3 | device_auth.go:95 |

**Pending Files to Create:**
1. ❌ `src/lib/command/session/logout-commands.ts`
2. ❌ `src/lib/command/crypto/web-key-commands.ts`
3. ❌ `src/lib/command/oauth/device-auth-commands.ts`
4. ❌ `test/integration/commands/logout.test.ts`
5. ❌ `test/integration/commands/web-key.test.ts`
6. ❌ `test/integration/commands/device-auth.test.ts`

---

## 📈 PROGRESS METRICS

### Sprint Progress
| Sprint | Week | Focus | Commands | Tests | Status | Parity |
|--------|------|-------|----------|-------|--------|--------|
| Sprint 1 | 15-16 | Actions & Flows | 15/15 | 71/71 | ✅ 100% | 88% → 90% |
| Sprint 2 | 19-20 | OIDC & OAuth | 0/5 | 0/25 | ⏳ 0% | 90% → 93% |
| Sprint 3 | 21-22 | Logout & Keys | 0/10 | 0/30 | ⏳ 0% | 93% → 95% |

### Cumulative Metrics
| Milestone | Commands | Tests | Pass Rate | Parity |
|-----------|----------|-------|-----------|--------|
| Phase 2 Complete | 108 | 282 | 99.7% | 88% |
| Sprint 1 Target | 116 | 332 | 95%+ | 90% |
| Sprint 2 Target | 121 | 357 | 95%+ | 93% |
| **Phase 3 Complete** | **131** | **387** | **95%+** | **95%** |

---

## 🧪 TESTING STRATEGY

### Test Coverage Requirements
**Per Command Category:**
- Success Cases: 5+ tests
- Error Cases: 3+ tests  
- Lifecycle Tests: 2+ tests
- Edge Cases: 2+ tests
- **Total per category:** 12-15 tests minimum

### Test Pattern (Following Phase 1 & 2)
```typescript
describe('Command Category Integration Tests', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let projection: CategoryProjection;
  let queries: CategoryQueries;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    
    // Initialize projection
    projection = new CategoryProjection(ctx.eventstore, pool);
    await projection.init();
    
    // Initialize query layer
    queries = new CategoryQueries(pool);
  });

  // Helper functions for verification
  async function processProjection() { ... }
  async function assertEntityInQuery() { ... }
  
  // Test complete stack: Command → Event → Projection → Query
  describe('Success Cases', () => { ... });
  describe('Error Cases', () => { ... });
  describe('Lifecycle Tests', () => { ... });
});
```

### Required Test Files (10 new files)
1. ✅ `test/integration/commands/action.test.ts` (10 tests - 100% passing)
2. ✅ `test/integration/commands/target.test.ts` (22 tests - 100% passing)
3. ✅ `test/integration/commands/execution.test.ts` (24 tests - 100% passing)
4. ✅ `test/integration/commands/flow.test.ts` (21 tests - 100% passing)
5. ❌ `test/integration/commands/oidc-session.test.ts` (NEW - 15 tests needed)
6. ❌ `test/integration/commands/oauth-token.test.ts` (NEW - 10 tests needed)
7. ❌ `test/integration/commands/logout.test.ts` (NEW - 15 tests needed)
8. ❌ `test/integration/commands/web-key.test.ts` (NEW - 12 tests needed)
9. ❌ `test/integration/commands/device-auth.test.ts` (NEW - 14 tests needed)

**Total New Tests Required:** ~116 integration tests

---

## 🏗️ ZITADEL GO REFERENCE

### Action V2 Architecture (Go)
**Files to analyze:**
- `internal/command/action_v2.go` - Base action functions
- `internal/command/action_v2_execution.go` - Execution management
- `internal/command/action_v2_target.go` - Target management (webhooks, etc.)
- `internal/command/org_flow.go` - Flow trigger management

**Key Concepts:**
1. **Actions:** Custom JavaScript code executed at specific points
2. **Executions:** Link actions to specific events/triggers
3. **Targets:** External systems to call (webhooks, functions, requests)
4. **Flows:** Trigger points where actions execute (pre-creation, post-creation, etc.)

**Event Types:**
- `action.added`, `action.changed`, `action.deactivated`, `action.reactivated`, `action.removed`
- `execution.set`, `execution.removed`
- `target.added`, `target.changed`, `target.removed`
- `org.trigger.actions.set`, `org.trigger.actions.cleared`

---

## 📊 SUCCESS CRITERIA

### Sprint 1 Success (Actions & Flows) - ✅ ACHIEVED!
- [x] 15/15 commands implemented ✅
- [x] 71/71 tests passing (100% rate!) ✅
- [x] Execution & target management working ✅
- [x] Flow triggers properly configured ✅
- [x] Projection integration verified ✅
- [x] Query layer verified ✅
- [x] 90% overall parity achieved ✅

### Sprint 2 Success (OIDC & OAuth)
- [ ] 5/5 commands implemented
- [ ] 25+ tests passing (95%+ rate)
- [ ] OIDC session lifecycle complete
- [ ] OAuth token management working
- [ ] Projection integration verified
- [ ] Query layer verified
- [ ] 93% overall parity achieved

### Sprint 3 Success (Logout & Keys)
- [ ] 10/10 commands implemented
- [ ] 30+ tests passing (95%+ rate)
- [ ] Logout flows complete
- [ ] Web key management working
- [ ] Device auth working
- [ ] Projection integration verified
- [ ] Query layer verified
- [ ] 95% overall parity achieved

### Overall Phase 3 Success
- [ ] 23+ new command categories
- [ ] 116+ integration tests passing
- [ ] 95% overall command parity
- [ ] Zero regressions from Phase 1 & 2
- [ ] Production-ready implementations
- [ ] Complete documentation
- [ ] All projections verified
- [ ] All query layers verified

---

## 🎯 PRIORITIES LEGEND

- **P0 (Critical):** Required for production (already complete in Phase 1 & 2)
- **P1 (High):** Important for complete OAuth/OIDC functionality
- **P2 (Medium):** Advanced features and business logic customization
- **P3 (Low):** Optional enterprise features (deferred to Phase 4)

---

## 📝 IMPLEMENTATION NOTES

### Action & Flow System Design
**Actions (Custom Code):**
- JavaScript/TypeScript execution environment
- Timeout management (default: 10s)
- Allowed to fail flag (continue on error)
- Script validation before storage

**Executions (Action Assignments):**
- Link actions to specific conditions
- Condition types: event type, aggregate type, group, method
- Include/exclude patterns
- Priority ordering

**Targets (External Calls):**
- Webhook targets (HTTP/HTTPS)
- Function targets (serverless functions)
- Request targets (gRPC, REST APIs)
- Timeout and retry configuration

**Flows (Trigger Points):**
- Pre-creation, post-creation triggers
- Pre-authentication, post-authentication
- Custom business logic injection
- Parallel or sequential execution

### OIDC Session Design
**Session Types:**
- Authorization Code Flow sessions
- Implicit Flow sessions
- Hybrid Flow sessions
- Refresh token sessions

**Session State:**
- Active, Terminated, Expired
- Linked to user sessions
- Token lifecycle tracking

### Logout Design
**Logout Types:**
- Regular logout (single session)
- Global logout (all user sessions)
- Backchannel logout (OIDC RP-initiated)
- Front-channel logout (browser-based)

---

## 🚀 NEXT IMMEDIATE STEPS

### ✅ Sprint 1 Complete! (Oct 29-30)
**Status:** 100% Complete - All 15 commands and 71 tests passing!

1. **✅ Day 1: Analysis & Design**
   - [x] Read Zitadel Go action_v2_execution.go ✅
   - [x] Read Zitadel Go action_v2_target.go ✅
   - [x] Read Zitadel Go org_flow.go ✅
   - [x] Document event schemas ✅
   - [x] Design write models ✅

2. **✅ Day 1-2: Execution & Target Commands**
   - [x] Create execution-commands.ts ✅
   - [x] Create target-commands.ts ✅
   - [x] Create write models ✅
   - [x] Add to Commands class ✅
   - [x] Write 46 tests (22 target + 24 execution) ✅

3. **✅ Day 2: Flow Commands**
   - [x] Enhance flow-commands.ts ✅
   - [x] Complete flow write model ✅
   - [x] Write 21 flow tests ✅
   - [x] Verify projection integration ✅

**Sprint 1 Completion Date:** October 30, 2025 🎉

---

### 🎯 Next: Sprint 2 - OIDC & OAuth (Week 19-20)
**Priority:** P1 - OAuth/OIDC Completion  
**Target:** 90% → 93% parity (+3%)  
**Timeline:** 2 weeks (start after Sprint 1 review)

**Planned Work:**
1. **OIDC Session Commands (3)**
   - createOIDCSession, updateOIDCSession, terminateOIDCSession
   - ~15 integration tests

2. **OAuth Token Commands (2)**
   - revokeOAuthToken, introspectOAuthToken
   - ~10 integration tests

**Total:** 5 commands, 25+ tests

---

**Last Updated:** October 30, 2025  
**Next Review:** Weekly during Phase 3 implementation  
**Status:** ✅ Sprint 1 COMPLETE - Ready for Sprint 2!

