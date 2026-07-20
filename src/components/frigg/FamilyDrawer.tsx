"use client";

import type { ActivityLogEntry, FamilyMember } from "@/types/pantry";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function FamilyDrawer({
  open,
  onOpenChange,
  householdName,
  members,
  activityLog,
  onSimulateMember,
  onManageFamily,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdName: string;
  members: FamilyMember[];
  activityLog: ActivityLogEntry[];
  onSimulateMember: (name: string) => void;
  onManageFamily: () => void;
}) {
  return (
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
            <div className="text-sm font-semibold mb-2">Recent activity</div>
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
  );
}
