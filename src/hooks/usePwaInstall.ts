"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/lib/storage-keys";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandalonePwa(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      Boolean((navigator as { standalone?: boolean }).standalone)
    );
  } catch {
    return false;
  }
}

/**
 * PWA install prompt (beforeinstallprompt) + iOS Share-sheet guidance (M-15).
 */
export function usePwaInstall() {
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsIos(isIosDevice());
    if (isStandalonePwa()) return;

    const dismissed = (() => {
      try {
        return Boolean(localStorage.getItem(STORAGE_KEYS.INSTALL_DISMISSED));
      } catch {
        return false;
      }
    })();

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      if (!dismissed) {
        setTimeout(() => setShowInstallBanner(true), 1200);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);

    // M-15: iOS never fires beforeinstallprompt — show calm Share guidance once
    if (isIosDevice() && !dismissed) {
      setTimeout(() => setShowInstallBanner(true), 1600);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (installPromptEvent) {
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
      return;
    }
    // iOS / no prompt
    toast.message("Add to Home Screen", {
      description: isIosDevice()
        ? "Tap Share → Add to Home Screen (Safari)."
        : "Use your browser menu → Install app / Add to Home Screen.",
      duration: 6000,
    });
  }, [installPromptEvent]);

  const dismissInstall = useCallback(() => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  const iosInstallHint =
    "On iPhone/iPad: open in Safari → Share button → Add to Home Screen.";

  return {
    installPromptEvent,
    showInstallBanner: showInstallBanner && !isStandalonePwa(),
    isIos,
    iosInstallHint,
    handleInstall,
    dismissInstall,
  };
}
