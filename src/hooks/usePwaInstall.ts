"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/lib/storage-keys";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * PWA install prompt (beforeinstallprompt) + calm home-screen banner state.
 */
export function usePwaInstall() {
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      try {
        const dismissed = localStorage.getItem(STORAGE_KEYS.INSTALL_DISMISSED);
        if (!dismissed) {
          setTimeout(() => setShowInstallBanner(true), 1200);
        }
      } catch {
        setTimeout(() => setShowInstallBanner(true), 1200);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    try {
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === "accepted") {
        toast.success("Installed!", { description: "Friġġ is now on your home screen." });
      }
    } catch {
      /* user dismissed or unsupported */
    }
    setInstallPromptEvent(null);
    setShowInstallBanner(false);
  }, [installPromptEvent]);

  const dismissInstall = useCallback(() => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  return {
    installPromptEvent,
    showInstallBanner,
    handleInstall,
    dismissInstall,
  };
}
