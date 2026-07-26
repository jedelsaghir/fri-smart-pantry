import { describe, expect, it } from "vitest";
import {
  hashSyncPassword,
  sanitizeAccountsForSync,
  shouldApplyRemote,
  validateSnapshot,
  HOUSEHOLD_SYNC_VERSION,
} from "./household-sync";
import {
  collectHouseholdEmails,
  shouldAcceptPush,
  sanitizeSnapshotForStore,
} from "./household-sync.server";

describe("hashSyncPassword", () => {
  it("is stable and case-normalizes email", async () => {
    const a = await hashSyncPassword("Jed@Example.com", "secret");
    const b = await hashSyncPassword("jed@example.com", "secret");
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });

  it("differs by password", async () => {
    const a = await hashSyncPassword("a@b.com", "one");
    const b = await hashSyncPassword("a@b.com", "two");
    expect(a).not.toBe(b);
  });
});

describe("shouldApplyRemote", () => {
  it("applies when no local timestamp", () => {
    expect(shouldApplyRemote(null, "2026-07-20T12:00:00.000Z")).toBe(true);
  });
  it("applies when remote is newer or equal", () => {
    expect(
      shouldApplyRemote("2026-07-20T10:00:00.000Z", "2026-07-20T12:00:00.000Z")
    ).toBe(true);
  });
  it("skips when local is newer", () => {
    expect(
      shouldApplyRemote("2026-07-20T14:00:00.000Z", "2026-07-20T12:00:00.000Z")
    ).toBe(false);
  });
});

describe("validateSnapshot", () => {
  it("normalizes email", () => {
    const s = validateSnapshot({
      version: HOUSEHOLD_SYNC_VERSION,
      updatedAt: new Date().toISOString(),
      email: "  Jed@X.COM ",
      household: "Home",
    });
    expect(s.email).toBe("jed@x.com");
  });
});

describe("sanitizeAccountsForSync", () => {
  it("strips plain passwords", () => {
    const out = sanitizeAccountsForSync([
      {
        id: "a1",
        memberId: "you",
        email: "a@b.com",
        password: "secret",
        passwordHash: "abc",
        name: "A",
        emoji: "👤",
      },
    ]);
    expect(out?.[0].password).toBeUndefined();
    expect(out?.[0].passwordHash).toBe("abc");
    expect(out?.[0].email).toBe("a@b.com");
  });
});

describe("shouldAcceptPush (optimistic concurrency)", () => {
  it("accepts first push with no existing", () => {
    expect(shouldAcceptPush(null, undefined)).toBe(true);
  });
  it("accepts when base matches or is ahead of cloud", () => {
    expect(shouldAcceptPush("2026-07-20T10:00:00.000Z", "2026-07-20T10:00:00.000Z")).toBe(true);
    expect(shouldAcceptPush("2026-07-20T10:00:00.000Z", "2026-07-20T12:00:00.000Z")).toBe(true);
  });
  it("rejects when cloud is newer than client base", () => {
    expect(shouldAcceptPush("2026-07-20T14:00:00.000Z", "2026-07-20T10:00:00.000Z")).toBe(false);
  });
  it("accepts when client has no base (seed)", () => {
    expect(shouldAcceptPush("2026-07-20T14:00:00.000Z", undefined)).toBe(true);
  });
});

describe("collectHouseholdEmails + sanitize snapshot", () => {
  it("collects member emails without primary", () => {
    const emails = collectHouseholdEmails(
      {
        version: HOUSEHOLD_SYNC_VERSION,
        updatedAt: new Date().toISOString(),
        email: "owner@x.com",
        accounts: [
          {
            id: "1",
            memberId: "you",
            email: "owner@x.com",
            name: "O",
            emoji: "👤",
          },
          {
            id: "2",
            memberId: "m2",
            email: "krista@x.com",
            passwordHash: "h",
            name: "K",
            emoji: "👤",
          },
        ],
        familyMembers: [
          {
            id: "m2",
            name: "Krista",
            emoji: "👤",
            phone: "",
            inviteCode: "abc",
            status: "joined",
            isYou: false,
            email: "krista@x.com",
          },
        ],
      },
      "owner@x.com"
    );
    expect(emails).toEqual(["krista@x.com"]);
  });

  it("strips plain passwords from snapshot accounts", () => {
    const s = sanitizeSnapshotForStore({
      version: HOUSEHOLD_SYNC_VERSION,
      updatedAt: new Date().toISOString(),
      email: "a@b.com",
      accounts: [
        {
          id: "1",
          memberId: "you",
          email: "a@b.com",
          password: "plain",
          passwordHash: "h",
          name: "A",
          emoji: "👤",
        },
      ],
    });
    expect(s.accounts?.[0].password).toBeUndefined();
    expect(s.accounts?.[0].passwordHash).toBe("h");
  });
});
