"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type {
  PantryItemsByStorage,
  Recipe,
  RecipeFilter,
  StorageKey,
} from "@/types/pantry";
import { ALL_RECIPES } from "@/data/recipes";
import { deductIngredients } from "@/lib/pantry-ops";
import {
  canMakeRecipeFully,
  countRecipeAvailability,
  filterAndSortRecipes,
  missingRecipeIngredients,
} from "@/lib/recipe-helpers";
import type { ConfirmRequest } from "@/components/frigg/ConfirmDialog";

type UseRecipesOptions = {
  items: PantryItemsByStorage;
  setItems: Dispatch<SetStateAction<PantryItemsByStorage>>;
  rememberPantryItem: (
    item: {
      name: string;
      unit: string;
      emoji: string;
      minStock: number;
      daysLeft?: number;
      qty?: number;
      id?: string;
      latestPrice?: number;
    },
    source?: "pantry_add" | "pantry_delete" | "scan" | "manual" | "merge"
  ) => void;
  addActivity: (user: string, action: string) => void;
  requestConfirm: (req: ConfirmRequest) => void;
  onCooked?: () => void;
};

/**
 * Recipe filter state, derived lists, and cook/deduct flow.
 */
export function useRecipes({
  items,
  setItems,
  rememberPantryItem,
  addActivity,
  requestConfirm,
  onCooked,
}: UseRecipesOptions) {
  const [recipeFilter, setRecipeFilter] = useState<RecipeFilter>("canMake");
  const allRecipes: Recipe[] = ALL_RECIPES;

  const getMatchingCount = useCallback(
    (recipe: Recipe) => countRecipeAvailability(items, recipe),
    [items]
  );
  const canMakeRecipe = useCallback(
    (recipe: Recipe) => canMakeRecipeFully(items, recipe),
    [items]
  );

  const filteredRecipes = useMemo(
    () => filterAndSortRecipes(allRecipes, items, recipeFilter),
    [allRecipes, items, recipeFilter]
  );

  const recipeIdeasCount = filteredRecipes.length;
  const recipeReadyCount = filteredRecipes.filter(canMakeRecipe).length;

  const cookRecipe = useCallback(
    (recipe: Recipe) => {
      const missing = missingRecipeIngredients(items, recipe);
      const preview = recipe.ingredients
        .map((ing) => `${ing.qty} ${ing.unit} ${ing.name}`)
        .join(", ");
      const missNote =
        missing.length > 0
          ? ` May be short on: ${missing.map((m) => m.name).join(", ")}.`
          : "";
      requestConfirm({
        title: `Cook ${recipe.name}?`,
        description: `This will deduct from your pantry where stock allows: ${preview}.${missNote}`,
        confirmLabel: "Cook & deduct",
        onConfirm: () => {
          const snapshot = JSON.parse(JSON.stringify(items)) as typeof items;
          const { next, used } = deductIngredients(items, recipe.ingredients);
          setItems(next);
          const stillMissing = missingRecipeIngredients(next, recipe);

          if (used.length > 0) {
            used.forEach((name) => {
              const found = (["fridge", "freezer", "pantry"] as StorageKey[])
                .flatMap((s) => snapshot[s])
                .find((i) => i.name === name);
              if (found) rememberPantryItem(found, "pantry_delete");
            });
            toast.success(`Used in ${recipe.name}`, {
              description:
                `Deducted: ${used.join(", ")}` +
                (stillMissing.length
                  ? ` · Not fully covered: ${stillMissing.map((m) => m.name).join(", ")}`
                  : ""),
              action: {
                label: "Undo",
                onClick: () => setItems(snapshot),
              },
              duration: 5000,
            });
            addActivity("You", `cooked ${recipe.name}`);
            onCooked?.();
          } else {
            toast("Not enough ingredients", { description: "Some items are low." });
          }
        },
      });
    },
    [items, setItems, rememberPantryItem, addActivity, requestConfirm, onCooked]
  );

  return {
    recipeFilter,
    setRecipeFilter,
    filteredRecipes,
    recipeIdeasCount,
    recipeReadyCount,
    getMatchingCount,
    canMakeRecipe,
    cookRecipe,
  };
}
