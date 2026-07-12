import { Bell, Users } from "lucide-react";

interface Props {
  household: string;
  totalItems: number;
  expiringSoon: number;
}

export function GlassHeader({ household, totalItems, expiringSoon }: Props) {
  return (
    <header className="sticky top-0 z-30 glass">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 rounded-full bg-secondary/70 px-3 py-1.5 text-xs font-medium text-foreground/80">
            <Users className="size-3.5" />
            {household}
          </button>
          <button
            aria-label="Notifications"
            className="relative grid size-9 place-items-center rounded-full bg-secondary/70 text-foreground/70"
          >
            <Bell className="size-4" />
            {expiringSoon > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--color-expiring)]" />
            )}
          </button>
        </div>

        <div className="mt-4">
          <p className="text-sm text-muted-foreground">Good morning, Elena</p>
          <h1 className="mt-1 font-display text-[34px] leading-tight font-medium text-foreground">
            Your Friġġ
          </h1>
        </div>

        <div className="mt-4 flex gap-2 text-xs">
          <Stat label="items" value={totalItems} />
          <Stat
            label="need attention"
            value={expiringSoon}
            tone={expiringSoon > 0 ? "warn" : "calm"}
          />
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone = "calm",
}: {
  label: string;
  value: number;
  tone?: "calm" | "warn";
}) {
  return (
    <div
      className={
        "flex items-baseline gap-1.5 rounded-full px-3 py-1.5 " +
        (tone === "warn"
          ? "bg-[color-mix(in_oklab,var(--color-expiring)_14%,transparent)] text-[var(--color-expiring)]"
          : "bg-secondary/80 text-foreground/70")
      }
    >
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-[11px]">{label}</span>
    </div>
  );
}