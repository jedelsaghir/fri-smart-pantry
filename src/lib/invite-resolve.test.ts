import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/family", () => ({
  getInviteContext: vi.fn(),
}));
vi.mock("@/lib/member-invite", () => ({
  resolveInviteFromCloud: vi.fn(),
}));

import { getInviteContext } from "@/lib/family";
import { resolveInviteFromCloud } from "@/lib/member-invite";
import { resolveInviteForJoin } from "./invite-resolve";

describe("resolveInviteForJoin (M-12)", () => {
  beforeEach(() => {
    vi.mocked(getInviteContext).mockReset();
    vi.mocked(resolveInviteFromCloud).mockReset();
  });

  it("prefers local over cloud", async () => {
    vi.mocked(getInviteContext).mockReturnValue({
      code: "abc",
      memberId: "m1",
      memberName: "Sam",
      memberEmoji: "👤",
      householdName: "Home",
    });
    const r = await resolveInviteForJoin("abc");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("local");
    expect(resolveInviteFromCloud).not.toHaveBeenCalled();
  });

  it("falls back to cloud", async () => {
    vi.mocked(getInviteContext).mockReturnValue(null);
    vi.mocked(resolveInviteFromCloud).mockResolvedValue({
      code: "xyz",
      memberId: "m2",
      memberName: "Kit",
      memberEmoji: "🌿",
      householdName: "Home",
      ownerEmail: "o@x.com",
      source: "cloud",
    });
    const r = await resolveInviteForJoin("xyz");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("cloud");
  });
});
