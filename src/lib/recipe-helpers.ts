/**
 * Pure recipe availability + filtering (no React).
 */

import type { PantryItemsByStorage, Recipe, RecipeFilter, StorageKey } from "@/types/pantry";
import { namesMatchLoose } from "@/lib/pantry-ops";
import { coreItemName, namesLookSimilar, normalizeItemName } from "@/lib/catalog";
import { EXPIRING_SOON_DAYS } from "@/lib/item-status";
import { simplifyProductName } from "@/lib/product-name";
import { unitsCompatible } from "@/lib/units";

/**
 * Loose match so recipe ingredients hit simplified pantry OCR names.
 * e.g. pantry "Pesto" matches ingredient "pesto"; "Whole milk" matches "milk".
 */
export function ingredientMatchesPantry(pantryName: string, ingredientName: string): boolean {
  const p = (pantryName || "").trim();
  const i = (ingredientName || "").trim();
  if (!p || !i) return false;

  if (namesMatchLoose(p, i)) return true;
  if (namesLookSimilar(p, i)) return true;

  const pCore = coreItemName(p) || normalizeItemName(p);
  const iCore = coreItemName(i) || normalizeItemName(i);
  if (pCore && iCore && (pCore === iCore || pCore.includes(iCore) || iCore.includes(pCore))) {
    return true;
  }

  const pSimp = simplifyProductName(p).toLowerCase();
  const iSimp = simplifyProductName(i).toLowerCase();
  if (pSimp && iSimp && (pSimp === iSimp || pSimp.includes(iSimp) || iSimp.includes(pSimp))) {
    return true;
  }

  const a = pSimp.split(/\s+/).filter((t) => t.length > 2);
  const b = iSimp.split(/\s+/).filter((t) => t.length > 2);
  if (!a.length || !b.length) return false;
  // Shared token length ≥ 3 (eggs, oil, rice) or ≥ 4 for safety
  return a.some((t) =>
    b.some((u) => u === t || (t.length >= 3 && u.length >= 3 && (u.includes(t) || t.includes(u))))
  );
}

/** Optional unit-aware stock check (convertible mass/volume still counts). */
export function pantryHasIngredientQty(
  items: PantryItemsByStorage,
  ing: { name: string; qty: number; unit?: string }
): boolean {
  let have = 0;
  for (const storage of ["fridge", "freezer", "pantry"] as StorageKey[]) {
    for (const n of items[storage]) {
      if (!ingredientMatchesPantry(n.name, ing.name)) continue;
      if (ing.unit && n.unit && !unitsCompatible(n.unit, ing.unit, n.qty, ing.qty)) {
        // still allow name-only coverage for loose recipe units (tbsp, bag…)
        have += n.qty;
        continue;
      }
      have += n.qty;
    }
  }
  return have >= Math.min(ing.qty, 0.01);
}

export function countRecipeAvailability(
  items: PantryItemsByStorage,
  recipe: Recipe
): number {
  return recipe.ingredients.filter((ing) => pantryHasIngredientQty(items, ing)).length;
}

export function canMakeRecipeFully(items: PantryItemsByStorage, recipe: Recipe): boolean {
  return countRecipeAvailability(items, recipe) === recipe.ingredients.length;
}

/** Ingredients not fully covered by pantry stock (M-09) */
export function missingRecipeIngredients(
  items: PantryItemsByStorage,
  recipe: Recipe
): Array<{ name: string; qty: number; unit: string }> {
  return recipe.ingredients.filter((ing) => {
    let have = 0;
    for (const storage of ["fridge", "freezer", "pantry"] as StorageKey[]) {
      for (const n of items[storage]) {
        if (ingredientMatchesPantry(n.name, ing.name)) have += n.qty;
      }
    }
    return have < ing.qty;
  });
}

export function filterAndSortRecipes(
  recipes: Recipe[],
  items: PantryItemsByStorage,
  recipeFilter: RecipeFilter
): Recipe[] {
  let filtered = [...recipes];

  if (recipeFilter === "canMake") {
    filtered = filtered.filter((r) => canMakeRecipeFully(items, r));
  } else if (recipeFilter === "expiring") {
    // L-24: same urgency window as ItemCard / Alerts (EXPIRING_SOON_DAYS)
    const expiringNames = new Set(
      (["fridge", "freezer", "pantry"] as StorageKey[]).flatMap((s) =>
        items[s]
          .filter((i) => typeof i.daysLeft === "number" && i.daysLeft <= EXPIRING_SOON_DAYS)
          .map((i) => i.name.toLowerCase())
      )
    );
    filtered = filtered.filter((r) =>
      r.ingredients.some((ing) =>
        [...expiringNames].some((en) => ingredientMatchesPantry(en, ing.name))
      )
    );
  }

  return filtered.sort(
    (a, b) => countRecipeAvailability(items, b) - countRecipeAvailability(items, a)
  );
}
