# Auth: demo vs production path

This document describes what Friġġ auth does today, what was hardened, and what is still demo-grade.

## Modes

| Mode | Env | Behaviour |
|------|-----|-----------|
| **demo** | `VITE_AUTH_MODE=demo` (explicit) or local **dev** without flag | Sign-in with a new email may auto-create a hashed local owner account. Password min length 4. |
| **production** (default on `import.meta.env.PROD`) | unset on prod hosts, or `VITE_AUTH_MODE=production` | No auto-create on sign-in. Must register via onboarding/invite. Password min length 8. |

Server-side household sync always hashes the password with `hashSyncPassword` (email + password + salt version). Mode only affects **client** registration/sign-in UX rules.

## What is hardened (ready for real family use with caveats)

1. **No plain-text passwords in `localStorage` accounts**  
   Accounts store `passwordHash` only. On successful sign-in, any legacy plain `password` field is verified once, then migrated to hash and stripped.

2. **Consistent hash scheme**  
   Local verify and cloud sync both use `hashSyncPassword` / `hashPassword` (SHA-256 of `email:password:frigg-sync-v2`).

3. **Structured session**  
   - Key: `friggg-auth-session`  
   - Fields: `userId`, `email`, `issuedAt`, `expiresAt` (default TTL 30 days)  
   - `friggg-logged-in` / `friggg-current-user` still mirrored for older code paths  
   - Logout clears session + sync sessionStorage creds

4. **Sync snapshots never push plain passwords**  
   `buildSnapshotFromLocalStorage` / `applySnapshotToLocalStorage` strip `password` from account rows. `passwordHash` may remain for member identity; cloud **auth** still uses the login password hashed server-side per email record.

5. **Invite join** writes hashed local accounts and establishes a session (same as owner register / sign-in).

## What remains demo / not production identity

| Gap | Why it matters | TODO |
|-----|----------------|------|
| **No email verification** | Anyone who knows/guesses an email can register it if unused | Send magic link or confirm code before account is active |
| **No OAuth / passkeys** | Password-only, app-managed | Add Apple/Google or WebAuthn |
| **Client-side hashing only (browser)** | Hash is computed in the client before send; not a full server-side KDF (bcrypt/argon2) with per-user salt | Move to server-side Argon2/bcrypt with unique salts; never send raw password to storage layers beyond TLS |
| **Ephemeral plain password in `sessionStorage`** | Needed so background household push can re-auth without re-prompt | Prefer short-lived refresh tokens / server session after login |
| **Demo auto-create** | Convenient for demos; dangerous if `VITE_AUTH_MODE` left at default in prod deploys | Set `VITE_AUTH_MODE=production` on real hosts |
| **No rate limiting / lockout on client** | Brute force only limited by server if added | Add server rate limits on pull/push |
| **SHA-256 is not a password KDF** | Fine as a consistent shared secret for household sync demo; not ideal for password databases | Upgrade hash algorithm server-side |

## Multi-device household sync (must keep working)

**Still works for existing and new accounts:**

1. User signs in / registers / accepts invite with email + password.  
2. Client saves sync creds to **sessionStorage** only (`friggg-sync-creds`).  
3. `pullAndMergeOnLogin` restores cloud snapshot (pantry, members, receipts, …).  
4. Debounced push uses the same session password to re-hash and auth with the server.  
5. Same email + password on device B restores the household.

**Change for existing users with plain passwords still in localStorage:**  
Next successful sign-in migrates to `passwordHash` and removes plain text. Sync continues as long as they sign in (sessionStorage gets the password again). If they never re-enter the password and only had plain local recovery, background push after a full browser restart may require re-login (by design).

## Key modules

| File | Role |
|------|------|
| `src/lib/auth.ts` | Mode, hash/verify, session read/write, password strength |
| `src/lib/family.ts` | `signInWithAccount`, `registerOwnerAccount`, `acceptInviteAndCreateAccount` |
| `src/hooks/useAuthSession.ts` | App gate: authenticated vs LoginScreen |
| `src/lib/sync-session.ts` | Tab-scoped sync password |
| `src/lib/household-sync.ts` | Snapshot build/apply; account sanitization |
| `src/lib/household-sync.functions.ts` | Server store + passwordHash auth |

## UX guarantee

Login / onboarding UI (welcome → household → profile) is unchanged. Hardening is under the form handlers and storage layer only.

## Recommended deploy checklist

- [ ] `VITE_AUTH_MODE=production` (or leave unset on prod builds — defaults to production)
- [ ] Upstash (or durable store) for multi-device
- [ ] HTTPS only
- [ ] Do not log passwords or sync creds
- [ ] Plan email verification + better KDF before “public SaaS” launch

## Follow-ups (not in current pass)

- Argon2/bcrypt server KDF with per-user salt  
- Email verification / magic link  
- OAuth / passkeys  
- Full server session cookies (replace sessionStorage password for push)
