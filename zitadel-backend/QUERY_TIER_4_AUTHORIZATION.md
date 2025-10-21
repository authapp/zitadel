# Query Module - Tier 4: Authorization
**Timeline:** Week 13-17 (5 weeks)  
**Priority:** HIGH  
**Status:** 🟡 In Progress (Task 4.1 Complete - 20% Done)  
**Depends On:** ✅ Tier 3 (Authentication)

---

## 🎯 Overview

Implement authorization queries and projections for access control, including user grants, project grants, members, permissions, and roles.

---

## 📦 Deliverables

1. User Grant queries + UserGrantProjection
2. Project Grant queries + ProjectGrantProjection  
3. Member queries + Member projections (4 types)
4. Permission queries
5. Role queries
6. Complete test coverage (>85%)

---

## 📋 Detailed Tasks

### Task 4.1: User Grant Domain (Week 13-14, 2 weeks) ✅ COMPLETE

**Files:**
- ✅ `src/lib/query/user-grant/user-grant-queries.ts` (346 lines)
- ✅ `src/lib/query/user-grant/user-grant-types.ts` (110 lines)
- ✅ `src/lib/query/projections/user-grant-projection.ts` (263 lines)
- ✅ `test/unit/query/user-grant/user-grant-queries.test.ts` (293 lines, 13 tests)
- ✅ `test/integration/query/user-grant-projection.integration.test.ts` (455 lines, 9 tests)

**Query Methods (5):**
1. ✅ `searchUserGrants` - Search user grants with filters and pagination
2. ✅ `getUserGrantByID` - Get specific grant with user/project info
3. ✅ `getUserGrantsByUserID` - Get all grants for user
4. ✅ `getUserGrantsByProjectID` - Get all grants for project
5. ✅ `checkUserGrant` - Check if user has grant with optional role check

**User Grant Model:**
```typescript
export interface UserGrant {
  id: string;
  userID: string;
  projectID: string;
  projectGrantID?: string;
  resourceOwner: string;
  state: State;
  roles: string[];
  creationDate: Date;
  changeDate: Date;
  sequence: bigint;
  // Joined user/project info
  userName?: string;
  projectName?: string;
  orgName?: string;
}
```

**Projection Events (8):**
- ✅ user.grant.added
- ✅ user.grant.changed
- ✅ user.grant.deactivated
- ✅ user.grant.reactivated
- ✅ user.grant.removed
- ✅ user.grant.cascade.removed
- ✅ project.removed (cascade delete)
- ✅ user.removed (cascade delete)

**Key Features:**
- ✅ Full CRUD operations on user grants
- ✅ Role assignment and validation
- ✅ State management (active/inactive)
- ✅ Cascade deletion on user/project removal
- ✅ Cross-org access via project grants
- ✅ Comprehensive joins with users/projects/orgs tables
- ✅ Authorization checking with role validation

**Acceptance Criteria:**
- [x] All 5 methods implemented (100%)
- [x] UserGrantProjection processes all 8 event types
- [x] Role assignment works (array support)
- [x] Cascade deletion works (user + project removed)
- [x] Grant state management works (active/inactive/deleted)
- [x] Tests >85% coverage (22 comprehensive tests)

**Implementation Stats:**
- **Total Lines:** ~1,467 lines (719 implementation + 748 tests)
- **Test Coverage:** 22 tests (13 unit + 9 integration)
- **Query Methods:** 5 (all required methods)
- **Event Types:** 8 (complete lifecycle + cascade)
- **Database Tables:** 1 with 5 indexes
- **Build Status:** ✅ Passing
- **Unit Tests:** ✅ 13/13 passing
- **Integration Tests:** ✅ 9/9 passing

**Reference:** `internal/query/user_grant.go` (20,686 lines), `internal/query/projection/user_grant.go` (16,144 lines)

---

### Task 4.2: Project Grant Domain (Week 14, 1 week)

**Files:**
- `src/lib/query/project-grant/project-grant-queries.ts`
- `src/lib/query/project-grant/project-grant-types.ts`
- `src/lib/query/projection/project-grant-projection.ts`

**Query Methods (3+):**
1. `searchProjectGrants` - Search project grants
2. `getProjectGrantByID` - Get specific grant
3. `getProjectGrantsByProjectID` - Get grants for project
4. `getProjectGrantsByGrantedOrgID` - Get grants for org

**Project Grant Model:**
```typescript
export interface ProjectGrant {
  id: string;
  projectID: string;
  grantedOrgID: string;
  grantedOrgName: string;
  resourceOwner: string;
  state: State;
  roles: string[];
  creationDate: Date;
  changeDate: Date;
  sequence: number;
}
```

**Projection Events:**
- project.grant.added
- project.grant.changed
- project.grant.deactivated
- project.grant.reactivated
- project.grant.removed
- project.grant.cascade.removed
- project.removed
- org.removed

**Acceptance Criteria:**
- [ ] All 4+ methods implemented
- [ ] ProjectGrantProjection processes events
- [ ] Cross-org access works
- [ ] Role filtering works
- [ ] Tests >85% coverage

**Reference:** `internal/query/project_grant.go` (15,398 lines), `internal/query/projection/project_grant.go` (10,720 lines)

---

### Task 4.3: Member Domains (Week 15-16, 2 weeks)

**Files:**
- `src/lib/query/member/instance-member-queries.ts`
- `src/lib/query/member/org-member-queries.ts`
- `src/lib/query/member/project-member-queries.ts`
- `src/lib/query/member/project-grant-member-queries.ts`
- `src/lib/query/member/member-types.ts`
- `src/lib/query/projection/instance-member-projection.ts`
- `src/lib/query/projection/org-member-projection.ts`
- `src/lib/query/projection/project-member-projection.ts`
- `src/lib/query/projection/project-grant-member-projection.ts`

#### 4.3.1: Instance Members (IAM Members)

**Query Methods (2):**
1. `searchIAMMembers` - Search IAM members
2. `getIAMMemberByIAMIDAndUserID` - Get specific member

**Projection Events:**
- instance.member.added
- instance.member.changed
- instance.member.removed
- instance.member.cascade.removed
- user.removed

#### 4.3.2: Organization Members

**Query Methods (2):**
1. `searchOrgMembers` - Search org members
2. `getOrgMemberByID` - Get specific member

**Projection Events:**
- org.member.added
- org.member.changed
- org.member.removed
- org.member.cascade.removed
- org.removed
- user.removed

#### 4.3.3: Project Members

**Query Methods (2):**
1. `searchProjectMembers` - Search project members
2. `getProjectMemberByID` - Get specific member

**Projection Events:**
- project.member.added
- project.member.changed
- project.member.removed
- project.member.cascade.removed
- project.removed
- user.removed

#### 4.3.4: Project Grant Members

**Query Methods (2):**
1. `searchProjectGrantMembers` - Search grant members
2. `getProjectGrantMemberByID` - Get specific member

**Projection Events:**
- project.grant.member.added
- project.grant.member.changed
- project.grant.member.removed
- project.grant.member.cascade.removed
- project.grant.removed
- user.removed

**Member Model:**
```typescript
export interface Member {
  userID: string;
  roles: string[];
  creationDate: Date;
  changeDate: Date;
  sequence: number;
  resourceOwner: string;
  // User info (joined)
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
}
```

**Acceptance Criteria:**
- [ ] All 8 member methods implemented
- [ ] All 4 member projections working
- [ ] Role assignment works
- [ ] Cascade deletion works
- [ ] User info joins work
- [ ] Tests >85% coverage

**Reference:** 
- `internal/query/iam_member.go` (5,221 lines)
- `internal/query/org_member.go` (5,100 lines)
- `internal/query/project_member.go` (5,293 lines)
- `internal/query/project_grant_member.go` (5,914 lines)

---

### Task 4.4: Permission System (Week 16, 1 week)

**Files:**
- `src/lib/query/permission/permission-queries.ts`
- `src/lib/query/permission/permission-types.ts`
- `src/lib/query/permission/zitadel-permission-queries.ts`

**Query Methods (4):**
1. `checkUserPermissions` - Check if user has permissions
2. `getMyPermissions` - Get current user permissions
3. `getGlobalPermissions` - Get global permissions
4. `getMyZitadelPermissions` - Get Zitadel system permissions

**Permission Model:**
```typescript
export interface Permission {
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: ConditionType;
  value: string;
}

export enum ConditionType {
  ORGANIZATION = 'org',
  PROJECT = 'project',
  RESOURCE_OWNER = 'resource_owner'
}
```

**Permission Checking Algorithm:**
1. Check user's direct grants (UserGrant)
2. Check user's membership roles (Member)
3. Check project grants (ProjectGrant)
4. Aggregate permissions from roles
5. Apply conditions
6. Cache result

**Acceptance Criteria:**
- [ ] All 4 methods implemented
- [ ] Permission checking works
- [ ] Role-based permissions work
- [ ] Condition evaluation works
- [ ] Permission caching works
- [ ] Tests >85% coverage

**Reference:** `internal/query/permission.go` (6,107 lines), `internal/query/zitadel_permission.go` (1,660 lines)

---

### Task 4.5: Role Queries (Week 17, 3 days)

**Files:**
- `src/lib/query/member-roles/member-roles-queries.ts`
- `src/lib/query/member-roles/member-roles-types.ts`

**Query Methods (4):**
1. `getMemberRoles` - Get available member roles
2. `getGlobalMemberRoles` - Get global roles
3. `getInstanceMemberRoles` - Get instance roles
4. `getOrgMemberRoles` - Get org roles

**Role Types:**
- IAM Admin
- IAM Owner
- Org Owner
- Org Admin
- Project Owner
- Project Admin
- Project User Manager
- Custom roles

**Acceptance Criteria:**
- [ ] All 4 methods implemented
- [ ] Role hierarchy works
- [ ] Role inheritance works
- [ ] Tests >85% coverage

**Reference:** `internal/query/member_roles.go` (1,487 lines)

---

### Task 4.6: User Membership Queries (Week 17, 2 days)

**Files:**
- `src/lib/query/user-membership/user-membership-queries.ts`
- `src/lib/query/user-membership/user-membership-types.ts`

**Query Methods (2):**
1. `getUserMemberships` - Get all memberships for user
2. `searchUserMemberships` - Search memberships with filters

**Membership Model:**
```typescript
export interface UserMembership {
  userID: string;
  memberType: MemberType;
  aggregateID: string;  // org/project/instance ID
  objectID: string;
  roles: string[];
  displayName: string;
  creationDate: Date;
  changeDate: Date;
}

export enum MemberType {
  INSTANCE = 'instance',
  ORG = 'org',
  PROJECT = 'project',
  PROJECT_GRANT = 'project_grant'
}
```

**Acceptance Criteria:**
- [ ] Both methods implemented
- [ ] Aggregates all membership types
- [ ] Efficient queries
- [ ] Tests >85% coverage

**Reference:** `internal/query/user_membership.go` (13,874 lines)

---

### Task 4.7: Integration Testing (Week 17, 2 days)

**Test Scenarios:**

1. **User Grant Flow:**
   - Create user grant
   - Query user grants
   - Check permissions
   - Update grant roles
   - Verify permission changes

2. **Project Grant Flow:**
   - Grant project to org
   - Query project grants
   - Verify cross-org access
   - Remove grant
   - Verify access removed

3. **Member Management:**
   - Add member to org
   - Query org members
   - Change member roles
   - Query updated roles
   - Remove member

4. **Permission Checking:**
   - User with multiple roles
   - Check various permissions
   - Verify role aggregation
   - Test conditions
   - Cache behavior

5. **Cascade Deletion:**
   - Delete user
   - Verify grants removed
   - Verify memberships removed
   - Check projections updated

**Performance Tests:**
- User grant query <30ms
- Permission check <50ms
- Member query <25ms
- Role lookup <15ms

---

## ✅ Success Criteria

### Functional
- [ ] All 25+ authorization methods implemented
- [ ] All 7 projections processing events
- [ ] User grant management works
- [ ] Project grant cross-org access works
- [ ] Member management works (4 types)
- [ ] Permission checking works
- [ ] Role system works

### Non-Functional
- [ ] Unit test coverage >85%
- [ ] Integration tests passing
- [ ] Permission check <50ms
- [ ] Query response <30ms
- [ ] Build passes with 0 errors
- [ ] All APIs documented

### Security
- [ ] Permission checks enforced
- [ ] Role validation works
- [ ] Cascade deletion secure
- [ ] No permission bypass possible

---

## 📈 Estimated Effort

**Total:** 5 weeks (200 hours)  
**Complexity:** VERY HIGH  
**Lines of Code:** ~50,000  
**Risk Level:** CRITICAL (Security foundation)

**Breakdown:**
- Week 13-14: User Grants (2 weeks)
- Week 14: Project Grants (1 week)
- Week 15-16: Members (2 weeks)
- Week 16: Permissions (1 week)
- Week 17: Roles + Memberships + Testing (1 week)

---

## 🔗 Dependencies

**Required from Tier 2:**
- User queries (for member info)
- Organization queries (for org context)
- Project queries (for project context)
- Instance queries (for instance context)

**Required from Tier 3:**
- Login policy (for role requirements)

---

## 📚 Key References

- `internal/query/user_grant.go` (20,686 lines)
- `internal/query/project_grant.go` (15,398 lines)
- `internal/query/iam_member.go`
- `internal/query/org_member.go`
- `internal/query/project_member.go`
- `internal/query/project_grant_member.go`
- `internal/query/permission.go` (6,107 lines)
- `internal/query/user_membership.go` (13,874 lines)
