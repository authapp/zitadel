# API Module Migration Roadmap

**Date:** October 22, 2025  
**Current Phase:** Phase 2 (9% complete)

---

## 🗺️ DEPENDENCY MAP

```
┌─────────────────────────────────────────────────────────────┐
│                    ZITADEL ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Layer 4: API LAYER                        │
│  ┌────────────┬──────────┬────────┬───────┬───────────┐    │
│  │ gRPC API   │ REST API │  OIDC  │ SAML  │  UI/Login │    │
│  │ (478 files)│          │(42 f)  │(7 f)  │ (275 f)   │    │
│  └─────┬──────┴────┬─────┴───┬────┴───┬───┴─────┬─────┘    │
│        │           │         │        │         │          │
└────────┼───────────┼─────────┼────────┼─────────┼──────────┘
         │           │         │        │         │
         ▼           ▼         ▼        ▼         ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 3: INFRASTRUCTURE LAYER                   │
│  ┌─────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │ authz   │  crypto  │ zerrors  │   i18n   │ telemetry│   │
│  │ ⬜ 0%  │  ⬜ 0%  │  ⬜ 0%  │  ⬜ 0%  │  ⬜ 0%  │   │
│  └────┬────┴─────┬────┴─────┬────┴─────┬────┴─────┬────┘   │
│       │          │          │          │          │        │
└───────┼──────────┼──────────┼──────────┼──────────┼────────┘
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 2: BUSINESS LOGIC LAYER                   │
│  ┌──────────────────────────┬──────────────────────────┐   │
│  │  COMMAND (Write Side)    │   QUERY (Read Side)      │   │
│  │  ✅ 100% (56+ commands)  │   ✅ 70% (partial)       │   │
│  └─────────────┬────────────┴─────────────┬────────────┘   │
│                │                           │                │
└────────────────┼───────────────────────────┼────────────────┘
                 │                           │
                 ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 1: DATA LAYER                             │
│  ┌─────────────┬─────────────┬──────────────┬──────────┐   │
│  │ Eventstore  │ Projections │   Database   │  Cache   │   │
│  │ ✅ 100%    │ 🔄 17% (5/30)│  ✅ 100%    │ ✅ 100% │   │
│  └─────────────┴─────────────┴──────────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘

Legend:
✅ Complete
🔄 In Progress
⬜ Not Started
```

---

## 🎯 CURRENT STATUS

### **What We Have:**
```
Layer 1 (Data):        ✅ 95% - Almost done
Layer 2 (Business):    ✅ 85% - Command done, Query partial
Layer 3 (Infrastructure): ⬜ 0% - NOT STARTED ❌
Layer 4 (API):         ⬜ 0% - NOT STARTED ❌
```

### **The Problem:**
```
Cannot build Layer 4 (API) without Layer 3 (Infrastructure)
Cannot build Layer 3 without completing Layer 1 & 2
```

---

## 📅 MIGRATION TIMELINE

### **Current: Phase 2 & 3** (14 weeks remaining)
```
[=====>                                        ] 9% (NOW)
Week 1-2:   Complete Priority 1 tables (users, metadata, login_names)
Week 3-4:   Complete Priority 2 tables (org_domains, project_roles)
Week 5-6:   Complete Priority 3 tables (instances, sessions)
Week 7-9:   Complete Priority 4 tables (grants, members)
Week 10-12: Complete Priority 5 tables (policies)
Week 13-14: Phase 3 new tables (auth_methods, PATs, encryption_keys, lockout)
```
**End Date:** ~January 2026

---

### **Phase API-1: Infrastructure** (6 weeks)
```
⬜ NOT STARTED
Start: January 2026
End: February 2026

Week 1-2:  Implement crypto module
           - Password hashing (bcrypt/argon2)
           - JWT signing/verification
           - Token encryption (AES-GCM)
           
Week 3-4:  Implement zerrors & authz modules
           - Error types & HTTP mapping
           - Permission checking
           - Role-based access control
           
Week 5-6:  Implement HTTP infrastructure
           - Express/NestJS setup
           - Authentication middleware
           - Multi-tenant middleware
           - Security headers
```

**Deliverable:** Foundation for API layer

---

### **Phase API-2: Choose Your Path**

After Phase API-1, you have **3 options:**

#### **Option A: REST API Only** ⏱️ 4 weeks
```
Week 1-2:  Build REST endpoints
           - User management
           - Org management
           - Project/App management
           
Week 3-4:  Authentication & testing
           - JWT authentication
           - Integration tests
```
**End Date:** March 2026  
**Use Case:** Internal APIs, web applications  
**Complexity:** ⭐⭐ LOW

---

#### **Option B: OIDC Provider** ⏱️ 8 weeks ⭐ RECOMMENDED
```
Week 1-2:  Setup oidc-provider npm package
           - Configure storage adapter
           - Implement client lookup
           
Week 3-4:  Implement grant types
           - Authorization code flow
           - Client credentials
           - Refresh token
           
Week 5-6:  Build login UI
           - Login form
           - Consent screen
           - Basic registration
           
Week 7-8:  Testing & polish
           - OAuth2/OIDC compliance tests
           - Integration with apps
```
**End Date:** April 2026  
**Use Case:** SSO, OAuth2 provider, external integrations  
**Complexity:** ⭐⭐⭐ MEDIUM

---

#### **Option C: Full gRPC API** ⏱️ 16 weeks
```
Week 1-2:  Setup gRPC infrastructure
           - Proto definitions
           - Code generation
           - Server setup
           
Week 3-6:  Implement Admin API
           - User management endpoints
           - Org management endpoints
           - All CRUD operations
           
Week 7-10: Implement Management API
           - Project management
           - Application management
           - Role management
           
Week 11-14: Implement Auth API
            - Session management
            - Authentication flows
            - Token operations
            
Week 15-16: Testing & documentation
            - gRPC tests
            - API documentation
```
**End Date:** June 2026  
**Use Case:** Full API parity with Zitadel Go  
**Complexity:** ⭐⭐⭐⭐⭐ VERY HIGH

---

## 🎯 RECOMMENDED PATH

### **Phase 1-3: Data & Business Layer** (NOW - Jan 2026)
**Status:** 🔄 IN PROGRESS  
**Focus:** Complete Phase 2 & 3
- Finish all projection tables (5/30 done)
- Implement missing critical tables
- Ensure 100% test coverage

**Priority:** ⭐⭐⭐⭐⭐ CRITICAL  
**Timeline:** 14 weeks

---

### **Phase API-1: Infrastructure** (Jan - Feb 2026)
**Status:** ⬜ NOT STARTED  
**Focus:** Build API foundation
- crypto module (passwords, JWT, encryption)
- authz module (permissions, RBAC)
- zerrors module (error handling)
- HTTP infrastructure (Express, middleware)

**Priority:** ⭐⭐⭐⭐⭐ CRITICAL  
**Timeline:** 6 weeks

---

### **Phase API-2: OIDC Provider** (Mar - Apr 2026) ⭐ RECOMMENDED
**Status:** ⬜ NOT STARTED  
**Focus:** OAuth2/OIDC capability
- Use `oidc-provider` npm package
- Implement storage adapter
- Build basic login UI
- OAuth2/OIDC flows

**Priority:** ⭐⭐⭐⭐ HIGH  
**Timeline:** 8 weeks  
**Rationale:** 
- Most valuable feature first
- Enables SSO use cases
- Moderate complexity
- Clear ROI

---

### **Phase API-3: REST API** (May 2026)
**Status:** ⬜ NOT STARTED  
**Focus:** REST endpoints for web apps
- User CRUD
- Org CRUD
- Project/App CRUD
- Simple authentication

**Priority:** ⭐⭐⭐ MEDIUM  
**Timeline:** 4 weeks

---

### **Phase API-4: Advanced Features** (Optional, Jun+ 2026)
**Status:** ⬜ NOT STARTED  
**Options:**
- Full gRPC API (if needed)
- SAML Provider (if needed)
- SCIM API (if needed)
- Full UI (login, register, MFA, etc.)

**Priority:** ⭐⭐ LOW-MEDIUM  
**Timeline:** 12-16 weeks per feature

---

## 📊 EFFORT BREAKDOWN

### **Total Effort to Useful API:**

```
Phase 2 & 3 (Data):        14 weeks  ✅ Must Do
Phase API-1 (Foundation):  6 weeks   ✅ Must Do
Phase API-2 (OIDC):        8 weeks   ✅ Recommended
                           ─────────
                           28 weeks = 7 months
```

**Target Date:** **May 2026** for working OIDC provider

---

### **Total Effort to Full API:**

```
Phase 2 & 3 (Data):        14 weeks
Phase API-1 (Foundation):  6 weeks
Phase API-2 (OIDC):        8 weeks
Phase API-3 (REST):        4 weeks
Phase API-4 (gRPC):        16 weeks
Phase API-5 (UI):          10 weeks
Phase API-6 (SAML/SCIM):   6 weeks
                           ─────────
                           64 weeks = 16 months
```

**Target Date:** **February 2027** for full feature parity

---

## 🚦 DECISION POINTS

### **Decision 1: After Phase 2 & 3** (Jan 2026)
```
❓ Should we start API migration?
✅ YES - Start Phase API-1 (infrastructure)
```

---

### **Decision 2: After Phase API-1** (Feb 2026)
```
❓ Which API to build first?

Option A: REST API (4 weeks, simpler)
Option B: OIDC Provider (8 weeks, more valuable) ⭐ RECOMMENDED
Option C: gRPC API (16 weeks, most complex)

Recommendation: Choose B (OIDC) - Best value/effort ratio
```

---

### **Decision 3: After Phase API-2** (Apr 2026)
```
❓ What next?

Option A: Stop here (working OIDC provider) ✅ Valid stopping point
Option B: Add REST API (4 more weeks)
Option C: Add gRPC API (16 more weeks)
Option D: Add SAML (6 more weeks)
Option E: Add UI (10 more weeks)

Recommendation: Evaluate based on actual needs at that time
```

---

## 💰 COST-BENEFIT ANALYSIS

### **Phase API-1 (Infrastructure) - 6 weeks**
**Cost:** 6 weeks  
**Benefit:** Foundation for ALL APIs  
**ROI:** ⭐⭐⭐⭐⭐ **REQUIRED** for any API

---

### **Phase API-2 (OIDC) - 8 weeks**
**Cost:** 8 weeks  
**Benefit:** Full OAuth2/OIDC provider, SSO capability  
**ROI:** ⭐⭐⭐⭐⭐ **VERY HIGH** - Enables key use cases

---

### **Phase API-3 (REST) - 4 weeks**
**Cost:** 4 weeks  
**Benefit:** Web app integration  
**ROI:** ⭐⭐⭐⭐ **HIGH** - Useful for internal apps

---

### **Phase API-4 (gRPC) - 16 weeks**
**Cost:** 16 weeks  
**Benefit:** Full API parity  
**ROI:** ⭐⭐ **LOW-MEDIUM** - Only if you need gRPC

---

### **Phase API-5 (UI) - 10 weeks**
**Cost:** 10 weeks  
**Benefit:** User-facing login/register UI  
**ROI:** ⭐⭐⭐ **MEDIUM** - Nice to have, but OIDC provider can use custom UI

---

### **Phase API-6 (SAML/SCIM) - 6 weeks**
**Cost:** 6 weeks  
**Benefit:** Enterprise features  
**ROI:** ⭐⭐ **LOW** - Niche use case

---

## 🎯 FINAL RECOMMENDATION

### **Minimum Viable API (28 weeks = 7 months)**
```
1. Complete Phase 2 & 3 (14 weeks) ← YOU ARE HERE
2. Build Phase API-1 Infrastructure (6 weeks)
3. Build Phase API-2 OIDC Provider (8 weeks)
```

**Result:** Working OAuth2/OIDC provider with SSO capability  
**Timeline:** May 2026  
**Complexity:** Manageable  
**Value:** Very high

---

### **Full-Featured API (64 weeks = 16 months)**
```
All of the above PLUS:
4. REST API (4 weeks)
5. gRPC API (16 weeks)
6. Login UI (10 weeks)
7. SAML/SCIM (6 weeks)
8. Advanced features (8 weeks)
```

**Result:** Complete Zitadel in TypeScript  
**Timeline:** February 2027  
**Complexity:** Very high  
**Value:** Feature parity

---

## ⚠️ IMPORTANT NOTES

### **Don't Start API Migration Yet!**
```
Current Status: Phase 2 only 9% complete (2/23 tables)

Required Before API:
❌ Complete Phase 2 (21 tables remaining)
❌ Complete Phase 3 (4 new tables)
❌ Implement crypto module
❌ Implement authz module
❌ Implement zerrors module

Estimated Time: 14 weeks (to end of Jan 2026)
```

---

### **Focus on Current Phase**
```
✅ Continue Phase 2 table updates
✅ Maintain 100% test coverage
✅ Document progress
✅ Build momentum with established pattern

Current velocity: 2 tables/hour (excellent!)
```

---

### **Revisit This Plan**
```
When: January 2026 (after Phase 2 & 3 complete)
Decision: Choose API path based on needs at that time
```

---

## 📈 PROGRESS TRACKING

### **Milestones:**

- [🔄] **Milestone 1:** Phase 2 & 3 Complete (Jan 2026)
  - 30 projection tables updated
  - 100% test coverage maintained
  
- [⬜] **Milestone 2:** API Infrastructure Complete (Feb 2026)
  - crypto, authz, zerrors modules
  - HTTP middleware stack
  
- [⬜] **Milestone 3:** OIDC Provider Live (Apr 2026)
  - OAuth2/OIDC flows working
  - Can use for SSO
  
- [⬜] **Milestone 4:** Production Ready (May 2026)
  - REST API available
  - Full documentation
  - Security audit complete

---

## 🎯 SUMMARY

**Current Focus:** Phase 2 & 3 (Database layer)  
**Next Focus:** Phase API-1 (Infrastructure) - January 2026  
**Recommended Target:** Phase API-2 (OIDC) - April 2026  
**Optional Goal:** Full gRPC API - June 2026+

**Don't get distracted by API migration now. Finish what you started!** 🚀

---

*Roadmap Created: October 22, 2025*  
*Target Review Date: January 20, 2026*
