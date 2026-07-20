"use client";

import type { StorageKey } from "@/types/pantry";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export type AlertRow = {
  id: string;
  emoji: string;
  name: string;
  reason: string;
  storage: StorageKey;
};

export function AlertsDrawer({
  open,
  onOpenChange,
  notificationsEnabled,
  alertItems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notificationsEnabled: boolean;
  alertItems: AlertRow[];
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader className="text-left">
          <DrawerTitle>Alerts</DrawerTitle>
          <DrawerDescription>
            {notificationsEnabled
              ? "Items that need attention in your pantry"
              : "In-app alerts are off — turn them on in Settings"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-5 pb-4 max-h-[50vh] overflow-y-auto">
          {!notificationsEnabled ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Enable <strong className="text-foreground">In-app alerts</strong> in Settings to see
              expiry and low stock here.
            </p>
          ) : alertItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              All clear — nothing expiring or low right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {alertItems.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-2xl bg-secondary/55 px-3 py-2.5 ring-1 ring-border/25"
                >
                  <span className="text-2xl">{a.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {a.storage} · {a.reason}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DrawerFooter className="pt-1 pb-6">
          <DrawerClose asChild>
            <button
              type="button"
              className="w-full rounded-3xl py-3.5 text-sm font-semibold border active:bg-secondary/60"
            >
              Done
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
