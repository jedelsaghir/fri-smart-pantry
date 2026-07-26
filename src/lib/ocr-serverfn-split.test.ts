/**
 * H-10: Smoke assert that OCR createServerFn module stays a thin wrapper.
 * Production `?tss-serverfn-split` strips sibling helpers — helpers must live in
 * ocr-receipt.server.ts and be imported, not defined in the functions file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src/lib");

describe("OCR server-fn split (H-10)", () => {
  it("functions file only imports helpers from ocr-receipt.server", () => {
    const src = readFileSync(join(root, "ocr-receipt.functions.ts"), "utf8");
    expect(src).toMatch(/from ["']@\/lib\/ocr-receipt\.server["']/);
    expect(src).toMatch(/createServerFn/);
    // Must not re-declare heavy helpers in the functions module
    expect(src).not.toMatch(/function getApiKey\s*\(/);
    expect(src).not.toMatch(/function probeXaiHealth\s*\(/);
    expect(src).not.toMatch(/function runOcrReceiptFromImage\s*\(/);
    expect(src).not.toMatch(/const MAX_IMAGE_CHARS/);
  });

  it("server module exports run helpers used by wrappers", () => {
    const src = readFileSync(join(root, "ocr-receipt.server.ts"), "utf8");
    expect(src).toMatch(/export async function runOcrReceiptFromImage/);
    expect(src).toMatch(/export async function resolveOcrServerStatus/);
    expect(src).toMatch(/export function getApiKey/);
  });
});

describe("household-sync server-fn split (paired with C-06)", () => {
  it("functions file stays thin", () => {
    const src = readFileSync(join(root, "household-sync.functions.ts"), "utf8");
    expect(src).toMatch(/from ["']@\/lib\/household-sync\.server["']/);
    expect(src).not.toMatch(/function fanOutHousehold\s*\(/);
    expect(src).not.toMatch(/function kvGetJson\s*\(/);
    expect(src).not.toMatch(/async function getHouseholdRecord/);
  });
});
