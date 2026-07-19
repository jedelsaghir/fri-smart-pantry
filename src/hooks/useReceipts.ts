"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StoredReceipt } from "@/types/pantry";
import { loadReceipts, saveReceipts } from "@/lib/receipts";

export function useReceipts() {
  const [receipts, setReceipts] = useState<StoredReceipt[]>(() => loadReceipts());

  useEffect(() => {
    saveReceipts(receipts);
  }, [receipts]);

  const addReceipt = useCallback((receipt: StoredReceipt) => {
    setReceipts((prev) => [receipt, ...prev]);
  }, []);

  const removeReceipt = useCallback((id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getReceipt = useCallback(
    (id: string) => receipts.find((r) => r.id === id) ?? null,
    [receipts]
  );

  const totalSpent = useMemo(
    () => Math.round(receipts.reduce((s, r) => s + r.total, 0) * 100) / 100,
    [receipts]
  );

  const sorted = useMemo(
    () =>
      [...receipts].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [receipts]
  );

  return {
    receipts: sorted,
    totalSpent,
    addReceipt,
    removeReceipt,
    getReceipt,
    setReceipts,
  };
}

export type UseReceiptsReturn = ReturnType<typeof useReceipts>;
