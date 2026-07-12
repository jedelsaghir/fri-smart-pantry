import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

interface CategoryData {
  name: string;
  amount: number;
}

interface StoreData {
  store: string;
  amount: number;
}

interface TrendData {
  week: string;
  milk: number;
  average: number;
}

const INITIAL_TOTAL = 142.8;
const INITIAL_CATEGORIES: CategoryData[] = [
  { name: "Dairy", amount: 32.5 },
  { name: "Meat", amount: 45.2 },
  { name: "Produce", amount: 28.9 },
  { name: "Bakery", amount: 12.4 },
  { name: "Pantry", amount: 23.8 },
];

const INITIAL_STORES: StoreData[] = [
  { store: "Lidl", amount: 68.4 },
  { store: "Tesco", amount: 42.1 },
  { store: "Sainsbury's", amount: 32.3 },
];

const INITIAL_TRENDS: TrendData[] = [
  { week: "Wk 1", milk: 1.45, average: 1.52 },
  { week: "Wk 2", milk: 1.29, average: 1.48 },
  { week: "Wk 3", milk: 1.19, average: 1.51 },
  { week: "Wk 4", milk: 1.25, average: 1.49 },
];

const CATEGORY_COLORS = [
  "#4a7c59", // fresh green
  "#8b5e3c", // warm
  "#5f8a6e", // soft green
  "#c5a16e", // warm neutral
  "#6b7f6b", // muted
];

export function FinancialsScreen() {
  const [totalSpent, setTotalSpent] = useState(INITIAL_TOTAL);
  const [categories] = useState(INITIAL_CATEGORIES);
  const [stores] = useState(INITIAL_STORES);
  const [trends] = useState(INITIAL_TRENDS);

  // Simple demo: simulate adding a small purchase
  const logDemoPurchase = () => {
    const add = 8.5 + Math.random() * 4;
    setTotalSpent((prev) => Math.round((prev + add) * 100) / 100);
  };

  // Category total for reference
  const categoryTotal = categories.reduce((sum, c) => sum + c.amount, 0);

  const totalFormatted = totalSpent.toFixed(2);

  // Prepare pie data with colors
  const pieData = categories.map((cat, i) => ({
    ...cat,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Hero total card - premium large number */}
      <div className="elevated-card rounded-3xl p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground tracking-[0.01em]">
              Total spent this month
            </div>
            <div className="mt-1 font-display text-[42px] leading-none font-medium tracking-[-0.025em] text-foreground">
              €{totalFormatted}
            </div>
          </div>
          <button
            onClick={logDemoPurchase}
            className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
          >
            + Log purchase
          </button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">18 receipts across 5 stores</div>
      </div>

      {/* Spending by category */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="text-sm font-semibold tracking-[0.005em] text-foreground/90">
            By category
          </div>
          <div className="text-[11px] text-muted-foreground">€{categoryTotal.toFixed(1)}</div>
        </div>

        <div className="elevated-card rounded-3xl p-4">
          <div className="h-[210px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="48%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`€${value.toFixed(1)}`, ""]}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category breakdown list */}
          <div className="mt-2 space-y-2">
            {categories.map((cat, i) => {
              const pct = Math.round((cat.amount / categoryTotal) * 100);
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                    <span className="font-medium">{cat.name}</span>
                  </div>
                  <div className="font-semibold tabular-nums text-foreground/90">
                    €{cat.amount.toFixed(1)} <span className="text-[11px] text-muted-foreground font-normal">· {pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spending by supermarket */}
      <div>
        <div className="text-sm font-semibold tracking-[0.005em] mb-3 px-1">By supermarket</div>

        <div className="elevated-card rounded-3xl p-4">
          <div className="h-[170px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stores} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis
                  dataKey="store"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickFormatter={(v) => `€${v}`}
                />
                <Tooltip
                  formatter={(value: number) => [`€${value.toFixed(1)}`, "Spent"]}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="#4a7c59"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            {stores.map((s, idx) => (
              <div key={idx} className="rounded-2xl bg-secondary/60 px-3 py-2">
                <div className="font-semibold">{s.store}</div>
                <div className="tabular-nums font-medium text-foreground/90">€{s.amount.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Price trends & comparisons */}
      <div>
        <div className="text-sm font-semibold tracking-[0.005em] mb-3 px-1">Price trends</div>

        <div className="elevated-card rounded-3xl p-4">
          <div className="text-[12px] text-muted-foreground mb-1 px-1">Whole milk (per L)</div>
          <div className="h-[150px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--color-border)" opacity={0.35} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  domain={[1.0, 1.7]}
                  tickFormatter={(v) => `€${v}`}
                />
                <Tooltip
                  formatter={(value: number) => [`€${value.toFixed(2)}`, ""]}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="milk"
                  stroke="#4a7c59"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#4a7c59" }}
                  name="Lidl"
                />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke="#a38b5f"
                  strokeWidth={2}
                  strokeDasharray="3 2"
                  dot={{ r: 2, fill: "#a38b5f" }}
                  name="Market avg"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Insight cards */}
          <div className="mt-4 space-y-2">
            <div className="rounded-2xl border border-[color-mix(in_oklab,var(--color-fresh)_25%,transparent)] bg-[color-mix(in_oklab,var(--color-fresh)_6%,var(--color-card))] px-4 py-3 text-sm">
              <span className="font-semibold">Lidl milk is 18% cheaper</span> than market average this month.
            </div>
            <div className="rounded-2xl border px-4 py-3 text-sm flex items-center justify-between">
              <span>Best value: <span className="font-semibold">Lidl</span></span>
              <span className="text-xs text-muted-foreground">Saved €4.20 on dairy</span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
