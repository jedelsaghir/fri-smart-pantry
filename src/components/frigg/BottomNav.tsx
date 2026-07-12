import { Home, ShoppingBag, ChefHat, Wallet } from "lucide-react";

const ITEMS = [
  { key: "pantry", label: "Pantry", icon: Home, active: true },
  { key: "list", label: "List", icon: ShoppingBag },
  { key: "recipes", label: "Recipes", icon: ChefHat },
  { key: "money", label: "Finances", icon: Wallet },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto max-w-md px-4">
        <div className="glass rounded-full border border-border/60 px-2 py-1.5 shadow-[0_10px_40px_-10px_oklch(0.2_0.02_150_/_0.18)]">
          <ul className="flex items-center justify-around">
            {ITEMS.map((it) => {
              const Icon = it.icon;
              return (
                <li key={it.key}>
                  <button
                    className={
                      "flex flex-col items-center gap-0.5 rounded-full px-4 py-2 text-[10px] font-medium transition " +
                      (it.active
                        ? "text-brand"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    <Icon className="size-5" strokeWidth={it.active ? 2.4 : 1.8} />
                    {it.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}