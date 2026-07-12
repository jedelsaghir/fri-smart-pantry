import { Minus, Plus } from "lucide-react";

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

  // Tap the main content (emoji + info) to open details drawer for expiration / move actions
  const handleContentClick = (e: React.MouseEvent) => {
    // Prevent opening details when tapping the qty stepper or min controls
    if ((e.target as HTMLElement).closest("button")) return;
    onOpenDetails?.();
  };

  return (
    <li className="elevated-card flex items-center gap-4 rounded-3xl px-4 py-4">
      {/* Emoji / visual anchor — tap opens details */}
      <div
        onClick={handleContentClick}
        className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-[26px] shadow-[inset_0_1px_0_oklch(1_0_0_/_0.6)] cursor-pointer active:scale-[0.96] transition"
        aria-label={`View details for ${item.name}`}
      >
        {item.emoji}
      </div>

      {/* Content block with refined hierarchy — tap to open details */}
      <div
        className="min-w-0 flex-1 py-0.5 cursor-pointer"
        onClick={handleContentClick}
      >
        <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {item.name}
        </p>

        <div className="mt-2 flex items-center gap-2.5">
          {/* Elegant status pill with improved labels */}
          <span
            className="status-pill"
            style={{
              backgroundColor: `color-mix(in oklab, ${status.color} 13%, var(--color-card))`,
              color: status.color,
            }}
          >
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: status.color }}
            />
            {status.label}
          </span>

          {/* Clear "days left" display */}
          <span className="text-[12px] font-semibold tabular-nums text-foreground/80">
            {item.daysLeft}d
          </span>

          {/* Quantity + unit — quiet but clear */}
          <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
            {item.qty} {item.unit}
          </span>
        </div>

        {/* Minimum stock level — editable, premium inline controls */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Min stock</span>
          <div className="flex items-center rounded-full bg-secondary/70 p-0.5">
            <button
              aria-label="Decrease min stock"
              onClick={() => onUpdateMinStock?.(Math.max(0, item.minStock - 1))}
              className="touch-target grid size-7 place-items-center rounded-full text-foreground/70 active:bg-background/60 transition text-sm"
            >
              –
            </button>
            <span className="w-6 text-center text-xs font-semibold tabular-nums text-foreground/90">
              {item.minStock}
            </span>
            <button
              aria-label="Increase min stock"
              onClick={() => onUpdateMinStock?.(item.minStock + 1)}
              className="touch-target grid size-7 place-items-center rounded-full text-foreground/70 active:bg-background/60 transition text-sm"
            >
              +
            </button>
          </div>
          {item.qty < item.minStock && (
            <span className="text-[10px] font-medium text-[var(--color-soon)]">Low</span>
          )}
        </div>
      </div>

      {/* Premium grouped quantity stepper — large thumb targets, clear separation */}
      <div className="flex items-center rounded-full bg-secondary/80 p-0.5 shadow-inner">
        <button
          aria-label={`Decrease ${item.name}`}
          onClick={onDec}
          className="touch-target grid size-11 place-items-center rounded-full text-foreground/70 active:scale-[0.96] active:bg-background/60 transition-all active:duration-75"
        >
          <Minus className="size-[17px]" strokeWidth={2.5} />
        </button>

        <span className="w-8 text-center text-[15px] font-semibold tabular-nums text-foreground/90">
          {item.qty}
        </span>

        <button
          aria-label={`Increase ${item.name}`}
          onClick={onInc}
          className="touch-target grid size-11 place-items-center rounded-full bg-brand text-brand-foreground active:scale-[0.96] shadow-sm active:brightness-105 transition-all active:duration-75"
        >
          <Plus className="size-[17px]" strokeWidth={2.5} />
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