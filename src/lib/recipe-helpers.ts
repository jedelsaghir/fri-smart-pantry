/**
 * Pure recipe availability + filtering (no React).
 */

import type { PantryItemsByStorage, Recipe, RecipeFilter, StorageKey } from "@/types/pantry";
import { namesMatchLoose } from "@/lib/pantry-ops";
import { namesLookSimilar } from "@/lib/catalog";

/** M-08: loose match — exact loose name, core similarity, or shared significant token */
export function ingredientMatchesPantry(pantryName: string, ingredientName: string): boolean {
  if (namesMatchLoose(pantryName, ingredientName)) return true;
  if (namesLookSimilar(pantryName, ingredientName)) return true;
  const a = pantryName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2);
  const b = ingredientName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (!a.length || !b.length) return false;
  // Shared token of length ≥ 4 (milk, eggs, spinach, chicken…)
  return a.some((t) => t.length >= 4 && b.some((u) => u === t || u.includes(t) || t.includes(u)));
}

export function countRecipeAvailability(
  items: PantryItemsByStorage,
  recipe: Recipe
): number {
  return recipe.ingredients.filter((ing) => {
    return (["fridge", "freezer", "pantry"] as StorageKey[]).some((storage) =>
      items[storage].some(
        (n) => ingredientMatchesPantry(n.name, ing.name) && n.qty >= Math.min(ing.qty, 0.01)
      )
    );
  }).length;
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
    const expiringNames = new Set(
      (["fridge", "freezer", "pantry"] as StorageKey[]).flatMap((s) =>
        items[s].filter((i) => i.daysLeft <= 3).map((i) => i.name.toLowerCase())
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
