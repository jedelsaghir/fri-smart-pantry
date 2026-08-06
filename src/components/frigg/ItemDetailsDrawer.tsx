"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Package, Snowflake, Thermometer } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getStatus } from "./ItemCard";
import { defaultPriceUnit, getFreezerExtensionDays } from "@/hooks/usePantry";
import { moneySymbol } from "@/lib/money";
import {
  canToggleUnit,
  priceAfterUnitToggle,
  toggleMassUnit,
  toggleVolumeUnit,
} from "@/lib/units";
import { hapticLight } from "@/lib/haptics";
import type { DetailsItemState, PantryItem, StorageKey } from "@/types/pantry";

/** N-09: display currency for price fields (EUR default until multi-currency prefs) */
const PRICE_CURRENCY = "EUR";

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Calendar date for a daysLeft offset (local noon). Supports negative days. */
function expirationDateFromDaysLeft(daysLeft: number): Date {
  const d = startOfTodayLocal();
  d.setDate(d.getDate() + Math.floor(daysLeft));
  return d;
}

function toDateInputValue(daysLeft: number | null | undefined): string {
  if (daysLeft == null || !Number.isFinite(daysLeft)) return "";
  const d = expirationDateFromDaysLeft(daysLeft);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function minDateInputValue(): string {
  const d = startOfTodayLocal();
  d.setFullYear(d.getFullYear() - 2);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysLeftFromDateInput(iso: string): number {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [y, m, day] = parts;
  const target = new Date(y, m - 1, day, 12, 0, 0, 0);
  const today = startOfTodayLocal();
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

const UNIT_OPTIONS = ["pcs", "g", "ml"] as const;

function isDecimalUnit(unit: string): boolean {
  const u = unit.trim().toLowerCase();
  return u === "g" || u === "ml" || u === "kg" || u === "l";
}

function formatExpiresLabel(daysLeft: number | null | undefined): string {
  if (daysLeft == null || !Number.isFinite(daysLeft)) return "No expiry";
  const formatted = expirationDateFromDaysLeft(daysLeft).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (daysLeft <= 0) return `Expired ${formatted}`;
  return `Expires ${formatted}`;
}

function formatPrice(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "";
  return value.toFixed(2);
}

function parseNonNegNumber(raw: string, fallback: number, allowDecimal = false): number {
  const cleaned = raw.replace(",", ".").trim();
  if (cleaned === "" || cleaned === ".") return fallback;
  const n = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return allowDecimal ? Math.round(n * 100) / 100 : Math.floor(n);
}

// NOTE: truncated mid-file intentionally for size - WILL FAIL VERIFY
export function ItemDetailsDrawer() { return null; }
