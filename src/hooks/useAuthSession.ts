"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { loadSyncCreds } from "@/lib/sync-session";
import { flushHouseholdPush, logoutSyncSession } from "@/lib/run-household-sync";

/**
 * Login flag, splash gate, and session glue for LoginScreen ↔ main app.
 */
export function useAuthSession(options?: {
  onAuthenticated?: () => void;
  onLoggedOut?: () => void;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEYS.LOGGED_IN) === "true";
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

  const doLogin = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGGED_IN, "true");
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
    try {
      localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
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
