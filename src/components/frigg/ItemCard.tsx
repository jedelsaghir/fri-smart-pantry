import { Minus, Plus } from "lucide-react";
import { useRef } from "react";

export interface PantryItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  emoji: string;
  daysLeft: number;
  minStock: number;
}

export type ItemStatus = {
  label: string;
  color: string;
};

export function ItemCard({
  item,
  storage,
  onInc,
  onDec,
  onUpdateMinStock,
  onUpdateDaysLeft,
  onOpenDetails,
}: {
  item: PantryItem;
  storage?: "fridge" | "freezer" | "pantry";
  onInc: () => void;
  onDec: () => void;
  onUpdateMinStock?: (newMin: number) => void;
  onUpdateDaysLeft?: (newDays: number) => void;
  onOpenDetails?: () => void;
}) {
  const status = getStatus(item.daysLeft);

  // Long-press timer ref for opening details
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (e: React.PointerEvent) => {
    // Don't long-press from controls
    if ((e.target as HTMLElement).closest("button")) return;
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      onOpenDetails?.();
      // Optional light haptic on supported devices
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }, 520);
  };

  const endLongPress = () => {
    clearLongPress();
  };

  // Tap the main content (emoji + info) to open details drawer for expiration / move actions
  const handleContentClick = (e: React.MouseEvent) => {
    // Prevent opening details when tapping the qty stepper or min controls
    if ((e.target as HTMLElement).closest("button")) return;
    // If a long-press just fired, suppress the click
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onOpenDetails?.();
  };

  return (
    <li
      className="elevated-card flex flex-col gap-2 rounded-3xl px-3 py-3 text-sm select-none"
      onPointerDown={startLongPress}
      onPointerUp={endLongPress}
      onPointerLeave={endLongPress}
      onPointerCancel={endLongPress}
    >
      {/* Top row: Emoji + Name + tap area (tap to open details; long-press anywhere on card also opens) */}
      <div className="flex items-start gap-2 cursor-pointer" onClick={handleContentClick}>
        <div
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-xl shadow-[inset_0_1px_0_oklch(1_0_0_/_0.6)]"
          aria-label={`View details for ${item.name}`}
        >
          {item.emoji}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {item.name}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="status-pill text-[10px] px-2 py-0.5"
              style={{
                backgroundColor: `color-mix(in oklab, ${status.color} 13%, var(--color-card))`,
                color: status.color,
              }}
            >
              <span
                className="size-1 rounded-full shrink-0"
                style={{ backgroundColor: status.color }}
              />
              {status.label}
            </span>
            <span className="text-[10px] font-semibold tabular-nums text-foreground/80">
              {item.daysLeft}d
            </span>
          </div>
        </div>
      </div>

      {/* Neat row: Current Qty + Min Stock side by side */}
      <div className="flex items-center justify-between px-1 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Qty</span>
          <span className="font-semibold tabular-nums text-foreground">{item.qty} {item.unit}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Min</span>
          <div className="flex items-center rounded-full bg-secondary/70 p-0.5">
            <button
              aria-label="Decrease min stock"
              onClick={(e) => { e.stopPropagation(); onUpdateMinStock?.(Math.max(0, item.minStock - 1)); }}
              className="touch-target grid size-5 place-items-center rounded-full text-foreground/70 active:bg-background/60 text-[10px]"
            >
              –
            </button>
            <span className="w-5 text-center text-[10px] font-semibold tabular-nums text-foreground/90">
              {item.minStock}
            </span>
            <button
              aria-label="Increase min stock"
              onClick={(e) => { e.stopPropagation(); onUpdateMinStock?.(item.minStock + 1); }}
              className="touch-target grid size-5 place-items-center rounded-full text-foreground/70 active:bg-background/60 text-[10px]"
            >
              +
            </button>
          </div>
          {item.qty < item.minStock && (
            <span className="text-[9px] font-medium text-[var(--color-soon)] ml-0.5">Low</span>
          )}
        </div>
      </div>

      {/* Compact quantity stepper */}
      <div className="flex items-center justify-end rounded-full bg-secondary/80 p-0.5 shadow-inner mt-0.5">
        <button
          aria-label={`Decrease ${item.name}`}
          onClick={onDec}
          className="touch-target grid size-7 place-items-center rounded-full text-foreground/70 active:scale-[0.96] active:bg-background/60 transition-all"
        >
          <Minus className="size-3" strokeWidth={3} />
        </button>
        <span className="w-6 text-center text-xs font-semibold tabular-nums text-foreground/90">
          {item.qty}
        </span>
        <button
          aria-label={`Increase ${item.name}`}
          onClick={onInc}
          className="touch-target grid size-7 place-items-center rounded-full bg-brand text-brand-foreground active:scale-[0.96] shadow-sm active:brightness-105 transition-all"
        >
          <Plus className="size-3" strokeWidth={3} />
        </button>
      </div>
    </li>
  );
}

function getStatus(daysLeft: number): ItemStatus {
  if (daysLeft <= 0) {
    return { label: "Expired", color: "var(--color-expiring)" };
  }
  if (daysLeft <= 1) {
    return { label: "Use today", color: "var(--color-expiring)" };
  }
  if (daysLeft <= 3) {
    return { label: "Expiring soon", color: "var(--color-soon)" };
  }
  if (daysLeft <= 7) {
    return { label: "Warning", color: "var(--color-soon)" };
  }
  return { label: "Fresh", color: "var(--color-fresh)" };
}

export { getStatus };