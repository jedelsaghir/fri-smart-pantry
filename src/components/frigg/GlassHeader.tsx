import { Bell, Users, User } from "lucide-react";

interface Props {
  household: string;
  totalItems: number;
  expiringSoon: number;
  title?: string;
  subtitle?: string;
  totalLabel?: string;
  attentionLabel?: string;
  attentionTone?: "calm" | "warn";
  // Family sharing
  familyMembers?: Array<{ name: string; emoji: string }>;
  isShared?: boolean;
  onShowFamily?: () => void;
  onOpenSettings?: () => void;
  /** Alerts / attention items (expiry, low stock) — not the family drawer */
  onShowAlerts?: () => void;
  alertsCount?: number;
}

export function GlassHeader({
  household,
  totalItems,
  expiringSoon,
  title = "Your Friġġ",
  subtitle = "Welcome",
  totalLabel,
  attentionLabel,
  attentionTone,
  familyMembers,
  isShared,
  onShowFamily,
  onOpenSettings,
  onShowAlerts,
  alertsCount,
}: Props) {
  const alertTotal = alertsCount ?? expiringSoon;
  const showAttentionDot = alertTotal > 0;
  const resolvedLabel = attentionLabel ?? "need attention";
  const resolvedTone = attentionTone ?? (expiringSoon > 0 ? "warn" : "calm");

  return (
    <header className="sticky top-0 z-40 glass">
      <div className="relative px-5 pb-4 pt-[max(1.35rem,env(safe-area-inset-top))]">
        {/* Soft header atmosphere — premium depth without clutter */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-80"
          style={{
            background:
              "radial-gradient(90% 120% at 12% -20%, color-mix(in oklab, var(--color-brand) 10%, transparent), transparent 62%), radial-gradient(70% 100% at 92% 0%, color-mix(in oklab, var(--color-fresh) 8%, transparent), transparent 55%)",
          }}
          aria-hidden
        />

        {/* Top row: household + shared indicator + avatars + alerts */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onShowFamily}
              className="flex max-w-[11.5rem] items-center gap-2 truncate rounded-full border border-border/40 bg-secondary/55 px-3.5 py-1.5 text-xs font-semibold text-foreground/85 shadow-[0_1px_0_0_oklch(1_0_0/0.45)_inset] backdrop-blur-sm active:bg-secondary/80 transition"
            >
              <Users className="size-3.5 shrink-0 opacity-80" />
              <span className="truncate">{household}</span>
            </button>
            {isShared && (
              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-[color-mix(in_oklab,var(--color-fresh)_14%,var(--color-card))] text-[var(--color-fresh)] font-semibold tracking-[0.01em]">
                Shared
              </span>
            )}
            {familyMembers && familyMembers.length > 0 && (
              <button
                type="button"
                className="flex shrink-0 items-center -space-x-1.5 ml-0.5 rounded-full"
                onClick={onShowFamily}
                aria-label="Open household"
              >
                {familyMembers.slice(0, 3).map((m, i) => (
                  <div
                    key={i}
                    className="grid size-6 place-items-center rounded-full bg-secondary text-[11px] ring-2 ring-background shadow-sm"
                    title={m.name}
                  >
                    {m.emoji}
                  </div>
                ))}
                {familyMembers.length > 3 && (
                  <div className="grid size-6 place-items-center rounded-full bg-secondary/80 text-[9px] font-semibold ring-2 ring-background">
                    +{familyMembers.length - 3}
                  </div>
                )}
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label="Account settings"
              onClick={onOpenSettings}
              className="grid size-10 place-items-center rounded-full border border-border/35 bg-secondary/55 text-foreground/75 shadow-[0_1px_0_0_oklch(1_0_0/0.4)_inset] active:bg-secondary/80 active:scale-[0.96] transition"
            >
              <User className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Alerts"
              className="relative grid size-10 place-items-center rounded-full border border-border/35 bg-secondary/55 text-foreground/75 shadow-[0_1px_0_0_oklch(1_0_0/0.4)_inset] active:bg-secondary/80 active:scale-[0.96] transition"
              onClick={onShowAlerts}
            >
              <Bell className="size-4" />
              {showAttentionDot && (
                <span className="absolute top-2 right-2 size-2.5 rounded-full ring-2 ring-[var(--color-card)] bg-[var(--color-expiring)]" />
              )}
            </button>
          </div>
        </div>

        {/* Hero title area — calm & premium */}
        <div className="relative mt-6">
          <p className="text-[13px] font-medium tracking-[0.02em] text-muted-foreground/95">
            {subtitle}
          </p>
          <h1 className="mt-1 font-display text-[2.35rem] leading-[0.94] font-medium tracking-[-0.025em] text-foreground/92">
            {title}
          </h1>
        </div>

        {/* Elegant summary stats */}
        <div className="relative mt-5 flex flex-wrap gap-2 text-xs">
          <Stat label={totalLabel ?? "items"} value={totalItems} />
          <Stat label={resolvedLabel} value={expiringSoon} tone={resolvedTone} />
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
  const warn = tone === "warn";

  return (
    <div
      className={
        "flex items-baseline gap-1.5 rounded-full px-4 py-1.5 backdrop-blur-sm " +
        (warn
          ? "bg-[color-mix(in_oklab,var(--color-expiring)_11%,var(--color-card))] text-[var(--color-expiring)] border border-[color-mix(in_oklab,var(--color-expiring)_22%,transparent)] shadow-[0_1px_0_0_oklch(1_0_0/0.25)_inset]"
          : "bg-secondary/65 text-foreground/78 border border-border/35 shadow-[0_1px_0_0_oklch(1_0_0/0.45)_inset]")
      }
    >
      <span className="font-semibold tabular-nums text-[13px] tracking-[-0.01em]">{value}</span>
      <span className="text-[11px] font-medium tracking-[0.01em] opacity-90">{label}</span>
    </div>
  );
}
