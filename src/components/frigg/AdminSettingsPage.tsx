"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  Mail,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { FamilyMember } from "@/types/pantry";
import {
  buildInviteUrl,
  formatPhoneDisplay,
  memberStatusLabel,
} from "@/lib/family";
import { APP_BUILD } from "@/lib/app-build";
import { ensureMemberInviteCode, publishMemberInvite } from "@/lib/member-invite";
import { loadSyncCreds } from "@/lib/sync-session";
import { flushHouseholdPush } from "@/lib/run-household-sync";

/** Role shown in admin list (Owner vs Member) */
function accountRole(member: FamilyMember): "Owner" | "Member" {
  return member.status === "owner" ? "Owner" : "Member";
}

/** Lifecycle status for admin list (Active vs Pending) */
function accountStatus(member: FamilyMember): "Active" | "Pending" {
  return member.status === "pending" ? "Pending" : "Active";
}

function formatJoinDate(iso?: string): string | null {
  if (!iso?.trim()) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

interface AdminSettingsPageProps {
  householdName: string;
  members: FamilyMember[];
  onBack: () => void;
  onRemoveMember: (id: string) => void;
  onUpdateMember?: (id: string, patch: Partial<FamilyMember>) => void;
}

export function AdminSettingsPage({
  householdName,
  members,
  onBack,
  onRemoveMember,
  onUpdateMember,
}: AdminSettingsPageProps) {
  const [detailMember, setDetailMember] = useState<FamilyMember | null>(null);
  const [pendingRemove, setPendingRemove] = useState<FamilyMember | null>(null);
  const pendingRemoveRef = useRef<FamilyMember | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sortedMembers = useMemo(() => {
    const rank = (m: FamilyMember) => {
      if (m.status === "owner") return 0;
      if (m.status === "joined") return 1;
      return 2;
    };
    return [...members].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [members]);

  const activeCount = members.filter((m) => m.status !== "pending").length;
  const pendingCount = members.filter((m) => m.status === "pending").length;

  const canRemoveMember = (member: FamilyMember) => {
    if (member.isYou) return false;
    if (member.status === "owner") return false;
    return true;
  };

  const canResendInvite = (member: FamilyMember) => member.status !== "owner";

  const requestRemove = (member: FamilyMember) => {
    if (!canRemoveMember(member)) {
      toast.error("Can't remove", {
        description: "You can't remove the account owner.",
      });
      return;
    }
    pendingRemoveRef.current = member;
    setPendingRemove(member);
    setDetailMember(null);
  };

  const cancelRemove = () => {
    pendingRemoveRef.current = null;
    setPendingRemove(null);
  };

  const confirmRemove = () => {
    const target = pendingRemoveRef.current ?? pendingRemove;
    if (!target) {
      cancelRemove();
      return;
    }
    if (!canRemoveMember(target)) {
      toast.error("Can't remove", {
        description: "You can't remove the account owner.",
      });
      cancelRemove();
      return;
    }
    onRemoveMember(target.id);
    const wasPending = target.status === "pending";
    cancelRemove();
    toast.success(wasPending ? "Invite cancelled" : "Member removed", {
      description: wasPending
        ? `${target.name}'s pending invite was deleted.`
        : `${target.name} was removed from the household.`,
    });
  };

  const ensureInviteCode = (member: FamilyMember): FamilyMember => {
    const withCode = ensureMemberInviteCode(member);
    if (withCode.inviteCode !== member.inviteCode) {
      onUpdateMember?.(member.id, {
        inviteCode: withCode.inviteCode,
        status: member.status === "owner" ? "owner" : member.status || "pending",
      });
    }
    return withCode;
  };

  const prepareMemberInvite = async (member: FamilyMember): Promise<FamilyMember | null> => {
    const withCode = ensureInviteCode(member);
    await flushHouseholdPush();
    const creds = loadSyncCreds();
    if (creds) {
      const pub = await publishMemberInvite({
        member: withCode,
        householdName,
        ownerCreds: creds,
      });
      if (!pub.ok) {
        toast.message("Invite ready on this device", {
          description:
            pub.reason ||
            "Cloud publish failed — they can still use the link after you Sync now.",
        });
      }
    }
    return withCode;
  };

  const copyText = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  };

  const resendInvite = async (member: FamilyMember) => {
    if (!canResendInvite(member)) return;
    setResendingId(member.id);
    try {
      const withCode = (await prepareMemberInvite(member)) || ensureInviteCode(member);
      const url = buildInviteUrl(withCode.inviteCode);
      const ok = await copyText(url);
      if (ok) {
        setCopiedId(withCode.id);
        toast.success(
          member.status === "pending" ? `Invite resent for ${withCode.name}` : `Invite link for ${withCode.name}`,
          {
            description:
              "Link copied — send it via WhatsApp, Messages, or email. Unique to this profile.",
          }
        );
        setTimeout(() => setCopiedId(null), 2200);
      } else {
        toast.error("Couldn't copy automatically", {
          description: "Open View details to copy the invite link manually.",
        });
        setDetailMember(withCode);
      }
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background">
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
              Admin Settings
            </h1>
            <p className="truncate text-[13px] text-muted-foreground tracking-[-0.01em]">
              Registered accounts · {householdName}
            </p>
          </div>
          <div
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary/70 text-foreground/80 ring-1 ring-border/40"
            aria-hidden
          >
            <Shield className="size-5" strokeWidth={2.25} />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
        {/* Summary */}
        <section className="elevated-card mb-5 rounded-[1.75rem] p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-xl shadow-inner ring-1 ring-border/40">
              <Users className="size-5 text-foreground/80" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Household accounts
              </p>
              <p className="font-display text-[20px] font-medium leading-tight tracking-[-0.02em] text-foreground">
                {members.length} registered
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {activeCount} active
                {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
              </p>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Owner-only view of every account linked to this household. Pending invites are waiting
            to create an account; active members already joined.
          </p>
        </section>

        {/* Account list */}
        <section className="mb-5">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              All accounts
            </h2>
            <span className="text-[12px] text-muted-foreground tabular-nums">{sortedMembers.length}</span>
          </div>

          {sortedMembers.length === 0 ? (
            <div className="elevated-card rounded-[1.75rem] px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No accounts yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sortedMembers.map((member) => {
                const role = accountRole(member);
                const status = accountStatus(member);
                const joinLabel = formatJoinDate(member.joinedAt);
                const isPending = member.status === "pending";

                return (
                  <li key={member.id} className="elevated-card rounded-[1.65rem] px-3.5 py-3.5">
                    <div className="flex items-start gap-3">
                      <div
                        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl shadow-inner ring-1 ring-border/35"
                        aria-hidden
                      >
                        {member.emoji || "👤"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                            {member.name}
                          </p>
                          {member.isYou && (
                            <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">
                              You
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span
                            className={
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                              (role === "Owner"
                                ? "bg-[color-mix(in_oklab,var(--color-fresh)_16%,transparent)] text-[var(--color-fresh)]"
                                : "bg-secondary text-muted-foreground")
                            }
                          >
                            {role}
                          </span>
                          <span
                            className={
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                              (status === "Pending"
                                ? "bg-[color-mix(in_oklab,var(--color-soon)_14%,transparent)] text-[var(--color-soon)]"
                                : "bg-[color-mix(in_oklab,var(--color-fresh)_12%,transparent)] text-[var(--color-fresh)]")
                            }
                          >
                            {status}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12px] text-muted-foreground">
                          {joinLabel
                            ? `Joined ${joinLabel}`
                            : isPending
                              ? "Invite not accepted yet"
                              : member.email || memberStatusLabel(member.status)}
                        </p>
                      </div>
                    </div>

                    {/* Actions — large touch targets */}
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailMember(member)}
                          className="touch-target flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-secondary/70 px-3 py-2.5 text-[12px] font-semibold text-foreground ring-1 ring-border/40 active:scale-[0.98] transition"
                        >
                          <Eye className="size-3.5" strokeWidth={2.25} />
                          View details
                        </button>
                        {canResendInvite(member) && (
                          <button
                            type="button"
                            disabled={resendingId === member.id}
                            onClick={() => void resendInvite(member)}
                            className="touch-target flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand/12 px-3 py-2.5 text-[12px] font-semibold text-brand ring-1 ring-brand/25 active:scale-[0.98] transition disabled:opacity-60"
                          >
                            {copiedId === member.id ? (
                              <Check className="size-3.5" strokeWidth={2.25} />
                            ) : (
                              <Mail className="size-3.5" strokeWidth={2.25} />
                            )}
                            {resendingId === member.id
                              ? "Sending…"
                              : copiedId === member.id
                                ? "Copied"
                                : isPending
                                  ? "Resend invite"
                                  : "Invite link"}
                          </button>
                        )}
                      </div>
                      {canRemoveMember(member) && (
                        <button
                          type="button"
                          onClick={() => requestRemove(member)}
                          className="touch-target flex w-full items-center justify-center gap-1.5 rounded-2xl border border-destructive/35 bg-destructive/5 px-3 py-2.5 text-[12px] font-semibold text-destructive active:scale-[0.98] active:bg-destructive/15 transition"
                        >
                          <Trash2 className="size-3.5" strokeWidth={2.25} />
                          {isPending ? "Cancel invite" : "Remove member"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Member details sheet */}
      {detailMember && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Close details"
            onClick={() => setDetailMember(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-[1.75rem] border border-border/40 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:m-4 sm:rounded-[1.75rem]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-3xl shadow-inner ring-1 ring-border/35"
                  aria-hidden
                >
                  {detailMember.emoji || "👤"}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-[20px] font-medium tracking-[-0.02em] truncate">
                    {detailMember.name}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {accountRole(detailMember)} · {accountStatus(detailMember)}
                    {detailMember.isYou ? " · You" : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailMember(null)}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary/80 active:scale-95"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <dl className="space-y-2.5 rounded-[1.25rem] bg-secondary/45 px-4 py-3.5 ring-1 ring-border/25">
              <DetailRow label="Email" value={detailMember.email || "—"} />
              <DetailRow
                label="Phone"
                value={
                  detailMember.phone?.trim()
                    ? formatPhoneDisplay(detailMember.phone)
                    : "—"
                }
              />
              <DetailRow label="Role" value={accountRole(detailMember)} />
              <DetailRow label="Status" value={accountStatus(detailMember)} />
              <DetailRow
                label="Joined"
                value={formatJoinDate(detailMember.joinedAt) || (detailMember.status === "pending" ? "Not yet" : "—")}
              />
              {detailMember.status !== "owner" && detailMember.inviteCode && (
                <DetailRow label="Invite code" value={detailMember.inviteCode} mono />
              )}
            </dl>

            <div className="mt-4 flex flex-col gap-2">
              {canResendInvite(detailMember) && (
                <button
                  type="button"
                  disabled={resendingId === detailMember.id}
                  onClick={() => void resendInvite(detailMember)}
                  className="touch-target flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition disabled:opacity-60"
                >
                  {copiedId === detailMember.id ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copiedId === detailMember.id
                    ? "Invite link copied"
                    : detailMember.status === "pending"
                      ? "Resend invite"
                      : "Copy invite link"}
                </button>
              )}
              {canRemoveMember(detailMember) && (
                <button
                  type="button"
                  onClick={() => requestRemove(detailMember)}
                  className="touch-target flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 py-3 text-sm font-semibold text-destructive active:bg-destructive/10 transition"
                >
                  <Trash2 className="size-4" />
                  {detailMember.status === "pending" ? "Cancel invite" : "Remove member"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailMember(null)}
                className="touch-target w-full rounded-2xl border py-3 text-sm font-semibold active:bg-secondary/60 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirm */}
      {pendingRemove && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Dismiss"
            onClick={cancelRemove}
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border/40 bg-background p-5 shadow-2xl">
            <p className="font-display text-[20px] font-medium tracking-[-0.02em]">
              {pendingRemove.status === "pending"
                ? `Cancel invite for ${pendingRemove.name}?`
                : `Remove ${pendingRemove.name}?`}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              {pendingRemove.status === "pending"
                ? "Their pending invite will be deleted. You can create a new invite later."
                : "They will lose access to this shared pantry. You can invite them again later."}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="touch-target flex-1 rounded-2xl border py-3 text-sm font-semibold active:bg-secondary/60"
                onClick={cancelRemove}
              >
                Cancel
              </button>
              <button
                type="button"
                className="touch-target flex-1 rounded-2xl bg-destructive py-3 text-sm font-semibold text-destructive-foreground active:scale-[0.98]"
                onClick={confirmRemove}
              >
                {pendingRemove.status === "pending" ? "Cancel invite" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="pointer-events-none fixed bottom-2 right-3 z-0 text-[9px] text-muted-foreground/40">
        build {APP_BUILD}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[12px] text-muted-foreground">{label}</dt>
      <dd
        className={
          "min-w-0 text-right text-[13px] font-medium text-foreground break-all " +
          (mono ? "font-mono text-[12px]" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
