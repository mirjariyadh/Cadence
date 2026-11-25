# Cadence Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Owner Isolation**: Every document across `users`, `projects`, `tasks`, `timeEntries`, `activeTimers`, and `weeklyReports` belongs strictly to a single verified user (`request.auth.uid`). No cross-user reads, lists, or writes are permitted.
2. **Relational Parent Integrity**: A `task` or `timeEntry` cannot be created unless its referenced `projectId` exists in `/projects/{projectId}` and belongs to `request.auth.uid`. If a `timeEntry` specifies a non-empty `taskId`, that task must exist in `/tasks/{taskId}` and belong to `request.auth.uid`.
3. **Immutable Identity & Timestamps**: `userId` and `createdAt` are immutable after creation. `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
4. **Volumetric & Schema Strictness**: Every string has an explicit `.size()` upper bound, every ID matches `^[a-zA-Z0-9_\-]+$`, and every write enforces exact key sets (`hasAll`/`hasOnly` on create, `affectedKeys().hasOnly(...)` on update).
5. **Terminal Report Locking**: A `weeklyReports` document is created with `status == 'finalized'` and forbids all subsequent `update` operations.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-User Project Spoof (Create)**: Authenticated as User A, create `/projects/p1` with `userId: "userB"`. Expected: `PERMISSION_DENIED`.
2. **Shadow Field Injection (Create)**: Create `/projects/p1` with all required fields plus `isAdmin: true`. Expected: `PERMISSION_DENIED`.
3. **Orphaned Task Creation**: Create `/tasks/t1` referencing a non-existent `projectId: "ghost_proj"`. Expected: `PERMISSION_DENIED`.
4. **Cross-Tenant Task Attachment**: Create `/tasks/t1` referencing User B's existing `projectId`. Expected: `PERMISSION_DENIED`.
5. **Backdated Timestamp Forgery**: Create `/timeEntries/e1` with a client-supplied past `createdAt` instead of `request.time`. Expected: `PERMISSION_DENIED`.
6. **Immutability Tampering (Update)**: Update `/tasks/t1` attempting to change `userId` or `createdAt`. Expected: `PERMISSION_DENIED`.
7. **Shadow Field Update**: Update `/projects/p1` adding an undeclared key `bonusFlag: true`. Expected: `PERMISSION_DENIED`.
8. **Value Poisoning on Allowed Key**: Update `/projects/p1` setting `name` to a 500-character string or numeric type. Expected: `PERMISSION_DENIED`.
9. **ID Poisoning Attack**: Attempt `create` on `/projects/invalid$id!with..chars` or a 200-char ID. Expected: `PERMISSION_DENIED`.
10. **Unverified Email Write**: Attempt write with `email_verified: false`. Expected: `PERMISSION_DENIED`.
11. **Terminal State Mutation**: Attempt `update` on a finalized `/weeklyReports/r1` document. Expected: `PERMISSION_DENIED`.
12. **Unscoped Collection Scraping**: Attempt `list` on `/timeEntries` without scoping to `userId == request.auth.uid` or reading another user's `/users/{otherUid}`. Expected: `PERMISSION_DENIED`.
