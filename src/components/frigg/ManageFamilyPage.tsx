"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Package, Users, Activity } from "lucide-react";
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
}

export function ManageFamilyPage({
  householdName,
  members,
  activityLog,
  sharedItemCount,
  onBack,
  onAddMember,
  onRemoveMember,
}: ManageFamilyPageProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState(DEFAULT_EMOJI);
  const [pendingRemove, setPendingRemove] = useState<FamilyMember | null>(null);

  const recentActivity = activityLog.slice(0, 5);

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
    onAddMember({ name: trimmed, emoji: newEmoji || DEFAULT_EMOJI });
    toast.success("Member added", { description: `${trimmed} joined ${householdName}.` });
    setNewName("");
    setNewEmoji(DEFAULT_EMOJI);
    setShowAddForm(false);
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    if (pendingRemove.isYou) {
      toast.error("Can't remove yourself", { description: "You are the account owner." });
      setPendingRemove(null);
      return;
    }
    onRemoveMember(pendingRemove.id);
    toast.success("Member removed", { description: `${pendingRemove.name} left the household.` });
    setPendingRemove(null);
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background">
      {/* Sticky glass header — native settings feel */}
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
              <p className="text-[13px] text-muted-foreground">Shared household pantry</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
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

          <ul className="space-y-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="elevated-card flex items-center gap-3 rounded-3xl px-3.5 py-3"
              >
                <div
                  className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl shadow-inner ring-1 ring-border/35"
                  aria-hidden
                >
                  {member.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    {member.name}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {member.isYou ? "You · Account owner" : "Household member"}
                  </p>
                </div>
                {member.isYou ? (
                  <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--color-fresh)_16%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-fresh)]">
                    You
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Remove ${member.name}`}
                    onClick={() => setPendingRemove(member)}
                    className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border/50 text-destructive/80 active:scale-[0.96] active:bg-destructive/10 transition"
                  >
                    <Trash2 className="size-4" strokeWidth={2.25} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* Add member */}
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-border/70 bg-secondary/30 px-4 py-3.5 text-sm font-semibold text-foreground active:bg-secondary/55 transition"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              Add family member
            </button>
          ) : (
            <div className="elevated-card mt-2.5 space-y-4 rounded-[1.75rem] p-4">
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                  placeholder="e.g. Sam"
                  autoFocus
                  className="h-12 rounded-2xl border-border/50 bg-secondary/40 px-4 text-[15px] shadow-none focus-visible:ring-[var(--color-fresh)]/40"
                />
              </div>

              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewName("");
                    setNewEmoji(DEFAULT_EMOJI);
                  }}
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
                  Add
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
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            Showing the last {Math.min(5, recentActivity.length) || 5} household actions.
          </p>
        </section>
      </div>

      {/* Remove confirmation */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent className="max-w-[min(22rem,calc(100vw-2rem))] rounded-3xl border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[22px] tracking-[-0.02em]">
              Remove {pendingRemove?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] leading-relaxed">
              They will lose access to this shared pantry. You can always add them again later.
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
