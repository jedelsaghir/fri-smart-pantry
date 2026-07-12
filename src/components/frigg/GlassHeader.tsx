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
}

export function GlassHeader({
  household,
  totalItems,
  expiringSoon,
  title = "Your Friġġ",
  subtitle = "Good morning, Elena",
  totalLabel,
  attentionLabel,
  attentionTone,
  familyMembers,
  isShared,
  onShowFamily,
  onOpenSettings,
}: Props) {
  const showAttentionDot = expiringSoon > 0;
  const resolvedLabel = attentionLabel ?? "need attention";
  const resolvedTone = attentionTone ?? (expiringSoon > 0 ? "warn" : "calm");

  return (
    <header className="sticky top-0 z-40 glass">
      <div className="px-5 pb-4 pt-[max(1.35rem,env(safe-area-inset-top))]">
        {/* Top row: household + shared indicator + avatars + notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onShowFamily}
              className="flex items-center gap-2 rounded-full bg-secondary/60 px-3.5 py-1.5 text-xs font-semibold text-foreground/85 active:bg-secondary/80 transition"
            >
              <Users className="size-3.5" />
              {household}
            </button>
            {isShared && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[color-mix(in_oklab,var(--color-fresh)_15%,var(--color-card))] text-[var(--color-fresh)] font-medium">
                Shared
              </span>
            )}
            {familyMembers && familyMembers.length > 0 && (
              <div className="flex items-center -space-x-1 ml-1" onClick={onShowFamily}>
                {familyMembers.slice(0, 3).map((m, i) => (
                  <div
                    key={i}
                    className="grid size-5 place-items-center rounded-full bg-secondary text-[10px] ring-1 ring-background"
                    title={m.name}
                  >
                    {m.emoji}
                  </div>
                ))}
                {familyMembers.length > 3 && (
                  <div className="grid size-5 place-items-center rounded-full bg-secondary/70 text-[8px] ring-1 ring-background">
                    +{familyMembers.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              aria-label="Account"
              onClick={onOpenSettings}
              className="grid size-10 place-items-center rounded-full bg-secondary/60 text-foreground/75 active:bg-secondary/80 active:scale-[0.96] transition"
            >
              <User className="size-4" />
            </button>
            <button
              aria-label="Notifications"
              className="relative grid size-10 place-items-center rounded-full bg-secondary/60 text-foreground/75 active:bg-secondary/80 active:scale-[0.96] transition"
              onClick={onShowFamily}
            >
              <Bell className="size-4" />
              {showAttentionDot && (
                <span className="absolute top-2 right-2 size-2.5 rounded-full ring-2 ring-[var(--color-card)] bg-[var(--color-expiring)]" />
              )}
            </button>
          </div>
        </div>

        {/* Hero title area — calm & premium */}
        <div className="mt-5">
          <p className="text-[13px] font-medium tracking-[0.01em] text-muted-foreground/90">
            {subtitle}
          </p>
          <h1 className="mt-0.5 font-display text-[36px] leading-[0.96] font-medium tracking-[-0.015em] text-foreground/90">
            {title}
          </h1>
        </div>

        {/* Elegant summary stats */}
        <div className="mt-4 flex gap-2 text-xs">
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
        "flex items-baseline gap-1.5 rounded-full px-4 py-1.5 " +
        (warn
          ? "bg-[color-mix(in_oklab,var(--color-expiring)_11%,var(--color-card))] text-[var(--color-expiring)] border border-[color-mix(in_oklab,var(--color-expiring)_22%,transparent)]"
          : "bg-secondary/60 text-foreground/75")
      }
    >
      <span className="font-semibold tabular-nums text-[13px]">{value}</span>
      <span className="text-[11px] font-medium tracking-[0.005em]">{label}</span>
    </div>
  );
}