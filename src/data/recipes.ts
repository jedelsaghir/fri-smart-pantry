import type { Recipe } from "@/types/pantry";

export const ALL_RECIPES: Recipe[] = [
  {
    id: "r1",
    name: "Scrambled Eggs",
    emoji: "🍳",
    time: "10 min",
    servings: 2,
    ingredients: [
      { name: "Free-range eggs", qty: 3, unit: "pcs" },
      { name: "Whole milk", qty: 0.1, unit: "L" },
    ],
    category: "Breakfast",
  },
  {
    id: "r2",
    name: "Greek Yogurt Bowl",
    emoji: "🥣",
    time: "5 min",
    servings: 1,
    ingredients: [
      { name: "Greek yogurt", qty: 1, unit: "tub" },
      { name: "Baby spinach", qty: 0.5, unit: "bag" },
    ],
    category: "Breakfast",
  },
  {
    id: "r3",
    name: "Cherry Tomato Salad",
    emoji: "🥗",
    time: "8 min",
    servings: 2,
    ingredients: [
      { name: "Cherry tomatoes", qty: 1, unit: "pack" },
      { name: "Baby spinach", qty: 1, unit: "bag" },
    ],
    category: "Lunch",
  },
  {
    id: "r4",
    name: "Cheesy Omelette",
    emoji: "🧀",
    time: "12 min",
    servings: 2,
    ingredients: [
      { name: "Free-range eggs", qty: 4, unit: "pcs" },
      { name: "Aged cheddar", qty: 50, unit: "g" },
      { name: "Whole milk", qty: 0.05, unit: "L" },
    ],
    category: "Breakfast",
  },
  {
    id: "r5",
    name: "Spinach Chicken Stir",
    emoji: "🍗",
    time: "20 min",
    servings: 3,
    ingredients: [
      { name: "Chicken thighs", qty: 300, unit: "g" },
      { name: "Baby spinach", qty: 1, unit: "bag" },
    ],
    category: "Dinner",
  },
  {
    id: "r6",
    name: "Tomato Cheese Toast",
    emoji: "🍞",
    time: "7 min",
    servings: 2,
    ingredients: [
      { name: "Cherry tomatoes", qty: 0.5, unit: "pack" },
      { name: "Aged cheddar", qty: 40, unit: "g" },
    ],
    category: "Snack",
  },
];
