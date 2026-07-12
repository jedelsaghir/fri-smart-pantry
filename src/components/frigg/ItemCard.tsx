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
    <li className="elevated-card flex items-center gap-4 rounded-2xl p-3.5">
      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
        {item.emoji}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-foreground">{item.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: `color-mix(in oklab, ${status.color} 14%, transparent)`,
              color: status.color,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            {status.label}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {item.qty} {item.unit}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          aria-label="Decrease"
          onClick={onDec}
          className="grid size-9 place-items-center rounded-full bg-secondary text-foreground/70 active:scale-95 transition"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums">
          {item.qty}
        </span>
        <button
          aria-label="Increase"
          onClick={onInc}
          className="grid size-9 place-items-center rounded-full bg-brand text-brand-foreground active:scale-95 transition"
        >
          <Plus className="size-4" />
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