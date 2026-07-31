import { test, expect } from "@playwright/test";

/**
 * Critical-path smoke: app loads → demo sign-in (auto-create) → pantry shell.
 * Camera / live OCR not required (no XAI_API_KEY in CI).
 */
test("app loads and reaches pantry after demo sign-in", async ({ page }) => {
  await page.goto("/");

  // Splash → login. Dismiss onboarding welcome if shown.
  await page.getByRole("button", { name: /maybe later/i }).click({ timeout: 20_000 }).catch(() => {});

  const emailInput = page.getByPlaceholder("you@family.com");
  await expect(emailInput).toBeVisible({ timeout: 25_000 });

  // Stay on Sign In tab — demo mode auto-creates on first use
  const unique = `e2e-${Date.now()}@example.com`;
  await emailInput.fill(unique);
  await page.locator('input[type="password"]').fill("testpass");

  // Submit form (not the tab toggle "Sign In")
  await page.locator('button[type="submit"]').click();

  // finishWithCloudSync may reload
  await page.waitForLoadState("domcontentloaded").catch(() => {});

  // Bottom nav uses aria-label on each item
  await expect(page.getByRole("button", { name: "Pantry", exact: true })).toBeVisible({
    timeout: 40_000,
  });
});
