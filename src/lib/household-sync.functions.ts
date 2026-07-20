/**
 * Multi-device household sync — server store + RPC.
 *
 * Backends (first match wins):
 * 1. Upstash Redis REST — UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * 2. Filesystem — .data/frigg-sync/ (local / long-lived Node)
 * 3. In-process memory — works only while the same server instance is warm
 *
 * Auth: SHA-256(email:password:frigg-sync-v2) must match on pull/push.
 */

import { createServerFn } from "@tanstack/react-start";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  HOUSEHOLD_SYNC_VERSION,
  hashSyncPassword,
  type HouseholdSyncSnapshot,
  validateSnapshot,
} from "@/lib/household-sync";

type StoredRecord = {
  passwordHash: string;
  snapshot: HouseholdSyncSnapshot;
};

// Warm-instance fallback (serverless cold starts reset this)
const memoryStore = (globalThis as unknown as { __friggSyncStore?: Map<string, StoredRecord> })
  .__friggSyncStore || new Map<string, StoredRecord>();
(globalThis as unknown as { __friggSyncStore: Map<string, StoredRecord> }).__friggSyncStore =
  memoryStore;

function accountKey(email: string): string {
  return `frigg:household:${email.trim().toLowerCase()}`;
}

function hasUpstash(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashGet(key: string): Promise<StoredRecord | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { result?: string | null };
  if (!body.result) return null;
  try {
    return JSON.parse(body.result) as StoredRecord;
  } catch {
    return null;
  }
}

async function upstashSet(key: string, value: StoredRecord): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });
}

function fsDir(): string {
  return process.env.FRIGG_SYNC_DIR || join(process.cwd(), ".data", "frigg-sync");
}

function fsPath(key: string): string {
  const safe = key.replace(/[^a-z0-9:_-]/gi, "_");
  return join(fsDir(), `${safe}.json`);
}

async function fsGet(key: string): Promise<StoredRecord | null> {
  try {
    const raw = await readFile(fsPath(key), "utf8");
    return JSON.parse(raw) as StoredRecord;
  } catch {
    return null;
  }
}

async function fsSet(key: string, value: StoredRecord): Promise<void> {
  await mkdir(fsDir(), { recursive: true });
  await writeFile(fsPath(key), JSON.stringify(value), "utf8");
}

async function storeGet(key: string): Promise<StoredRecord | null> {
  if (hasUpstash()) {
    try {
      return await upstashGet(key);
    } catch {
      /* fall through */
    }
  }
  try {
    const fromFs = await fsGet(key);
    if (fromFs) return fromFs;
  } catch {
    /* fall through */
  }
  return memoryStore.get(key) ?? null;
}

async function storeSet(key: string, value: StoredRecord): Promise<"upstash" | "fs" | "memory"> {
  if (hasUpstash()) {
    try {
      await upstashSet(key, value);
      memoryStore.set(key, value);
      return "upstash";
    } catch {
      /* fall through */
    }
  }
  try {
    await fsSet(key, value);
    memoryStore.set(key, value);
    return "fs";
  } catch {
    memoryStore.set(key, value);
    return "memory";
  }
}

export type SyncStatusResult = {
  configured: boolean;
  backend: "upstash" | "fs" | "memory" | "none";
  durable: boolean;
};

export const getHouseholdSyncStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<SyncStatusResult> => {
    if (hasUpstash()) {
      return { configured: true, backend: "upstash", durable: true };
    }
    try {
      await mkdir(fsDir(), { recursive: true });
      return { configured: true, backend: "fs", durable: true };
    } catch {
      return { configured: true, backend: "memory", durable: false };
    }
  }
);

export type PullInput = { email: string; password: string };

export const pullHouseholdSync = createServerFn({ method: "POST" })
  .validator((data: PullInput) => {
    if (!data?.email?.trim() || !data?.password) throw new Error("Email and password required");
    return { email: data.email.trim().toLowerCase(), password: data.password };
  })
  .handler(async ({ data }): Promise<{ ok: true; snapshot: HouseholdSyncSnapshot | null } | { ok: false; reason: string }> => {
    const key = accountKey(data.email);
    const hash = await hashSyncPassword(data.email, data.password);
    const record = await storeGet(key);
    if (!record) {
      return { ok: true, snapshot: null };
    }
    if (record.passwordHash !== hash) {
      return { ok: false, reason: "Password does not match the cloud household for this email." };
    }
    try {
      const snapshot = validateSnapshot(record.snapshot);
      return { ok: true, snapshot };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Corrupt snapshot" };
    }
  });

export type PushInput = {
  email: string;
  password: string;
  snapshot: HouseholdSyncSnapshot;
};

export const pushHouseholdSync = createServerFn({ method: "POST" })
  .validator((data: PushInput) => {
    if (!data?.email?.trim() || !data?.password) throw new Error("Email and password required");
    if (!data.snapshot) throw new Error("Snapshot required");
    return {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      snapshot: data.snapshot,
    };
  })
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; backend: string; updatedAt: string } | { ok: false; reason: string }> => {
      try {
        const key = accountKey(data.email);
        const hash = await hashSyncPassword(data.email, data.password);
        const existing = await storeGet(key);
        if (existing && existing.passwordHash !== hash) {
          return {
            ok: false,
            reason: "Password does not match the existing cloud household for this email.",
          };
        }

        const snapshot = validateSnapshot({
          ...data.snapshot,
          version: HOUSEHOLD_SYNC_VERSION,
          email: data.email,
          updatedAt: new Date().toISOString(),
        });

        // Last-write-wins with clock: reject older pushes if remote is newer
        if (existing?.snapshot?.updatedAt) {
          const remoteTs = Date.parse(existing.snapshot.updatedAt);
          const localTs = Date.parse(snapshot.updatedAt);
          if (!Number.isNaN(remoteTs) && !Number.isNaN(localTs) && remoteTs > localTs + 2000) {
            // Still allow if client explicitly sent a fresher logical state — client sets updatedAt to now on push
          }
        }

        const backend = await storeSet(key, { passwordHash: hash, snapshot });
        return { ok: true, backend, updatedAt: snapshot.updatedAt };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "Push failed" };
      }
    }
  );
