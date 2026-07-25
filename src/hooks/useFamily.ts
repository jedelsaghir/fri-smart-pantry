"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ActivityLogEntry, FamilyMember } from "@/types/pantry";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  buildInviteUrl,
  createMemberId,
  defaultFamilyMembers,
  generateInviteCode,
  loadFamilyMembers,
  loadHouseholdName,
  normalizeFamilyMember,
  saveFamilyMembers,
  saveHouseholdName,
} from "@/lib/family";

type UseFamilyOptions = {
  onInviteOpened?: (code: string) => void;
};

/**
 * Household name, members, activity log, and invite helpers.
 */
export function useFamily(options?: UseFamilyOptions) {
  const [householdName, setHouseholdName] = useState(() =>
    typeof window === "undefined" ? "Family pantry" : loadHouseholdName("Family pantry")
  );

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => {
    if (typeof window === "undefined") return defaultFamilyMembers();
    return loadFamilyMembers();
  });

  useEffect(() => {
    saveFamilyMembers(familyMembers);
  }, [familyMembers]);

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as ActivityLogEntry[];
      }
    } catch {
      /* ignore */
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(activityLog.slice(0, 50)));
    } catch {
      /* ignore */
    }
  }, [activityLog]);

  const [showFamilyDrawer, setShowFamilyDrawer] = useState(false);
  const [showManageFamily, setShowManageFamily] = useState(false);

  const addActivity = useCallback((user: string, action: string) => {
    setActivityLog((prev) => [{ user, action, time: "just now" }, ...prev.slice(0, 49)]);
  }, []);

  const clearActivity = useCallback(() => {
    setActivityLog([]);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify([]));
    } catch {
      /* ignore */
    }
  }, []);

  const reloadHousehold = useCallback(() => {
    setFamilyMembers(loadFamilyMembers());
    setHouseholdName(loadHouseholdName("Family pantry"));
  }, []);

  const renameHousehold = useCallback(
    (name: string) => {
      const saved = saveHouseholdName(name);
      setHouseholdName(saved);
      addActivity("You", `renamed household to ${saved}`);
    },
    [addActivity]
  );

  const addFamilyMember = useCallback(
    (member: Omit<FamilyMember, "id" | "isYou">): FamilyMember => {
      const id = createMemberId();
      const full = normalizeFamilyMember({
        id,
        name: member.name,
        emoji: member.emoji,
        phone: member.phone || "",
        inviteCode: member.inviteCode || generateInviteCode(),
        status: member.status || "pending",
        email: member.email,
      });
      setFamilyMembers((prev) => {
        const next = [...prev, full];
        saveFamilyMembers(next); // immediate persist for invite publish snapshot
        return next;
      });
      addActivity("You", `invited ${member.name} to the household`);
      return full;
    },
    [addActivity]
  );

  const removeFamilyMember = useCallback(
    (id: string): FamilyMember | null => {
      let removed: FamilyMember | null = null;
      setFamilyMembers((prev) => {
        const target = prev.find((m) => m.id === id);
        if (!target || target.isYou || target.status === "owner") return prev;
        removed = target;
        const action =
          target.status === "pending"
            ? `cancelled invite for ${target.name}`
            : `removed ${target.name} from the household`;
        addActivity("You", action);
        const next = prev.filter((m) => m.id !== id);
        saveFamilyMembers(next);
        return next;
      });
      return removed;
    },
    [addActivity]
  );

  const updateFamilyMember = useCallback((id: string, patch: Partial<FamilyMember>) => {
    setFamilyMembers((prev) => {
      const next = prev.map((m) =>
        m.id === id
          ? normalizeFamilyMember({ ...m, ...patch, id: m.id, name: patch.name ?? m.name })
          : m
      );
      saveFamilyMembers(next);
      return next;
    });
  }, []);

  const simulateAcceptInvite = useCallback(
    (member: FamilyMember) => {
      const code = member.inviteCode || generateInviteCode();
      if (!member.inviteCode) {
        updateFamilyMember(member.id, { inviteCode: code, status: "pending" });
      }
      setShowManageFamily(false);
      setShowFamilyDrawer(false);
      try {
        localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
        localStorage.setItem(STORAGE_KEYS.PENDING_INVITE, code);
      } catch {
        /* ignore */
      }
      try {
        const url = buildInviteUrl(code);
        window.history.replaceState({}, "", new URL(url).pathname + new URL(url).search);
      } catch {
        /* ignore */
      }
      toast.message("Invite opened", {
        description: `Create an account as ${member.name} to join the shared pantry.`,
      });
      options?.onInviteOpened?.(code);
    },
    [updateFamilyMember, options]
  );

  return {
    householdName,
    setHouseholdName,
    familyMembers,
    setFamilyMembers,
    activityLog,
    addActivity,
    clearActivity,
    renameHousehold,
    addFamilyMember,
    removeFamilyMember,
    updateFamilyMember,
    simulateAcceptInvite,
    reloadHousehold,
    showFamilyDrawer,
    setShowFamilyDrawer,
    showManageFamily,
    setShowManageFamily,
  };
}
