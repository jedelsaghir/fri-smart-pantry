/**
 * Pure recipe availability + filtering (no React).
 */

import type { PantryItemsByStorage, Recipe, RecipeFilter, StorageKey } from "@/types/pantry";
import { namesMatchLoose } from "@/lib/pantry-ops";

export function countRecipeAvailability(
  items: PantryItemsByStorage,
  recipe: Recipe
): number {
  return recipe.ingredients.filter((ing) => {
    return (["fridge", "freezer", "pantry"] as StorageKey[]).some((storage) =>
      items[storage].some((n) => namesMatchLoose(n.name, ing.name) && n.qty >= ing.qty)
    );
  }).length;
}

export function canMakeRecipeFully(items: PantryItemsByStorage, recipe: Recipe): boolean {
  return countRecipeAvailability(items, recipe) === recipe.ingredients.length;
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
      r.ingredients.some((ing) => expiringNames.has(ing.name.toLowerCase()))
    );
  }

  return filtered.sort(
    (a, b) => countRecipeAvailability(items, b) - countRecipeAvailability(items, a)
  );
}
