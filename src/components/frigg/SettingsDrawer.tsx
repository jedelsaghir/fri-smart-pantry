"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import {
  applyBackupToLocalStorage,
  buildBackupFromLocalStorage,
  downloadBackupJson,
  parseAndValidateBackup,
} from "@/lib/backup";
import { APP_BUILD } from "@/lib/app-build";
import { readLocalSyncMeta } from "@/lib/household-sync";
import { flushHouseholdPush, pullAndMergeOnLogin } from "@/lib/run-household-sync";
import { loadSyncCreds } from "@/lib/sync-session";
import { listLocalAccounts, wipeAllFriggLocalData } from "@/lib/reset-app";
import { getPlatform } from "@/platform";

export function SettingsDrawer({
  open,
  onOpenChange,
  userFullName,
  userEmail,
  userEmoji,
  householdName,
  memberCount,
  isDark,
  notificationsEnabled,
  editingProfile,
  profileDraft,
  hasInstallPrompt,
  onStartEditProfile,
  onCancelEditProfile,
  onProfileDraftChange,
  onSaveProfile,
  onToggleNotifications,
  onToggleDarkMode,
  onManageFamily,
  onInstall,
  onShowInstallHint,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userFullName: string;
  userEmail: string;
  userEmoji: string;
  householdName: string;
  memberCount: number;
  isDark: boolean;
  notificationsEnabled: boolean;
  editingProfile: boolean;
  profileDraft: { name: string; email: string; emoji: string };
  hasInstallPrompt: boolean;
  onStartEditProfile: () => void;
  onCancelEditProfile: () => void;
  onProfileDraftChange: (draft: { name: string; email: string; emoji: string }) => void;
  onSaveProfile: () => void;
  onToggleNotifications: (checked: boolean) => void;
  onToggleDarkMode: (checked: boolean) => void;
  onManageFamily: () => void;
  onInstall: () => void;
  onShowInstallHint: () => void;
  onLogout: () => void;
}) {
  const [syncBusy, setSyncBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{
    backend: string;
    durable: boolean;
    lastPushedAt?: string;
    lastPulledAt?: string;
    lastError?: string;
  }>({ backend: "…", durable: false });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const meta = readLocalSyncMeta();
      let backend = "cloud";
      let durable = false;
      try {
        const status = await getPlatform().sync.getStatus?.();
        if (status) {
          backend = status.backend;
          durable = status.durable;
        }
      } catch {}
      if (!cancelled) {
        setSyncInfo({
          backend,
          durable,
          lastPushedAt: meta.lastPushedAt,
          lastPulledAt: meta.lastPulledAt,
          lastError: meta.lastError,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, syncBusy]);

  const handleSyncNow = async () => {
    const creds = loadSyncCreds();
    if (!creds) {
      toast.error("Sign in again", {
        description: "Cloud sync needs your email & password for this session.",
      });
      return;
    }
    setSyncBusy(true);
    try {
      const pull = await pullAndMergeOnLogin(creds);
      const push = await flushHouseholdPush();
      if (pull.applied) {
        toast.success("Synced", {
          description: "Cloud household applied. Reloading…",
        });
        window.setTimeout(() => window.location.reload(), 400);
        return;
      }
      if (push.ok) {
        toast.success("Uploaded", {
          description: "This device’s household is on the cloud for your other devices.",
        });
      } else {
        toast.error("Sync issue", { description: push.reason || pull.error || "Try again" });
      }
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto max-h-[92dvh]">
        <DrawerHeader className="text-left pb-1">
          <DrawerTitle>Settings</DrawerTitle>
          <DrawerDescription>Account, household &amp; preferences</DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto overscroll-contain px-5 pb-3 space-y-4 text-sm max-h-[min(70dvh,560px)]">
          {/* Profile */}
          <div className="elevated-card rounded-3xl p-4">
            {editingProfile ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={profileDraft.emoji}
                    onChange={(e) =>
                      onProfileDraftChange({ ...profileDraft, emoji: e.target.value })
                    }
                    className="h-11 w-14 rounded-2xl border border-border/50 bg-background/80 text-center text-xl"
                    aria-label="Emoji"
                    maxLength={4}
                    enterKeyHint="next"
                  />
                  <input
                    value={profileDraft.name}
                    onChange={(e) =>
                      onProfileDraftChange({ ...profileDraft, name: e.target.value })
                    }
                    className="h-11 min-w-0 flex-1 rounded-2xl border border-border/50 bg-background/80 px-3 text-base font-semibold"
                    aria-label="Full name"
                    enterKeyHint="next"
                    autoComplete="name"
                  />
                </div>
                <input
                  value={profileDraft.email}
                  onChange={(e) =>
                    onProfileDraftChange({ ...profileDraft, email: e.target.value })
                  }
                  type="email"
                  className="h-11 w-full rounded-2xl border border-border/50 bg-background/80 px-3 text-base"
                  aria-label="Email"
                  enterKeyHint="done"
                  autoComplete="email"
                  inputMode="email"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onCancelEditProfile}
                    className="touch-target flex-1 rounded-2xl border py-2.5 text-xs font-semibold active:bg-secondary/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSaveProfile}
                    className="touch-target flex-1 rounded-2xl bg-brand py-2.5 text-xs font-semibold text-brand-foreground active:scale-[0.985]"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-3xl" aria-hidden>
                  {userEmoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{userFullName}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {userEmail || "No email set"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onStartEditProfile}
                  className="touch-target text-xs px-3 py-1 rounded-full border active:bg-secondary font-semibold"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Household */}
          <div className="elevated-card rounded-3xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">Household</div>
                <div className="text-sm truncate">
                  {householdName} • {memberCount} member{memberCount === 1 ? "" : "s"}
                </div>
              </div>
              <button
                type="button"
                onClick={onManageFamily}
                className="touch-target shrink-0 text-xs px-3 py-1.5 rounded-full border font-semibold active:bg-secondary"
              >
                Manage
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground pt-1">
              Shared pantry • activity visible to family
            </div>
          </div>

          {/* Alerts */}
          <div className="elevated-card rounded-3xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">In-app alerts</div>
              <div className="text-xs text-muted-foreground">
                Expiry &amp; low stock in the Alerts panel (bell).
              </div>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={onToggleNotifications}
              aria-label="Toggle in-app alerts"
            />
          </div>

          {/* Install */}
          <div className="elevated-card rounded-3xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Install app</div>
                <div className="text-xs text-muted-foreground">Add Friġġ to your home screen</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (hasInstallPrompt) onInstall();
                  else onShowInstallHint();
                }}
                className="touch-target text-xs px-3.5 py-1.5 rounded-2xl bg-brand text-brand-foreground font-semibold active:scale-[0.985]"
              >
                Install
              </button>
            </div>
          </div>

          {/* Dark mode */}
          <div className="elevated-card rounded-3xl p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">Dark mode</div>
              <div className="text-xs text-muted-foreground">Calm evening palette</div>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={onToggleDarkMode}
              aria-label="Toggle dark mode"
            />
          </div>

          {/* Backup */}
          <div className="elevated-card rounded-3xl p-4 space-y-2">
            <div className="font-semibold">Backup</div>
            <div className="text-xs text-muted-foreground">
              Export or restore pantry, receipts, shopping list, database &amp; family (local only).
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  try {
                    downloadBackupJson(buildBackupFromLocalStorage());
                    toast.success("Backup downloaded");
                  } catch {
                    toast.error("Could not export backup");
                  }
                }}
                className="touch-target flex-1 rounded-2xl border py-2.5 text-xs font-semibold active:bg-secondary/60"
              >
                Export JSON
              </button>
              <label className="flex-1">
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      const valid = parseAndValidateBackup(data);
                      applyBackupToLocalStorage(valid);
                      toast.success("Backup restored", {
                        description: "Reloading to apply all data…",
                      });
                      window.location.reload();
                    } catch (err) {
                      toast.error("Invalid backup file", {
                        description: err instanceof Error ? err.message : "Could not restore",
                      });
                    }
                  }}
                />
                <span className="touch-target flex w-full cursor-pointer items-center justify-center rounded-2xl bg-secondary/70 py-2.5 text-xs font-semibold active:bg-secondary">
                  Import JSON
                </span>
              </label>
            </div>
          </div>

          {/* Multi-device cloud sync */}
          <div className="elevated-card rounded-3xl p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold">Cloud sync</div>
              <p className="mt-1 text-[12px] text-muted-foreground leading-snug">
                Same email &amp; password on phone and computer restores household, members, pantry,
                and profile.
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/50 px-3 py-2.5 text-[12px] space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Backend</span>
                <span className="font-medium tabular-nums">
                  {syncInfo.backend}
                  {syncInfo.durable ? " · durable" : " · session"}
                </span>
              </div>
              {syncInfo.lastPushedAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Last upload</span>
                  <span className="font-medium">
                    {new Date(syncInfo.lastPushedAt).toLocaleString()}
                  </span>
                </div>
              )}
              {syncInfo.lastPulledAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Last restore</span>
                  <span className="font-medium">
                    {new Date(syncInfo.lastPulledAt).toLocaleString()}
                  </span>
                </div>
              )}
              {syncInfo.lastError && (
                <p className="text-[11px] text-destructive/90 pt-0.5">{syncInfo.lastError}</p>
              )}
              {!syncInfo.durable && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-1">
                  Tip: set UPSTASH_REDIS_REST_URL + TOKEN on the server for reliable multi-device
                  sync across restarts.
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={syncBusy}
              onClick={() => void handleSyncNow()}
              className="touch-target w-full rounded-2xl bg-brand py-2.5 text-xs font-semibold text-brand-foreground active:scale-[0.98] disabled:opacity-60"
            >
              {syncBusy ? "Syncing…" : "Sync now"}
            </button>
          </div>

          {/* Danger: wipe everything on this device */}
          <div className="elevated-card rounded-3xl p-4 space-y-2 border border-destructive/25">
            <div className="font-semibold text-destructive">Start fresh</div>
            <p className="text-xs text-muted-foreground leading-snug">
              Delete all accounts, pantry, receipts, and household data on{" "}
              <span className="font-medium text-foreground">this device</span>. You will return to
              the login screen. Repeat on each device (PC and iOS) if both have old data.
            </p>
            {!confirmWipe ? (
              <button
                type="button"
                onClick={() => setConfirmWipe(true)}
                className="touch-target w-full rounded-2xl border border-destructive/40 py-2.5 text-xs font-semibold text-destructive active:bg-destructive/10"
              >
                Delete all accounts &amp; data…
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-destructive">
                  This cannot be undone on this device.
                  {listLocalAccounts().length > 0
                    ? ` ${listLocalAccounts().length} account(s) will be removed.`
                    : " No accounts stored (or already empty)."}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(false)}
                    className="touch-target flex-1 rounded-2xl border py-2.5 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const { removedKeys } = wipeAllFriggLocalData();
                      toast.success("All data wiped", {
                        description: `Cleared ${removedKeys.length} keys. Starting fresh…`,
                      });
                      onOpenChange(false);
                      window.setTimeout(() => window.location.reload(), 300);
                    }}
                    className="touch-target flex-1 rounded-2xl bg-destructive py-2.5 text-xs font-semibold text-destructive-foreground"
                  >
                    Wipe everything
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground px-1 pt-1 space-y-1">
            <p>Friġġ · build {APP_BUILD}</p>
            <p>Sign in with the same account on every device to stay in sync.</p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="touch-target mt-1 w-full rounded-3xl border py-3 text-sm font-semibold text-destructive active:bg-secondary/60"
          >
            Log out
          </button>
        </div>

        <DrawerFooter className="pt-1 pb-6 safe-bottom">
          <DrawerClose asChild>
            <button
              type="button"
              className="touch-target w-full rounded-3xl py-3.5 text-sm font-semibold border active:bg-secondary/60"
            >
              Done
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
