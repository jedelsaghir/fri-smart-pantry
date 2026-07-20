"use client";

import type { PantryItemsByStorage, Recipe, RecipeFilter, StorageKey } from "@/types/pantry";
import { namesMatchLoose } from "@/lib/pantry-ops";

export function RecipesView({
  items,
  recipeFilter,
  onFilterChange,
  filteredRecipes,
  countAvailable,
  canMakeFully,
  onCook,
}: {
  items: PantryItemsByStorage;
  recipeFilter: RecipeFilter;
  onFilterChange: (f: RecipeFilter) => void;
  filteredRecipes: Recipe[];
  countAvailable: (recipe: Recipe) => number;
  canMakeFully: (recipe: Recipe) => boolean;
  onCook: (recipe: Recipe) => void;
}) {
  void items;

  return (
    <div className="space-y-5">
      {/* Equal-width filter pills — always fully visible, no horizontal scroll */}
      <div
        role="tablist"
        aria-label="Recipe filters"
        className="grid w-full grid-cols-3 gap-1 rounded-[1.15rem] bg-secondary/55 p-1 ring-1 ring-border/30"
      >
        {(
          [
            { key: "all", label: "All ideas" },
            { key: "canMake", label: "Can make now" },
            { key: "expiring", label: "Use expiring" },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={recipeFilter === f.key}
            onClick={() => onFilterChange(f.key)}
            className={
              "min-w-0 touch-manipulation rounded-[0.9rem] px-1.5 py-2.5 text-center text-[11px] font-semibold leading-snug tracking-[-0.01em] transition active:scale-[0.98] sm:text-xs " +
              (recipeFilter === f.key
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-foreground/80 active:bg-secondary/80")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredRecipes.length === 0 ? (
        <div className="mt-12 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-secondary/70 text-3xl">
            🍳
          </div>
          <p className="mt-4 font-display text-xl text-foreground">No matches yet</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-[240px] mx-auto">
            Add more items to your pantry or switch filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecipes.map((recipe) => {
            const t = countAvailable(recipe);
            const n = recipe.ingredients.length;
            const r = canMakeFully(recipe);
            return (
              <div key={recipe.id} className="elevated-card rounded-3xl px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
                    {recipe.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[15px] tracking-[-0.01em]">{recipe.name}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {recipe.time} · {recipe.servings} serv
                      </span>
                    </div>
                    <div className="mt-2 text-[12px] text-muted-foreground">
                      {recipe.ingredients.map((ing, idx) => (
                        <span key={idx} className="mr-2">
                          {ing.qty}
                          {ing.unit} {ing.name}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          r
                            ? "bg-[color-mix(in_oklab,var(--color-fresh)_15%,var(--color-card))] text-[var(--color-fresh)]"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {r ? "Ready to cook" : `${t}/${n} ingredients`}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{recipe.category}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onCook(recipe)}
                  className="mt-3 w-full rounded-3xl border py-2.5 text-sm font-semibold active:bg-secondary/60 transition disabled:opacity-50"
                  disabled={t === 0}
                >
                  {r ? "Cook this recipe" : "Use what I have"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground pt-2">
        Recipes update automatically from your current pantry stock.
      </p>
    </div>
  );
}

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
