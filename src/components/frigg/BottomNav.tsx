import { Home, ShoppingBag, ChefHat, Wallet } from "lucide-react";

const ITEMS = [
  { key: "pantry", label: "Pantry", icon: Home },
  { key: "list", label: "List", icon: ShoppingBag },
  { key: "recipes", label: "Recipes", icon: ChefHat },
  { key: "money", label: "Finances", icon: Wallet },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto max-w-md px-4">
        <div className="glass rounded-[22px] border border-border/40 px-1.5 py-1.5 shadow-[0_10px_40px_-12px_oklch(0.2_0.02_150_/_0.22)]">
          <ul className="flex items-center justify-around">
            {ITEMS.map((it) => {
              const Icon = it.icon;
              const isActive = it.key === active;
              return (
                <li key={it.key}>
                  <button
                    onClick={() => onChange(it.key)}
                    className={
                      "flex flex-col items-center gap-px rounded-2xl px-5 py-[7px] text-[10px] font-semibold tracking-[0.01em] transition active:scale-[0.96] " +
                      (isActive
                        ? "text-brand"
                        : "text-muted-foreground hover:text-foreground active:bg-white/40 dark:active:bg-white/5")
                    }
                  >
                    <Icon className="size-[21px]" strokeWidth={isActive ? 2.6 : 1.9} />
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