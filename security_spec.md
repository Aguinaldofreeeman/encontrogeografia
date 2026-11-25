# Security Specification — Atlas & Memórias (Geografia)

## 1. Data Invariants

1. **Public Read Isolation**: Only `photos` with `visibility == 'public'` and `comments` with `status == 'approved'` are readable by unauthenticated or non-admin visitors (`get` and `list`).
2. **Admin Verification**: All administrative writes (`photos`, `settings`, `comments` moderation, `admins`) require `request.auth != null && request.auth.token.email_verified == true` and either the bootstrapped admin email (`aguinaldofreeman@gmail.com`) or an existing document in `/admins/{request.auth.uid}`.
3. **Comment Integrity & Anti-Orphan Rule**: Publicly submitted comments MUST enter with `status == 'pending'`, match `request.time` for `createdAt` and `updatedAt`, enforce bounded string lengths, and verify the parent photo exists when `targetType == 'photo'`.
4. **Immutable Ownership & Timestamps**: `authorUid` and `createdAt` on `photos`, and `photoId`, `targetType`, and `createdAt` on `comments` cannot be altered after creation.
5. **Path ID Hardening**: All document IDs (`photoId`, `commentId`, `settingId`, `adminUid`) must match `^[a-zA-Z0-9_-]+$` and `size() <= 128`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on Photo Create**: `{ ..., "isOfficial": true }` -> Rejected by `keys().hasOnly(...)`.
2. **Email Spoofing Without Verification**: `auth.token = { email: "aguinaldofreeman@gmail.com", email_verified: false }` -> Rejected by `email_verified == true`.
3. **Pre-Approved Comment Bypass**: Public user creates comment with `"status": "approved"` -> Rejected by `incoming().status == 'pending'`.
4. **Orphaned Photo Comment**: Visitor creates comment with `targetType: "photo", photoId: "non_existent_id"` -> Rejected by `exists(/databases/.../photos/...)`.
5. **Client-Backdated Timestamp**: Photo or comment created with arbitrary past `createdAt` -> Rejected by `createdAt == request.time`.
6. **Oversized ID Poisoning**: Document ID > 128 chars or containing `/` / `$` -> Rejected by `isValidId()`.
7. **Malicious URI Scheme in Photo**: `imageUrl: "javascript:alert(1)"` -> Rejected by prefix validation.
8. **Immutable Field Tampering on Update**: Admin update attempting to rewrite `createdAt` or `authorUid` -> Rejected by `incoming().authorUid == existing().authorUid` and `affectedKeys().hasOnly(...)`.
9. **Unmoderated Comment Scraping**: Public client executes `list` on `/comments` without `where('status', '==', 'approved')` -> Rejected by `allow list: if resource.data.status == 'approved' || isBootstrappedAdmin()`.
10. **Non-Admin Photo Publish**: Authenticated non-admin user tries to create/update/delete `/photos/{id}` -> Rejected by `isAdmin()`.
11. **Self-Promotion to Admin**: Non-admin authenticated user creates `/admins/{ownUid}` -> Rejected by `isAdmin()`.
12. **Settings Deletion / Arbitrary Key Write**: Attempting `delete` on `/settings/album` or writing `/settings/other` -> Rejected by `settingId == 'album'` and `allow delete: if false`.
