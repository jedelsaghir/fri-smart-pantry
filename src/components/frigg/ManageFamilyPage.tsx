"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  Users,
  Activity,
  MessageCircle,
  QrCode,
  Copy,
  Check,
  X,
  Link2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import type { FamilyMember, ActivityLogEntry } from "@/types/pantry";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  buildInviteUrl,
  buildWhatsAppInviteLink,
  buildQrImageUrl,
  formatPhoneDisplay,
  generateInviteCode,
  memberStatusLabel,
} from "@/lib/family";

const AVATAR_EMOJIS = [
  "👤",
  "👩",
  "👨",
  "👩‍🍳",
  "👨‍🍳",
  "🧒",
  "👧",
  "👦",
  "👵",
  "👴",
  "🧑",
  "👱",
  "🧔",
  "👩‍💼",
  "👨‍💼",
  "🧑‍🎓",
  "🐱",
  "🐶",
  "🦊",
  "🐻",
  "🐼",
  "🦁",
  "🐸",
  "🦄",
];

const DEFAULT_EMOJI = "👤";

interface ManageFamilyPageProps {
  householdName: string;
  members: FamilyMember[];
  activityLog: ActivityLogEntry[];
  sharedItemCount: number;
  onBack: () => void;
  onAddMember: (member: Omit<FamilyMember, "id" | "isYou">) => void;
  onRemoveMember: (id: string) => void;
  onUpdateMember?: (id: string, patch: Partial<FamilyMember>) => void;
  /** Demo: open invite acceptance as this member (logout + invite flow) */
  onSimulateAcceptInvite?: (member: FamilyMember) => void;
}

export function ManageFamilyPage({
  householdName,
  members,
  activityLog,
  sharedItemCount,
  onBack,
  onAddMember,
  onRemoveMember,
  onUpdateMember,
  onSimulateAcceptInvite,
}: ManageFamilyPageProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmoji, setNewEmoji] = useState(DEFAULT_EMOJI);
  const [pendingRemove, setPendingRemove] = useState<FamilyMember | null>(null);
  const [inviteSheetMember, setInviteSheetMember] = useState<FamilyMember | null>(null);
  const [inviteSheetMode, setInviteSheetMode] = useState<"share" | "qr">("share");
  const [copied, setCopied] = useState(false);

  const recentActivity = activityLog.slice(0, 5);
  const pendingCount = members.filter((m) => m.status === "pending").length;
  const activeCount = members.filter((m) => m.status === "joined" || m.status === "owner").length;

  const inviteUrl = useMemo(
    () => (inviteSheetMember ? buildInviteUrl(inviteSheetMember.inviteCode) : ""),
    [inviteSheetMember]
  );

  const qrUrl = useMemo(
    () => (inviteUrl ? buildQrImageUrl(inviteUrl, 220) : ""),
    [inviteUrl]
  );

  const resetAddForm = () => {
    setNewName("");
    setNewPhone("");
    setNewEmoji(DEFAULT_EMOJI);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Name required", { description: "Enter a name for the new member." });
      return;
    }
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Already a member", { description: `${trimmed} is already in this household.` });
      return;
    }
    onAddMember({
      name: trimmed,
      emoji: newEmoji || DEFAULT_EMOJI,
      phone: newPhone.trim(),
      inviteCode: generateInviteCode(),
      status: "pending",
    });
    toast.success("Invite ready", {
      description: `Add ${trimmed}, then share WhatsApp or QR so they can create an account.`,
    });
    resetAddForm();
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    if (pendingRemove.isYou || pendingRemove.status === "owner") {
      toast.error("Can't remove yourself", { description: "You are the account owner." });
      setPendingRemove(null);
      return;
    }
    onRemoveMember(pendingRemove.id);
    toast.success("Member removed", { description: `${pendingRemove.name} left the household.` });
    setPendingRemove(null);
  };

  const openInviteSheet = (member: FamilyMember, mode: "share" | "qr" = "share") => {
    if (!member.inviteCode) {
      const code = generateInviteCode();
      onUpdateMember?.(member.id, { inviteCode: code, status: member.status === "owner" ? "owner" : member.status });
      setInviteSheetMember({ ...member, inviteCode: code });
    } else {
      setInviteSheetMember(member);
    }
    setInviteSheetMode(mode);
    setCopied(false);
  };

  const handleWhatsApp = (member: FamilyMember) => {
    // Ensure member has an invite code before sharing
    let code = member.inviteCode;
    if (!code) {
      code = generateInviteCode();
      onUpdateMember?.(member.id, { inviteCode: code });
    }
    const link = buildWhatsAppInviteLink({
      phone: member.phone,
      householdName,
      inviteCode: code,
      inviteeName: member.name,
    });
    window.open(link, "_blank", "noopener,noreferrer");
    toast.success("Opening WhatsApp", {
      description: member.phone?.trim()
        ? `Invite for ${member.name} is ready to send.`
        : "Pick a contact in WhatsApp — the invite message is pre-filled.",
    });
  };

  const copyInviteLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Link copied", { description: "Paste it anywhere to invite them." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy", { description: "Long-press the link to copy." });
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background">
      {/* Sticky glass header */}
      <header className="sticky top-0 z-10 glass shrink-0">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 pb-3.5 pt-[max(0.85rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary/70 text-foreground active:scale-[0.96] active:bg-secondary transition"
          >
            <ArrowLeft className="size-5" strokeWidth={2.25} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[22px] font-medium leading-tight tracking-[-0.02em] text-foreground">
              Manage Family
            </h1>
            <p className="truncate text-[13px] text-muted-foreground tracking-[-0.01em]">
              {householdName}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
        {/* Summary hero */}
        <section className="elevated-card mb-5 rounded-[1.75rem] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-2xl shadow-inner ring-1 ring-border/40">
              🏠
            </div>
            <div className="min-w-0">
              <p className="font-display text-[20px] font-medium leading-tight tracking-[-0.02em] text-foreground">
                {householdName}
              </p>
              <p className="text-[13px] text-muted-foreground">
                Multi-user shared pantry · {activeCount} active
                {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="rounded-2xl bg-secondary/55 px-3.5 py-3 ring-1 ring-border/25">
              <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">Members</span>
              </div>
              <p className="font-display text-[26px] font-medium leading-none tracking-[-0.02em] text-foreground">
                {members.length}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/55 px-3.5 py-3 ring-1 ring-border/25">
              <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                <Package className="size-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">Shared items</span>
              </div>
              <p className="font-display text-[26px] font-medium leading-none tracking-[-0.02em] text-foreground">
                {sharedItemCount}
              </p>
            </div>
          </div>
        </section>

        {/* Members list */}
        <section className="mb-5">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Family members
            </h2>
            <span className="text-[12px] text-muted-foreground">{members.length}</span>
          </div>

          <ul className="space-y-3">
            {members.map((member) => {
              const canInvite = member.status !== "owner";
              const isPending = member.status === "pending";
              return (
                <li key={member.id} className="elevated-card rounded-[1.65rem] px-3.5 py-3.5">
                  <div className="flex items-start gap-3">
                    <div
                      className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl shadow-inner ring-1 ring-border/35"
                      aria-hidden
                    >
                      {member.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                          {member.name}
                        </p>
                        <span
                          className={
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                            (member.status === "owner"
                              ? "bg-[color-mix(in_oklab,var(--color-fresh)_16%,transparent)] text-[var(--color-fresh)]"
                              : isPending
                                ? "bg-[color-mix(in_oklab,var(--color-soon)_14%,transparent)] text-[var(--color-soon)]"
                                : "bg-secondary text-muted-foreground")
                          }
                        >
                          {member.isYou ? "You" : memberStatusLabel(member.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {member.phone
                          ? formatPhoneDisplay(member.phone)
                          : member.status === "owner"
                            ? "Account owner"
                            : isPending
                              ? "Waiting to create account"
                              : member.email || "Household member"}
                      </p>
                    </div>
                    {!member.isYou && member.status !== "owner" && (
                      <button
                        type="button"
                        aria-label={`Remove ${member.name}`}
                        onClick={() => setPendingRemove(member)}
                        className="grid size-10 shrink-0 place-items-center rounded-2xl border border-border/50 text-destructive/80 active:scale-[0.96] active:bg-destructive/10 transition"
                      >
                        <Trash2 className="size-4" strokeWidth={2.25} />
                      </button>
                    )}
                  </div>

                  {canInvite && (
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleWhatsApp(member)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#25D366]/15 px-3 py-2.5 text-[12px] font-semibold text-[#128C7E] dark:text-[#25D366] ring-1 ring-[#25D366]/25 active:scale-[0.98] transition"
                      >
                        <MessageCircle className="size-3.5" strokeWidth={2.25} />
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => openInviteSheet(member, "qr")}
                        className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-secondary/70 px-3 py-2.5 text-[12px] font-semibold text-foreground ring-1 ring-border/40 active:scale-[0.98] transition"
                      >
                        <QrCode className="size-3.5" strokeWidth={2.25} />
                        QR code
                      </button>
                    </div>
                  )}

                  {canInvite && isPending && onSimulateAcceptInvite && (
                    <button
                      type="button"
                      onClick={() => onSimulateAcceptInvite(member)}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/70 py-2 text-[11px] font-semibold text-muted-foreground active:bg-secondary/50 transition"
                    >
                      <UserPlus className="size-3.5" />
                      Simulate accept invite (demo)
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Add member */}
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-border/70 bg-secondary/30 px-4 py-3.5 text-sm font-semibold text-foreground active:bg-secondary/55 transition"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              Invite family member
            </button>
          ) : (
            <div className="elevated-card mt-3 space-y-4 rounded-[1.75rem] p-4">
              <div>
                <p className="mb-2 text-[13px] font-semibold text-foreground">Avatar</p>
                <div className="grid grid-cols-8 gap-1.5">
                  {AVATAR_EMOJIS.map((emoji) => {
                    const selected = newEmoji === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewEmoji(emoji)}
                        aria-label={`Choose ${emoji}`}
                        aria-pressed={selected}
                        className={
                          "grid size-10 place-items-center rounded-xl text-xl transition active:scale-[0.94] " +
                          (selected
                            ? "bg-brand text-brand-foreground shadow-sm ring-2 ring-brand/40"
                            : "bg-secondary/70 ring-1 ring-border/30 hover:bg-secondary")
                        }
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="member-name" className="mb-1.5 block text-[13px] font-semibold text-foreground">
                  Name
                </label>
                <Input
                  id="member-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sam"
                  autoFocus
                  className="h-12 rounded-2xl border-border/50 bg-secondary/40 px-4 text-[15px] shadow-none focus-visible:ring-[var(--color-fresh)]/40"
                />
              </div>

              <div>
                <label htmlFor="member-phone" className="mb-1.5 block text-[13px] font-semibold text-foreground">
                  Phone <span className="font-normal text-muted-foreground">(for WhatsApp)</span>
                </label>
                <Input
                  id="member-phone"
                  type="tel"
                  inputMode="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 555 0100"
                  className="h-12 rounded-2xl border-border/50 bg-secondary/40 px-4 text-[15px] shadow-none focus-visible:ring-[var(--color-fresh)]/40"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Include country code for best WhatsApp delivery.
                </p>
              </div>

              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={resetAddForm}
                  className="flex-1 rounded-2xl border border-border/60 py-3 text-sm font-semibold active:bg-secondary/60 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand py-3 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
                >
                  <Plus className="size-4" strokeWidth={2.5} />
                  Create invite
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Activity summary */}
        <section className="mb-4">
          <div className="mb-2.5 flex items-center gap-2 px-1">
            <Activity className="size-3.5 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Recent activity
            </h2>
          </div>

          <div className="elevated-card overflow-hidden rounded-[1.75rem]">
            {recentActivity.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No activity yet. Changes will show up here.
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {recentActivity.map((entry, i) => (
                  <li key={`${entry.user}-${entry.time}-${i}`} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-semibold text-foreground/80">
                      {entry.user.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-snug tracking-[-0.01em] text-foreground">
                        <span className="font-semibold">{entry.user}</span>{" "}
                        <span className="text-foreground/80">{entry.action}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Invite share / QR sheet */}
      {inviteSheetMember && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Close invite sheet"
            onClick={() => setInviteSheetMember(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-[1.75rem] border border-border/40 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[1.75rem] sm:m-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[20px] font-medium tracking-[-0.02em]">
                  Invite {inviteSheetMember.name}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  They create an account and join the shared pantry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteSheetMember(null)}
                className="grid size-9 place-items-center rounded-full bg-secondary/80 active:scale-95"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mb-4 flex gap-1 rounded-2xl bg-secondary/60 p-1">
              <button
                type="button"
                onClick={() => setInviteSheetMode("share")}
                className={
                  "flex-1 rounded-xl py-2 text-[13px] font-semibold transition " +
                  (inviteSheetMode === "share" ? "bg-card shadow-sm" : "text-muted-foreground")
                }
              >
                Share link
              </button>
              <button
                type="button"
                onClick={() => setInviteSheetMode("qr")}
                className={
                  "flex-1 rounded-xl py-2 text-[13px] font-semibold transition " +
                  (inviteSheetMode === "qr" ? "bg-card shadow-sm" : "text-muted-foreground")
                }
              >
                QR code
              </button>
            </div>

            {inviteSheetMode === "qr" ? (
              <div className="flex flex-col items-center py-2">
                <div className="rounded-3xl bg-white p-4 shadow-inner ring-1 ring-border/30">
                  {qrUrl ? (
                    <img
                      src={qrUrl}
                      alt={`QR invite for ${inviteSheetMember.name}`}
                      width={220}
                      height={220}
                      className="size-[200px] rounded-xl"
                    />
                  ) : (
                    <div className="grid size-[200px] place-items-center text-sm text-muted-foreground">
                      QR unavailable
                    </div>
                  )}
                </div>
                <p className="mt-3 max-w-[260px] text-center text-[12px] text-muted-foreground">
                  Scan with a phone camera to open the Friġġ invite and create an account.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl bg-secondary/50 px-3.5 py-3 ring-1 ring-border/30">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    <Link2 className="size-3" />
                    Invite link
                  </div>
                  <p className="break-all text-[13px] font-medium leading-snug text-foreground/90">
                    {inviteUrl}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 py-3 text-sm font-semibold active:bg-secondary/60 transition"
                >
                  {copied ? <Check className="size-4 text-[var(--color-fresh)]" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy invite link"}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                handleWhatsApp(inviteSheetMember);
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-sm font-semibold text-white active:scale-[0.985] transition"
            >
              <MessageCircle className="size-4" />
              Invite via WhatsApp
            </button>

            {onSimulateAcceptInvite && inviteSheetMember.status === "pending" && (
              <button
                type="button"
                onClick={() => {
                  const m = inviteSheetMember;
                  setInviteSheetMember(null);
                  onSimulateAcceptInvite(m);
                }}
                className="mt-2 w-full py-2 text-center text-[12px] font-semibold text-muted-foreground underline underline-offset-2"
              >
                Simulate opening invite as {inviteSheetMember.name}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent className="max-w-[min(22rem,calc(100vw-2rem))] rounded-3xl border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px] tracking-[-0.02em]">
              Remove {pendingRemove?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] leading-relaxed">
              Their invite and account access to this shared pantry will be revoked. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
