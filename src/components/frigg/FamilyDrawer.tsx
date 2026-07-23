"use client";

import { useState } from "react";
import type { ActivityLogEntry, FamilyMember } from "@/types/pantry";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function FamilyDrawer({
  open,
  onOpenChange,
  householdName,
  members,
  activityLog,
  onSimulateMember,
  onManageFamily,
  /** Owner-only admin entry */
  isAdmin,
  onOpenAdminSettings,
  onClearActivity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdName: string;
  members: FamilyMember[];
  activityLog: ActivityLogEntry[];
  onSimulateMember: (name: string) => void;
  onManageFamily: () => void;
  isAdmin?: boolean;
  onOpenAdminSettings?: () => void;
  onClearActivity?: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-w-md mx-auto max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Household</DrawerTitle>
            <DrawerDescription>
              {householdName} • {members.length} member{members.length === 1 ? "" : "s"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto overscroll-contain px-5 pb-4 space-y-6 max-h-[min(60dvh,480px)]">
            <div>
              <div className="text-sm font-semibold mb-2">Members</div>
              <div className="space-y-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSimulateMember(m.name);
                      onOpenChange(false);
                    }}
                    className="touch-target w-full flex items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-left active:bg-secondary/80 transition"
                  >
                    <div className="text-2xl" aria-hidden>
                      {m.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.isYou ? "Online now" : "Active recently"}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-fresh)] shrink-0">Simulate</div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Demo: tap a member to simulate them updating the shared pantry.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Recent activity</div>
                {onClearActivity && activityLog.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="touch-target rounded-full px-2 py-1 text-[12px] font-semibold text-destructive/90 active:bg-destructive/10"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-2 text-sm">
                {activityLog.length === 0 ? (
                  <div className="text-muted-foreground">No activity yet.</div>
                ) : (
                  activityLog.slice(0, 8).map((entry, i) => (
                    <div
                      key={`${entry.user}-${entry.action}-${i}`}
                      className="flex gap-2 rounded-xl bg-secondary/50 px-3 py-2"
                    >
                      <span className="font-medium shrink-0">{entry.user}</span>
                      <span className="text-foreground/80 min-w-0 truncate">{entry.action}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                        {entry.time}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DrawerFooter className="gap-2 safe-bottom">
            <button
              type="button"
              onClick={onManageFamily}
              className="touch-target w-full rounded-3xl py-3.5 text-sm font-semibold bg-brand text-brand-foreground active:scale-[0.985] transition"
            >
              Manage Family
            </button>
            {isAdmin && onOpenAdminSettings && (
              <button
                type="button"
                onClick={onOpenAdminSettings}
                className="touch-target w-full rounded-3xl py-3.5 text-sm font-semibold border border-border/60 bg-secondary/50 active:scale-[0.985] active:bg-secondary/80 transition"
              >
                Admin Settings
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="touch-target w-full rounded-3xl py-3 text-sm font-semibold border active:bg-secondary/60"
            >
              Done
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="z-[120] max-w-[min(22rem,calc(100vw-2rem))] rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear recent activity?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes all household activity entries from this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                onClearActivity?.();
                setConfirmClear(false);
                toast.success("Activity cleared");
              }}
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
