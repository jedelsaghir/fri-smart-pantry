export type StorageKey = "fridge" | "freezer" | "pantry";

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
    <div className="grid grid-cols-3 gap-1 rounded-3xl bg-secondary/50 p-1 backdrop-blur-md border border-border/30">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={
              "flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-semibold tracking-[-0.01em] transition-all active:scale-[0.985] " +
              (isActive
                ? "bg-card text-foreground shadow-[0_1px_0_0_oklch(1_0_0_/_0.6)_inset,0_2px_4px_-1px_oklch(0.2_0.02_150_/_0.1),0_8px_16px_-4px_oklch(0.2_0.02_150_/_0.08)] border border-border/20"
                : "text-muted-foreground hover:text-foreground active:bg-card/50")
            }
          >
            <span className="text-[13px] opacity-80">{t.emoji}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}