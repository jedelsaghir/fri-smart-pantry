import { Minus, Plus } from "lucide-react";

export interface PantryItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  emoji: string;
  daysLeft: number;
}

export function ItemCard({
  item,
  onInc,
  onDec,
}: {
  item: PantryItem;
  onInc: () => void;
  onDec: () => void;
}) {
  const status = getStatus(item.daysLeft);

  return (
    <li className="elevated-card flex items-center gap-4 rounded-3xl px-4 py-4">
      {/* Emoji / visual anchor — generous, softly elevated */}
      <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-[26px] shadow-[inset_0_1px_0_oklch(1_0_0_/_0.6)]">
        {item.emoji}
      </div>

      {/* Content block with refined hierarchy */}
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {item.name}
        </p>

        <div className="mt-2 flex items-center gap-2.5">
          {/* Elegant status pill */}
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

          {/* Quantity + unit — quiet but clear */}
          <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
            {item.qty} {item.unit}
          </span>
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

function getStatus(daysLeft: number) {
  if (daysLeft <= 1)
    return { label: daysLeft <= 0 ? "Expired" : "Use today", color: "var(--color-expiring)" };
  if (daysLeft <= 3) return { label: `${daysLeft} days left`, color: "var(--color-soon)" };
  return { label: `Fresh · ${daysLeft}d`, color: "var(--color-fresh)" };
}