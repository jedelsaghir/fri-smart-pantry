"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  Eye,
  LogOut,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { APP_BUILD } from "@/lib/app-build";
import {
  formatJoinDate,
  forceLogoutUser,
  loadGlobalRegisteredUsers,
  removeGlobalUser,
  type GlobalRegisteredUser,
} from "@/lib/global-admin";

interface GlobalAdminPanelProps {
  onBack: () => void;
  /** Refresh parent household state after mutations */
  onRegistryChanged?: () => void;
  /** When force logout hits the current session */
  onForceSignedOut?: () => void;
}

export function GlobalAdminPanel({
  onBack,
  onRegistryChanged,
  onForceSignedOut,
}: GlobalAdminPanelProps) {
  const [tick, setTick] = useState(0);
  const [detailUser, setDetailUser] = useState<GlobalRegisteredUser | null>(null);
  const [pendingRemove, setPendingRemove] = useState<GlobalRegisteredUser | null>(null);
  const [pendingForceLogout, setPendingForceLogout] = useState<GlobalRegisteredUser | null>(null);

  const users = useMemo(() => {
    void tick;
    return loadGlobalRegisteredUsers();
  }, [tick]);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
    onRegistryChanged?.();
  }, [onRegistryChanged]);

  const activeCount = users.filter((u) => u.status === "Active").length;
  const pendingCount = users.filter((u) => u.status === "Pending").length;

  const canRemove = (u: GlobalRegisteredUser) => !u.isGlobalAdmin;
  const canForceLogout = (u: GlobalRegisteredUser) =>
    Boolean(u.accountId) && u.status === "Active";

  const confirmRemove = () => {
    if (!pendingRemove) return;
    const target = pendingRemove;
    setPendingRemove(null);
    setDetailUser(null);
    const result = removeGlobalUser(target);
    if (!result.ok) {
      toast.error("Can't remove", { description: result.reason });
      return;
    }
    toast.success("User removed", {
      description: `${target.name || target.email} was removed from the app registry.`,
    });
    refresh();
    if (result.removedSelf) {
      onForceSignedOut?.();
    }
  };

  const confirmForceLogout = () => {
    if (!pendingForceLogout) return;
    const target = pendingForceLogout;
    setPendingForceLogout(null);
    setDetailUser(null);
    const result = forceLogoutUser(target);
    if (!result.ok) {
      toast.error("Can't force logout", { description: result.reason });
      return;
    }
    if (result.signedOutNow) {
      toast.message("You were signed out", {
        description: "Force logout applied to your session.",
      });
      onForceSignedOut?.();
      return;
    }
    toast.success("Force logout simulated", {
      description: `${target.name || target.email} will need to sign in again (simulated).`,
    });
    refresh();
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
              Admin Panel
            </h1>
            <p className="truncate text-[13px] text-muted-foreground tracking-[-0.01em]">
              All registered users · App-wide
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
        <section className="elevated-card mb-5 rounded-[1.75rem] p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-xl shadow-inner ring-1 ring-border/40">
              <Users className="size-5 text-foreground/80" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Global directory
              </p>
              <p className="font-display text-[20px] font-medium leading-tight tracking-[-0.02em] text-foreground">
                {users.length} user{users.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {activeCount} active
                {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
              </p>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Visible only to the App Admin. Lists every registered account on this app instance,
            including pending household invites without a login yet.
          </p>
        </section>

        <section className="mb-5">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Registered users
            </h2>
            <span className="text-[12px] text-muted-foreground tabular-nums">{users.length}</span>
          </div>

          {users.length === 0 ? (
            <div className="elevated-card rounded-[1.75rem] px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No registered users yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {users.map((user) => {
                const joinLabel = formatJoinDate(user.joinedAt);
                return (
                  <li key={user.id} className="elevated-card rounded-[1.65rem] px-3.5 py-3.5">
                    <div className="flex items-start gap-3">
                      <div
                        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl shadow-inner ring-1 ring-border/35"
                        aria-hidden
                      >
                        {user.emoji || "👤"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                            {user.name}
                          </p>
                          {user.isCurrentUser && (
                            <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">
                              You
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                          {user.email || "No email"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span
                            className={
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                              (user.role === "App Admin"
                                ? "bg-brand/15 text-brand"
                                : user.role === "Owner"
                                  ? "bg-[color-mix(in_oklab,var(--color-fresh)_16%,transparent)] text-[var(--color-fresh)]"
                                  : "bg-secondary text-muted-foreground")
                            }
                          >
                            {user.role}
                          </span>
                          <span
                            className={
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                              (user.status === "Pending"
                                ? "bg-[color-mix(in_oklab,var(--color-soon)_14%,transparent)] text-[var(--color-soon)]"
                                : "bg-[color-mix(in_oklab,var(--color-fresh)_12%,transparent)] text-[var(--color-fresh)]")
                            }
                          >
                            {user.status}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12px] text-muted-foreground">
                          <span className="font-medium text-foreground/80">{user.household}</span>
                          {joinLabel ? ` · Joined ${joinLabel}` : user.status === "Pending" ? " · Invite pending" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailUser(user)}
                          className="touch-target flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-secondary/70 px-3 py-2.5 text-[12px] font-semibold text-foreground ring-1 ring-border/40 active:scale-[0.98] transition"
                        >
                          <Eye className="size-3.5" strokeWidth={2.25} />
                          View details
                        </button>
                        {canForceLogout(user) && (
                          <button
                            type="button"
                            onClick={() => setPendingForceLogout(user)}
                            className="touch-target flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-secondary/70 px-3 py-2.5 text-[12px] font-semibold text-foreground ring-1 ring-border/40 active:scale-[0.98] transition"
                          >
                            <LogOut className="size-3.5" strokeWidth={2.25} />
                            Force logout
                          </button>
                        )}
                      </div>
                      {canRemove(user) && (
                        <button
                          type="button"
                          onClick={() => setPendingRemove(user)}
                          className="touch-target flex w-full items-center justify-center gap-1.5 rounded-2xl border border-destructive/35 bg-destructive/5 px-3 py-2.5 text-[12px] font-semibold text-destructive active:scale-[0.98] active:bg-destructive/15 transition"
                        >
                          <Trash2 className="size-3.5" strokeWidth={2.25} />
                          Remove user
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

      {/* Details sheet */}
      {detailUser && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Close details"
            onClick={() => setDetailUser(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-[1.75rem] border border-border/40 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:m-4 sm:rounded-[1.75rem]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-3xl shadow-inner ring-1 ring-border/35"
                  aria-hidden
                >
                  {detailUser.emoji || "👤"}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-[20px] font-medium tracking-[-0.02em] truncate">
                    {detailUser.name}
                  </p>
                  <p className="text-[13px] text-muted-foreground truncate">
                    {detailUser.email || "No email"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary/80 active:scale-95"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <dl className="space-y-2.5 rounded-[1.25rem] bg-secondary/45 px-4 py-3.5 ring-1 ring-border/25">
              <DetailRow label="Email" value={detailUser.email || "—"} />
              <DetailRow label="Household" value={detailUser.household} />
              <DetailRow label="Role" value={detailUser.role} />
              <DetailRow label="Status" value={detailUser.status} />
              <DetailRow
                label="Joined"
                value={
                  formatJoinDate(detailUser.joinedAt) ||
                  (detailUser.status === "Pending" ? "Not yet" : "—")
                }
              />
              {detailUser.phone?.trim() && (
                <DetailRow label="Phone" value={detailUser.phone} />
              )}
              {detailUser.accountId && (
                <DetailRow label="Account ID" value={detailUser.accountId} mono />
              )}
            </dl>

            <div className="mt-4 flex flex-col gap-2">
              {canForceLogout(detailUser) && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailUser(null);
                    setPendingForceLogout(detailUser);
                  }}
                  className="touch-target flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
                >
                  <LogOut className="size-4" />
                  Force logout
                </button>
              )}
              {canRemove(detailUser) && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailUser(null);
                    setPendingRemove(detailUser);
                  }}
                  className="touch-target flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 py-3 text-sm font-semibold text-destructive active:bg-destructive/10 transition"
                >
                  <Trash2 className="size-4" />
                  Remove user
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailUser(null)}
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
            onClick={() => setPendingRemove(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border/40 bg-background p-5 shadow-2xl">
            <p className="font-display text-[20px] font-medium tracking-[-0.02em]">
              Remove {pendingRemove.name}?
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Deletes their registered account
              {pendingRemove.email ? ` (${pendingRemove.email})` : ""} from this app instance
              and unlinks them from the household when safe.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="touch-target flex-1 rounded-2xl border py-3 text-sm font-semibold active:bg-secondary/60"
                onClick={() => setPendingRemove(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="touch-target flex-1 rounded-2xl bg-destructive py-3 text-sm font-semibold text-destructive-foreground active:scale-[0.98]"
                onClick={confirmRemove}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force logout confirm */}
      {pendingForceLogout && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Dismiss"
            onClick={() => setPendingForceLogout(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border/40 bg-background p-5 shadow-2xl">
            <p className="font-display text-[20px] font-medium tracking-[-0.02em]">
              Force logout {pendingForceLogout.name}?
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Simulated session revoke. They will need to sign in again
              {pendingForceLogout.isCurrentUser ? " — this is your current session." : "."}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="touch-target flex-1 rounded-2xl border py-3 text-sm font-semibold active:bg-secondary/60"
                onClick={() => setPendingForceLogout(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="touch-target flex-1 rounded-2xl bg-brand py-3 text-sm font-semibold text-brand-foreground active:scale-[0.98]"
                onClick={confirmForceLogout}
              >
                Force logout
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
