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
    <div className="grid grid-cols-3 gap-1 rounded-3xl bg-secondary/65 p-1 backdrop-blur-sm">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={
              "flex items-center justify-center gap-1.5 rounded-[14px] py-2.5 text-sm font-semibold transition-all active:scale-[0.985] " +
              (isActive
                ? "bg-card text-foreground shadow-[0_1px_2px_oklch(0.2_0.02_150_/_0.06),0_4px_10px_-2px_oklch(0.2_0.02_150_/_0.08)]"
                : "text-muted-foreground hover:text-foreground active:bg-card/60")
            }
          >
            <span className="text-[13px] opacity-75">{t.emoji}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}