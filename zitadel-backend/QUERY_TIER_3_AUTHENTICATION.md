# Query Module - Tier 3: Authentication
**Timeline:** Week 9-12 (4 weeks)  
**Priority:** HIGH  
**Status:** 🔴 Not Started  
**Depends On:** ✅ Tier 2 (Core CQRS)

---

## 🎯 Overview

Implement authentication-related queries and projections required for login flows, including auth requests, authentication keys, identity providers, and login policies.

---

## 📦 Deliverables

1. Auth Request queries + AuthRequestProjection
2. AuthN Key queries + AuthNKeyProjection
3. IDP queries + IDP projections (4 projections)
4. Login Policy queries + LoginPolicyProjection
5. Access Token queries
6. Complete test coverage (>85%)

---

## 📋 Detailed Tasks

### Task 3.1: Auth Request Domain (Week 9, 1 week)

**Files:**
- `src/lib/query/auth-request/auth-request-queries.ts`
- `src/lib/query/auth-request/auth-request-types.ts`
- `src/lib/query/projection/auth-request-projection.ts`

**Query Methods (2):**
1. `getAuthRequestByID` - Get auth request by ID
2. `getAuthRequestByCode` - Get auth request by code

**Projection Events:**
- auth_request.added
- auth_request.code.added
- auth_request.session.linked
- auth_request.succeeded
- auth_request.failed

**Acceptance Criteria:**
- [ ] Both methods implemented
- [ ] AuthRequestProjection processes events
- [ ] OAuth/OIDC flow support
- [ ] Tests >85% coverage

**Reference:** `internal/query/auth_request.go` (2,528 lines), `internal/query/projection/auth_request.go` (5,559 lines)

---

### Task 3.2: AuthN Key Domain (Week 9-10, 1.5 weeks)

**Files:**
- `src/lib/query/authn-key/authn-key-queries.ts`
- `src/lib/query/authn-key/authn-key-types.ts`
- `src/lib/query/projection/authn-key-projection.ts`

**Query Methods (6):**
1. `searchAuthNKeys` - Search authentication keys
2. `searchAuthNKeysData` - Search key data
3. `getAuthNKeyByIDWithPermission` - Get with permission check
4. `getAuthNKeyByID` - Get by ID
5. `getAuthNKeyUser` - Get key user
6. `getAuthNKeyPublicKeyByIDAndIdentifier` - Get public key

**Projection Events:**
- user.machine.key.added
- user.machine.key.removed
- user.removed

**Acceptance Criteria:**
- [ ] All 6 methods implemented
- [ ] Machine user key management
- [ ] Public key retrieval
- [ ] Permission checks work
- [ ] Tests >85% coverage

**Reference:** `internal/query/authn_key.go` (13,547 lines), `internal/query/projection/authn_key.go` (9,571 lines)

---

### Task 3.3: Identity Provider Domain (Week 10-11, 2 weeks)

**Files:**
- `src/lib/query/idp/idp-queries.ts`
- `src/lib/query/idp/idp-types.ts`
- `src/lib/query/projection/idp-projection.ts`
- `src/lib/query/projection/idp-template-projection.ts`
- `src/lib/query/projection/idp-user-link-projection.ts`
- `src/lib/query/projection/idp-login-policy-link-projection.ts`

**Query Methods (8):**
1. `getIDPByID` - Get IDP by ID
2. `searchIDPs` - Search IDPs
3. `getIDPTemplate` - Get IDP template
4. `searchIDPTemplates` - Search IDP templates
5. `searchIDPUserLinks` - Search user-IDP links
6. `getIDPUserLink` - Get specific user link
7. `searchIDPLoginPolicyLinks` - Search policy links
8. `getIDPByIDQuery` - Alternate lookup

**IDP Types to Support:**
- OAuth IDP (Google, GitHub, etc.)
- OIDC IDP
- JWT IDP
- LDAP IDP
- SAML IDP
- Azure AD IDP
- Apple IDP

**Projection Events:**
- idp.added, idp.changed, idp.removed
- idp.config.added, idp.config.changed
- idp.oauth.added, idp.oauth.changed
- idp.oidc.added, idp.oidc.changed
- idp.jwt.added, idp.jwt.changed
- idp.ldap.added, idp.ldap.changed
- idp.saml.added, idp.saml.changed
- idp.azure.added, idp.azure.changed
- idp.apple.added, idp.apple.changed
- user.idp.link.added, user.idp.link.removed, user.idp.link.cascade.removed
- org.idp.config.added, org.idp.config.removed
- instance.idp.config.added, instance.idp.config.removed

**Acceptance Criteria:**
- [ ] All 8 methods implemented
- [ ] All IDP types supported
- [ ] All 4 projections working
- [ ] User-IDP linking works
- [ ] Policy linking works
- [ ] Tests >85% coverage

**Reference:** 
- `internal/query/idp.go` (15,094 lines)
- `internal/query/idp_template.go` (59,594 lines)
- `internal/query/projection/idp_template.go` (103,942 lines - LARGEST FILE)

---

### Task 3.4: Login Policy Domain (Week 11-12, 1.5 weeks)

**Files:**
- `src/lib/query/login-policy/login-policy-queries.ts`
- `src/lib/query/login-policy/login-policy-types.ts`
- `src/lib/query/projection/login-policy-projection.ts`

**Query Methods (7):**
1. `getActiveLoginPolicy` - Get active policy
2. `getLoginPolicy` - Get policy by ID
3. `getLoginPolicyByID` - Alternate lookup
4. `getDefaultLoginPolicy` - Get default policy
5. `searchLoginPolicies` - Search policies
6. `getActiveIDPs` - Get active IDPs for policy
7. `getSecondFactorsPolicy` - Get 2FA requirements

**Login Policy Config:**
- Allow username/password
- Allow register
- Allow external IDP
- Force MFA
- MFA types (OTP, U2F, etc.)
- Password complexity requirements
- Password age requirements
- Lockout policy
- IDP links

**Projection Events:**
- org.login.policy.added, org.login.policy.changed, org.login.policy.removed
- instance.login.policy.added, instance.login.policy.changed
- org.login.policy.second.factor.added, org.login.policy.second.factor.removed
- org.login.policy.multi.factor.added, org.login.policy.multi.factor.removed
- org.login.policy.idp.added, org.login.policy.idp.removed

**Acceptance Criteria:**
- [ ] All 7 methods implemented
- [ ] LoginPolicyProjection processes events
- [ ] MFA configuration works
- [ ] IDP linking works
- [ ] Policy inheritance (org→instance) works
- [ ] Tests >85% coverage

**Reference:** `internal/query/login_policy.go` (15,074 lines), `internal/query/projection/login_policy.go` (17,708 lines)

---

### Task 3.5: Access Token Queries (Week 12, 2 days)

**Files:**
- `src/lib/query/access-token/access-token-queries.ts`
- `src/lib/query/access-token/access-token-types.ts`

**Query Methods (3):**
1. `getActiveAccessTokenByID` - Get active token
2. `getAccessTokenByID` - Get token by ID
3. `getAccessTokenByToken` - Get token by token string

**Token Information:**
- Token ID
- User ID
- Application ID
- Scopes
- Audience
- Expiration
- Refresh token

**Note:** Access tokens are typically stored in eventstore, not projected. Queries read directly from events.

**Acceptance Criteria:**
- [ ] All 3 methods implemented
- [ ] Token validation works
- [ ] Expired token detection
- [ ] Tests >85% coverage

**Reference:** `internal/query/access_token.go` (7,018 lines)

---

### Task 3.6: Integration Testing (Week 12, 2 days)

**Test Scenarios:**

1. **OAuth/OIDC Flow:**
   - Create auth request
   - Query auth request
   - Link to session
   - Query updated request

2. **Machine User Auth:**
   - Create machine user
   - Add AuthN key
   - Query key
   - Use key for authentication

3. **External IDP Flow:**
   - Configure IDP
   - Link user to IDP
   - Query IDP user link
   - Authenticate via IDP

4. **Login Policy:**
   - Set login policy
   - Configure MFA
   - Link IDPs
   - Query effective policy

5. **Access Tokens:**
   - Generate access token
   - Query token
   - Validate token
   - Check expiration

**Performance Tests:**
- Auth request lookup <20ms
- IDP template query <30ms
- Login policy query <25ms
- Access token validation <15ms

---

## ✅ Success Criteria

### Functional
- [ ] All 26 query methods implemented
- [ ] All 7 projections processing events
- [ ] OAuth/OIDC flows work
- [ ] IDP integration works
- [ ] MFA configuration works
- [ ] Access token validation works

### Non-Functional
- [ ] Unit test coverage >85%
- [ ] Integration tests passing
- [ ] Auth flows <100ms end-to-end
- [ ] Query response <50ms
- [ ] Build passes with 0 errors
- [ ] All APIs documented

### Security
- [ ] Secrets properly encrypted
- [ ] Permission checks enforced
- [ ] Token validation secure
- [ ] IDP configs protected

---

## 📈 Estimated Effort

**Total:** 4 weeks (160 hours)  
**Complexity:** VERY HIGH  
**Lines of Code:** ~45,000  
**Risk Level:** HIGH (Security-critical)

**Breakdown:**
- Week 9: Auth Request + AuthN Key (50% done)
- Week 10: AuthN Key + IDP (50% done)
- Week 11: IDP + Login Policy (50% done)
- Week 12: Login Policy + Access Token + Testing

---

## 🔗 Dependencies

**Required from Tier 2:**
- User queries (for user lookups)
- Organization queries (for policy inheritance)
- Instance queries (for default policies)
- Session queries (for auth request linking)

**Required from Tier 1:**
- Projection framework
- Search framework
- Encryption support (for secrets)

---

## 📚 Key References

- `internal/query/auth_request.go`
- `internal/query/authn_key.go`
- `internal/query/idp.go`
- `internal/query/idp_template.go` (59,594 lines)
- `internal/query/login_policy.go`
- `internal/query/access_token.go`
- `internal/query/projection/idp_template.go` (103,942 lines - study carefully)
