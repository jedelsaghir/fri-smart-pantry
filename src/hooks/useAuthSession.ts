"use client";

import { useCallback, useEffect, useState } from "react";
import { clearAuthSession, isSessionAuthenticated } from "@/lib/auth";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { loadSyncCreds } from "@/lib/sync-session";
import { flushHouseholdPush, logoutSyncSession } from "@/lib/run-household-sync";

/**
 * Login flag, splash gate, and session glue for LoginScreen ↔ main app.
 * Prefers structured auth session (with expiry); mirrors legacy LOGGED_IN for compatibility.
 */
export function useAuthSession(options?: {
  onAuthenticated?: () => void;
  onLoggedOut?: () => void;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return isSessionAuthenticated();
    } catch {
      return false;
    }
  });
  const [forcedInviteCode, setForcedInviteCode] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 720);
    return () => clearTimeout(t);
  }, []);

  // Re-check expiry when tab becomes visible (session may have lapsed)
  useEffect(() => {
    const onVis = () => {
      try {
        if (!isSessionAuthenticated()) {
          setIsAuthenticated(false);
        }
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const doLogin = useCallback(() => {
    // Session is established by signIn/register/invite; mirror flag if still needed
    try {
      if (localStorage.getItem(STORAGE_KEYS.LOGGED_IN) !== "true") {
        localStorage.setItem(STORAGE_KEYS.LOGGED_IN, "true");
      }
    } catch {
      /* ignore */
    }
    setForcedInviteCode(null);
    setIsAuthenticated(true);
    loadSyncCreds();
    void flushHouseholdPush();
    options?.onAuthenticated?.();
  }, [options]);

  const doLogout = useCallback(() => {
    void flushHouseholdPush().finally(() => {
      logoutSyncSession();
    });
    clearAuthSession();
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch {
      /* ignore */
    }
    setIsAuthenticated(false);
    options?.onLoggedOut?.();
  }, [options]);

  const clearForcedInvite = useCallback(() => setForcedInviteCode(null), []);

  return {
    isAuthenticated,
    setIsAuthenticated,
    forcedInviteCode,
    setForcedInviteCode,
    clearForcedInvite,
    showSplash,
    doLogin,
    doLogout,
  };
}
