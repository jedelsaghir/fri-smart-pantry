"use client";

import { useMemo, useState } from "react";
import { GitMerge, Pencil, Plus, Trash2 } from "lucide-react";
import type { CatalogItem, CatalogMergeGroup } from "@/types/pantry";
import { Input } from "@/components/ui/input";
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

export function ItemDatabaseSection({
  catalog,
  mergeGroups,
  onAdd,
  onUpdate,
  onRemove,
  onMerge,
  onRequestDelete,
}: {
  catalog: CatalogItem[];
  mergeGroups: CatalogMergeGroup[];
  onAdd: (input: { name: string; unit: string; emoji: string }) => void;
  onUpdate: (id: string, patch: Partial<CatalogItem>) => void;
  onRemove: (id: string) => void;
  onMerge: (group: CatalogMergeGroup, primaryId: string) => void;
  onRequestDelete: (item: CatalogItem) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [emoji, setEmoji] = useState("🛒");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", unit: "", emoji: "" });
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeIndex, setMergeIndex] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);

  const activeGroups = useMemo(
    () => mergeGroups.filter((g) => !skipped.has(g.id)),
    [mergeGroups, skipped]
  );

  const currentGroup = activeGroups[mergeIndex] ?? null;
  const groupMembers = currentGroup
    ? catalog.filter((c) => currentGroup.memberIds.includes(c.id))
    : [];
  const primaryId = selectedPrimaryId ?? currentGroup?.primaryId ?? null;

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditDraft({ name: item.name, unit: item.unit, emoji: item.emoji });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const n = editDraft.name.trim();
    if (!n) return;
    onUpdate(editingId, {
      name: n,
      unit: editDraft.unit.trim() || "pcs",
      emoji: editDraft.emoji.trim() || "🛒",
    });
    setEditingId(null);
  };

  const submitAdd = () => {
    const n = name.trim();
    if (!n) return;
    onAdd({ name: n, unit: unit.trim() || "pcs", emoji: emoji.trim() || "🛒" });
    setName("");
    setUnit("pcs");
    setEmoji("🛒");
    setShowAdd(false);
  };

  const openMerge = () => {
    setSkipped(new Set());
    setMergeIndex(0);
    setSelectedPrimaryId(null);
    setMergeOpen(true);
  };

  return (
    <section className="mt-10 border-t border-border/50 pt-6">
      <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
            Database
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Known items from pantry adds &amp; deletes · {catalog.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openMerge}
            disabled={mergeGroups.length === 0}
            className="inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-[12px] font-semibold active:bg-secondary/60 disabled:opacity-40 transition"
            title="Find and merge duplicate names"
          >
            <GitMerge className="size-3.5" />
            Merge
            {mergeGroups.length > 0 && (
              <span className="rounded-full bg-secondary px-1.5 text-[10px] tabular-nums">
                {mergeGroups.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 rounded-2xl bg-brand px-3 py-2 text-[12px] font-semibold text-brand-foreground active:scale-[0.985] transition"
          >
            <Plus className="size-3.5" />
            Add
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="elevated-card mb-3 space-y-2.5 rounded-3xl p-4">
          <div className="flex gap-2">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="h-11 w-14 rounded-2xl text-center text-lg"
              aria-label="Emoji"
              maxLength={4}
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name"
              className="h-11 flex-1 rounded-2xl"
              aria-label="Name"
            />
          </div>
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit (L, pcs, g…)"
            className="h-11 rounded-2xl"
            aria-label="Unit"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold active:bg-secondary/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitAdd}
              className="flex-1 rounded-2xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground active:scale-[0.985]"
            >
              Save item
            </button>
          </div>
        </div>
      )}

      {catalog.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          Database is empty. Add items here, or add/delete pantry items to learn names.
        </div>
      ) : (
        <ul className="space-y-2">
          {catalog.map((item) => (
            <li
              key={item.id}
              className="elevated-card flex items-center gap-3 rounded-[1.35rem] px-3 py-2.5"
            >
              {editingId === item.id ? (
                <div className="flex w-full flex-col gap-2">
                  <div className="flex gap-2">
                    <Input
                      value={editDraft.emoji}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, emoji: e.target.value }))
                      }
                      className="h-10 w-12 rounded-xl text-center"
                    />
                    <Input
                      value={editDraft.name}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, name: e.target.value }))
                      }
                      className="h-10 flex-1 rounded-xl"
                    />
                    <Input
                      value={editDraft.unit}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, unit: e.target.value }))
                      }
                      className="h-10 w-16 rounded-xl"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex-1 rounded-xl border py-2 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="flex-1 rounded-xl bg-brand py-2 text-xs font-semibold text-brand-foreground"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-xl">
                    {item.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.unit}
                      {item.source ? ` · ${item.source.replace("_", " ")}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="grid size-9 place-items-center rounded-xl border border-border/50 active:bg-secondary/60"
                    aria-label={`Edit ${item.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(item)}
                    className="grid size-9 place-items-center rounded-xl border border-border/50 text-destructive/80 active:bg-destructive/10"
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Merge wizard */}
      <AlertDialog
        open={mergeOpen}
        onOpenChange={(open) => {
          if (!open) setMergeOpen(false);
        }}
      >
        <AlertDialogContent className="max-w-[min(22rem,calc(100vw-2rem))] rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[20px] tracking-[-0.02em]">
              {currentGroup
                ? `Possible duplicates (${mergeIndex + 1}/${Math.max(activeGroups.length, 1)})`
                : "No duplicates found"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-[14px] text-muted-foreground">
                {currentGroup && groupMembers.length > 0 ? (
                  <>
                    <p>These names look similar. Merge into one, or keep separate.</p>
                    <ul className="space-y-2">
                      {groupMembers.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedPrimaryId(m.id)}
                            className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-foreground transition ${
                              m.id === primaryId
                                ? "bg-brand/15 ring-1 ring-brand/30"
                                : "bg-secondary/60 active:bg-secondary"
                            }`}
                          >
                            <span className="text-lg">{m.emoji}</span>
                            <span className="min-w-0 flex-1 font-medium">{m.name}</span>
                            <span className="text-[11px] text-muted-foreground">{m.unit}</span>
                            {m.id === primaryId && (
                              <span className="text-[10px] font-semibold text-brand">Keep</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[12px]">
                      Tap a name to keep it. Merge removes the others from the database.
                    </p>
                  </>
                ) : (
                  <p>Scan finished — no similar name groups right now.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            {currentGroup ? (
              <>
                <AlertDialogAction
                  className="w-full rounded-2xl bg-brand text-brand-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!primaryId) return;
                    onMerge(currentGroup, primaryId);
                    setSelectedPrimaryId(null);
                    setTimeout(() => setMergeIndex(0), 0);
                  }}
                >
                  Merge as one
                </AlertDialogAction>
                <button
                  type="button"
                  className="w-full rounded-2xl border py-2.5 text-sm font-semibold active:bg-secondary/60"
                  onClick={() => {
                    setSkipped((prev) => new Set(prev).add(currentGroup.id));
                    setSelectedPrimaryId(null);
                    setMergeIndex(0);
                  }}
                >
                  Keep separate
                </button>
                <AlertDialogCancel className="w-full rounded-2xl">Close</AlertDialogCancel>
              </>
            ) : (
              <AlertDialogCancel className="w-full rounded-2xl">Done</AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
