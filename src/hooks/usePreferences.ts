"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { getPlatform } from "@/platform";
import { firstNameFromDisplayName } from "@/lib/greeting";
import { loadStoredProfile } from "@/lib/family";
import type { FamilyMember } from "@/types/pantry";

/**
 * Profile, dark mode, and notification preference — settings drawer concerns.
 */
export function usePreferences(options?: {
  onProfileSaved?: (profile: { name: string; email: string; emoji: string }) => void;
  setFamilyMembers?: Dispatch<SetStateAction<FamilyMember[]>>;
}) {
  const applyProfile = useCallback(
    (profile: { name?: string; email?: string; emoji?: string }) => {
      const name = (profile.name || "").trim();
      const email = (profile.email || "").trim();
      const emoji = (profile.emoji || "").trim() || "👤";
      setUserFullName(name || "Your name");
      setUserName(firstNameFromDisplayName(name || null));
      setUserEmail(email);
      setUserEmoji(emoji);
      setProfileDraft({
        name: name || "Your name",
        email,
        emoji,
      });
    },
    []
  );

  const [userName, setUserName] = useState("there");
  const [userFullName, setUserFullName] = useState("Your name");
  const [userEmail, setUserEmail] = useState("");
  const [userEmoji, setUserEmoji] = useState("👤");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    name: "Your name",
    email: "",
    emoji: "👤",
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const v = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (v === null) return true;
      return v === "true";
    } catch {
      return true;
    }
  });

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    applyProfile(loadStoredProfile());
  }, [applyProfile]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = saved ? saved === "dark" : prefersDark;
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const saveProfile = useCallback(() => {
    const name = profileDraft.name.trim() || "Your name";
    const email = profileDraft.email.trim();
    const emoji = profileDraft.emoji.trim() || "👤";
    try {
      const prev = loadStoredProfile();
      localStorage.setItem(
        STORAGE_KEYS.PROFILE,
        JSON.stringify({
          name,
          email,
          emoji,
          memberId: prev.memberId,
          accountId: prev.accountId,
        })
      );
      if (prev.accountId) {
        try {
          const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
          const accounts = raw ? JSON.parse(raw) : [];
          if (Array.isArray(accounts)) {
            const next = accounts.map((a: { id?: string }) =>
              a.id === prev.accountId ? { ...a, name, email, emoji } : a
            );
            localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(next));
          }
        } catch {
          /* ignore */
        }
      }
      options?.setFamilyMembers?.((members) =>
        members.map((m) =>
          m.isYou || m.status === "owner" ? { ...m, name, emoji, email } : m
        )
      );
    } catch {
      /* ignore */
    }
    applyProfile({ name, email, emoji });
    options?.onProfileSaved?.({ name, email, emoji });
    setEditingProfile(false);
    toast.success("Profile updated", {
      description: `Greeting will use ${name.split(/\s+/)[0] || name}.`,
    });
  }, [profileDraft, applyProfile, options]);

  const toggleNotifications = useCallback(async (checked: boolean) => {
    setNotificationsEnabled(checked);
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, String(checked));
    } catch {
      /* ignore */
    }
    if (checked) {
      const platform = getPlatform();
      const perm = await platform.push.requestPermission();
      toast.message("Alerts on", {
        description:
          perm === "granted"
            ? "In-app Alerts on. Browser notifications allowed if the OS permits."
            : "In-app Alerts on. Browser push not granted (optional).",
      });
    } else {
      toast.message("Alerts off", {
        description: "In-app alerts preference saved.",
      });
    }
  }, []);

  const toggleDarkMode = useCallback(
    (checked?: boolean) => {
      const next = typeof checked === "boolean" ? checked : !isDark;
      setIsDark(next);
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem(STORAGE_KEYS.THEME, "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem(STORAGE_KEYS.THEME, "light");
      }
    },
    [isDark]
  );

  const reloadProfile = useCallback(() => {
    applyProfile(loadStoredProfile());
  }, [applyProfile]);

  return {
    userName,
    userFullName,
    userEmail,
    userEmoji,
    editingProfile,
    setEditingProfile,
    profileDraft,
    setProfileDraft,
    saveProfile,
    applyProfile,
    reloadProfile,
    notificationsEnabled,
    toggleNotifications,
    isDark,
    toggleDarkMode,
  };
}
