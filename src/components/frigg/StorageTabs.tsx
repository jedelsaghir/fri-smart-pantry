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
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary/70 p-1">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={
              "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition " +
              (isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <span className="text-[13px] opacity-70">{t.emoji}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}