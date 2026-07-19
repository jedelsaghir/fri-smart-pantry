import type { StorageKey } from "@/types/pantry";

export type { StorageKey };

const TABS: { key: StorageKey; label: string; emoji: string }[] = [
  { key: "fridge", label: "Fridge", emoji: "❄︎" },
  { key: "freezer", label: "Freezer", emoji: "✳︎" },
  { key: "pantry", label: "Pantry", emoji: "◇" },
];

/**
 * Full-width premium segmented control for storage location.
 * Always spans the entire row — never multi-column item layout.
 */
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
      className="storage-tabs-premium grid w-full max-w-full grid-cols-3 gap-1 rounded-[1.5rem] border border-border/40 p-1.5 shadow-[inset_0_1px_0_oklch(1_0_0_/_0.45),0_8px_24px_-12px_oklch(0.2_0.02_150_/_0.08)]"
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        background:
          "color-mix(in oklab, var(--color-secondary) 72%, transparent)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
      }}
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
              "flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-[1.15rem] px-2 py-3.5 text-[14px] font-semibold tracking-[-0.02em] transition-all duration-200 active:scale-[0.985] " +
              (isActive
                ? "bg-card text-foreground border border-border/30 shadow-[0_1px_0_0_oklch(1_0_0_/_0.7)_inset,0_2px_8px_-2px_oklch(0.2_0.02_150_/_0.14),0_12px_28px_-10px_oklch(0.2_0.02_150_/_0.12)]"
                : "border border-transparent text-muted-foreground hover:text-foreground/90 active:bg-card/35")
            }
          >
            <span
              className={
                "text-[16px] leading-none " + (isActive ? "opacity-95" : "opacity-60")
              }
            >
              {t.emoji}
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
