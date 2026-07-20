# Lovable request: Active accounts list

**Status:** open request for Lovable editor  
**Date:** 2026-07-20

## Paste this into the Lovable project chat

```
Generate a list of active accounts in Friġġ.

Add an “Active accounts” section in Settings (preferred) or Manage Family.

Data sources (existing only):
- loadAccounts() / localStorage friggg-accounts
- CURRENT_USER for the signed-in session
- FAMILY_MEMBERS to show owner vs joined role when possible
- optional: readLocalSyncMeta() for last sync time

For each account show: emoji, display name, email, role, and a “You” badge for the current session.
Do NOT show passwords.
Do NOT seed fake people (no Elena/Alex).
Match the calm elevated-card mobile UI; no horizontal scroll.
Do not break multi-device cloud sync or login.

Acceptance: after sign-in on PC and iOS with the same email, the list reflects real synced accounts.
```

## Why

Multi-device sync is wired; users need a clear view of which accounts exist on this household device / snapshot.
