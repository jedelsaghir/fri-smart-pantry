/**
 * Household sync + invite server functions (thin createServerFn wrappers only).
 *
 * Runtime helpers live in `household-sync.server.ts` so TanStack Start's
 * production `?tss-serverfn-split` transform does not strip them.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  resolveHouseholdSyncStatus,
  runAcceptHouseholdInvite,
  runLoginServerAccount,
  runPullHouseholdSync,
  runPushHouseholdSync,
  runRegisterHouseholdInvite,
  runRegisterServerAccount,
  runResolveHouseholdInvite,
  runRevokeHouseholdInvite,
  validateAcceptInviteInput,
  validateLoginServerAccountInput,
  validatePullInput,
  validatePushInput,
  validateRegisterInviteInput,
  validateRegisterServerAccountInput,
  validateResolveInviteInput,
  validateRevokeInviteInput,
  type AcceptInviteInput,
  type LoginServerAccountInput,
  type PullInput,
  type PushInput,
  type RegisterInviteInput,
  type RegisterServerAccountInput,
  type ResolveInviteInput,
  type RevokeInviteInput,
  type ServerAccountProfile,
  type SyncStatusResult,
} from "@/lib/household-sync.server";
import type { HouseholdSyncSnapshot } from "@/lib/household-sync";

export type {
  HouseholdInviteRecord,
  SyncStatusResult,
  PullInput,
  PushInput,
  RegisterInviteInput,
  ResolveInviteInput,
  AcceptInviteInput,
  RevokeInviteInput,
  RegisterServerAccountInput,
  LoginServerAccountInput,
  ServerAccountProfile,
} from "@/lib/household-sync.server";

export const getHouseholdSyncStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<SyncStatusResult> => resolveHouseholdSyncStatus()
);

export const pullHouseholdSync = createServerFn({ method: "POST" })
  .validator((data: PullInput) => validatePullInput(data))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; snapshot: HouseholdSyncSnapshot | null } | { ok: false; reason: string }
    > => runPullHouseholdSync(data)
  );

export const pushHouseholdSync = createServerFn({ method: "POST" })
  .validator((data: PushInput) => validatePushInput(data))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; backend: string; updatedAt: string }
      | { ok: false; reason: string; remoteUpdatedAt?: string }
    > => runPushHouseholdSync(data)
  );

export const registerHouseholdInvite = createServerFn({ method: "POST" })
  .validator((data: RegisterInviteInput) => validateRegisterInviteInput(data))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; code: string } | { ok: false; reason: string }> =>
      runRegisterHouseholdInvite(data)
  );

export const resolveHouseholdInvite = createServerFn({ method: "POST" })
  .validator((data: ResolveInviteInput) => validateResolveInviteInput(data))
  .handler(async ({ data }) => runResolveHouseholdInvite(data));

export const acceptHouseholdInvite = createServerFn({ method: "POST" })
  .validator((data: AcceptInviteInput) => validateAcceptInviteInput(data))
  .handler(async ({ data }) => runAcceptHouseholdInvite(data));

export const revokeHouseholdInvite = createServerFn({ method: "POST" })
  .validator((data: RevokeInviteInput) => validateRevokeInviteInput(data))
  .handler(
    async ({ data }): Promise<{ ok: true } | { ok: false; reason: string }> =>
      runRevokeHouseholdInvite(data)
  );

export const registerServerAccount = createServerFn({ method: "POST" })
  .validator((data: RegisterServerAccountInput) => validateRegisterServerAccountInput(data))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; profile: ServerAccountProfile; backend: string }
      | { ok: false; reason: string }
    > => runRegisterServerAccount(data)
  );

export const loginServerAccount = createServerFn({ method: "POST" })
  .validator((data: LoginServerAccountInput) => validateLoginServerAccountInput(data))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; profile: ServerAccountProfile; hasSnapshot: boolean }
      | { ok: false; reason: string; code?: "not_found" | "bad_password" | "rate_limit" | "error" }
    > => runLoginServerAccount(data)
  );
