import type { StorageKey } from "@/types/pantry";

export type { StorageKey };

const TABS: { key: StorageKey; label: string; emoji: string }[] = [
  { key: "fridge", label: "Fridge", emoji: "❄︎" },
  { key: "freezer", label: "Freezer", emoji: "✳︎" },
  { key: "pantry", label: "Pantry", emoji: "◇" },
];

export function StorageTabs({
  active,
  onChange,
}: {
  active: StorageKey;
  onChange: (k: StorageKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Storage location"
      className="grid w-full grid-cols-3 gap-1 rounded-[1.35rem] bg-secondary/55 p-1.5 backdrop-blur-md border border-border/35 shadow-[inset_0_1px_0_oklch(1_0_0_/_0.35)]"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={
              "flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-[1.05rem] px-2 py-3 text-[14px] font-semibold tracking-[-0.015em] transition-all active:scale-[0.985] " +
              (isActive
                ? "bg-card text-foreground shadow-[0_1px_0_0_oklch(1_0_0_/_0.65)_inset,0_2px_6px_-1px_oklch(0.2_0.02_150_/_0.12),0_10px_20px_-8px_oklch(0.2_0.02_150_/_0.1)] border border-border/25"
                : "text-muted-foreground hover:text-foreground/85 active:bg-card/40 border border-transparent")
            }
          >
            <span className={"text-[15px] leading-none " + (isActive ? "opacity-90" : "opacity-65")}>
              {t.emoji}
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
