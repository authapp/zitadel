# Final Restoration Plan - Weeks 13-15

**Status:** Week 15 ✅ Complete | Weeks 13-14 ⏳ In Progress

---

## 🎯 SITUATION

**Current State:**
- ✅ Week 15 commands fully restored and working (10 commands)
- ❌ Week 13-14 test files exist but commands missing
- ❌ 8 test suites failing due to missing commands
- ⏳ Need to restore Week 13-14 implementations

**Test Failures:**
```
- smtp.test.ts - Missing addSMTPConfigToOrg
- sms.test.ts - Missing addTwilioSMSConfigToOrg  
- saml-idp.test.ts - Missing addSAMLIDPToOrg
- provider-helpers.test.ts - Missing helper commands
- jwt-idp.test.ts - Missing JWT IDP commands
- ldap-idp.test.ts - Missing LDAP IDP commands
- instance-idp.test.ts - Missing instance IDP commands
```

---

## 📋 RESTORATION STRATEGY

### Phase 1: Week 14 SMTP/SMS (Priority 1)
**Rationale:** Tests exist, simpler implementation

**Files to Create:**
1. `src/lib/command/smtp/smtp-commands.ts` (5 commands, ~350 lines core)
2. `src/lib/command/sms/sms-commands.ts` (7 commands, ~450 lines core)
3. Register in Commands class

**Commands:**
- SMTP: add, change, activate, deactivate, remove
- SMS: addTwilio, changeTwilio, addHTTP, changeHTTP, activate, deactivate, remove

**Estimated:** ~800 lines, 10-15k tokens

### Phase 2: Week 13 IDPs (Priority 2)
**Rationale:** Tests exist, more complex implementation

**Files to Create:**
1. `src/lib/command/idp/jwt-idp-commands.ts` (3 commands, ~300 lines core)
2. `src/lib/command/idp/saml-idp-commands.ts` (3 commands, ~350 lines core)
3. `src/lib/command/idp/ldap-idp-commands.ts` (3 commands, ~350 lines core)
4. `src/lib/command/idp/provider-helpers.ts` (3 commands, ~150 lines core)
5. `src/lib/command/instance/instance-idp-commands.ts` (4 commands, ~250 lines core)
6. Update IDP projection for instance-level events
7. Register in Commands class

**Commands:** 16 total across JWT, LDAP, SAML, helpers, instance-level

**Estimated:** ~1,400 lines, 20-25k tokens

### Phase 3: Verification & Testing
1. Run full test suite
2. Fix any compilation errors
3. Fix any test failures
4. Update documentation
5. Verify parity metrics

**Estimated:** 5-10k tokens

---

## 💾 TOKEN BUDGET

**Available:** ~58k tokens  
**Required:**
- Phase 1 (SMTP/SMS): ~10-15k tokens
- Phase 2 (IDPs): ~20-25k tokens
- Phase 3 (Verification): ~5-10k tokens
- **Total:** ~35-50k tokens

**Budget Status:** ✅ SUFFICIENT

---

## ⚡ EXECUTION PLAN

### Step 1: Restore SMTP Commands (Now)
- Create smtp-commands.ts with 5 commands
- Focus on core functionality
- Register in Commands class
- Verify smtp.test.ts passes

### Step 2: Restore SMS Commands  
- Create sms-commands.ts with 7 commands
- Support Twilio + HTTP providers
- Register in Commands class
- Verify sms.test.ts passes

### Step 3: Restore IDP Commands
- Create JWT, SAML, LDAP command files
- Create provider helpers
- Create instance IDP commands
- Update IDP projection for instance events
- Register all in Commands class
- Verify all IDP tests pass

### Step 4: Final Verification
- Run full integration suite
- Ensure all 1,012+ tests pass
- Update parity tracker to 84%
- Create completion report

---

## 🎯 SUCCESS CRITERIA

**Must Have:**
- ✅ All command files created
- ✅ All commands registered
- ✅ Zero compilation errors
- ✅ All 82 test suites passing
- ✅ 1,012+ tests passing

**Nice to Have:**
- ✅ Comprehensive error handling
- ✅ Full validation
- ✅ Complete documentation

---

## 📊 EXPECTED OUTCOME

**After Full Restoration:**
- **Parity:** 84% (Phase 1 + Phase 2 complete)
- **Commands:** 116 total
- **Tests:** 1,040+ passing
- **Test Suites:** 82/82 passing
- **Status:** Production-ready

---

**Decision:** PROCEED with full restoration  
**Starting with:** Week 14 SMTP commands  
**Goal:** Fix all 8 failing test suites  
**Timeline:** This session
