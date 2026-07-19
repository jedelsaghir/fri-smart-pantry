import type { StorageKey } from "@/types/pantry";

export type { StorageKey };

const TABS: { key: StorageKey; label: string; emoji: string }[] = [
  { key: "fridge", label: "Fridge", emoji: "❄︎" },
  { key: "freezer", label: "Freezer", emoji: "✳︎" },
  { key: "pantry", label: "Pantry", emoji: "◇" },
];

/** Full-width glass segmented control — always one row spanning the content width */
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
      data-storage-tabs="full-width"
      className="storage-tabs-premium"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        width: "100%",
        maxWidth: "100%",
        gap: "0.3rem",
        padding: "0.4rem",
        borderRadius: "1.5rem",
        boxSizing: "border-box",
        border: "1px solid color-mix(in oklab, var(--color-border) 45%, transparent)",
        background: "color-mix(in oklab, var(--color-secondary) 68%, transparent)",
        backdropFilter: "saturate(190%) blur(22px)",
        WebkitBackdropFilter: "saturate(190%) blur(22px)",
        boxShadow:
          "inset 0 1px 0 oklch(1 0 0 / 0.45), 0 10px 28px -14px oklch(0.2 0.02 150 / 0.1)",
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
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.45rem",
              width: "100%",
              minHeight: "3.35rem",
              padding: "0.85rem 0.5rem",
              borderRadius: "1.15rem",
              border: isActive
                ? "1px solid color-mix(in oklab, var(--color-border) 40%, transparent)"
                : "1px solid transparent",
              background: isActive ? "var(--color-card)" : "transparent",
              color: isActive ? "var(--color-foreground)" : undefined,
              fontSize: "0.9rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              cursor: "pointer",
              transition: "transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
              boxShadow: isActive
                ? "0 1px 0 0 oklch(1 0 0 / 0.7) inset, 0 4px 12px -4px oklch(0.2 0.02 150 / 0.14), 0 14px 28px -12px oklch(0.2 0.02 150 / 0.1)"
                : "none",
            }}
            className={isActive ? "text-foreground" : "text-muted-foreground"}
          >
            <span style={{ fontSize: "1rem", opacity: isActive ? 0.95 : 0.6 }} aria-hidden>
              {t.emoji}
            </span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
