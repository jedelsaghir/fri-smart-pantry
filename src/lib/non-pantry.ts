/**
 * Detect non-pantry / non-food receipt lines so they never auto-enter Fridge,
 * Freezer, or Pantry stock. Deterministic keyword + light category heuristics.
 */

export type PantryEligibilityKind = "pantry" | "non_pantry" | "uncertain";

export type PantryEligibility = {
  kind: PantryEligibilityKind;
  /** 0–1 confidence that classification is correct */
  score: number;
  /** Short human reason for UI / debugging */
  reason?: string;
  /** Matched category label when non-pantry */
  category?: string;
};

/** Strong food / beverage / kitchen-consumable signals (override non-pantry) */
const FOOD_POSITIVE: RegExp[] = [
  /\b(milk|lait|yogurt|yoghurt|cheese|butter|cream|egg|eggs|œufs?)\b/i,
  /\b(chicken|beef|pork|lamb|turkey|meat|steak|mince|sausage|bacon|ham)\b/i,
  /\b(fish|salmon|tuna|shrimp|cod|seafood)\b/i,
  /\b(bread|loaf|bagel|croissant|pasta|rice|flour|cereal|oat|granola)\b/i,
  /\b(apple|banana|orange|lemon|berry|berries|grape|tomato|potato|onion|garlic|carrot|lettuce|spinach|salad|avocado|cucumber|pepper|mushroom|herb|basil)\b/i,
  /\b(juice|water|coffee|tea|wine|beer|soda|cola|sparkling|smoothie)\b/i,
  /\b(oil|olive|vinegar|sauce|spice|salt|sugar|honey|jam|nut|almond|peanut)\b/i,
  /\b(soup|broth|bean|lentil|chickpea|tofu|hummus)\b/i,
  /\b(ice.?cream|frozen|pizza|fries|chips|crisp|chocolate|cookie|biscuit|candy)\b/i,
  /\b(yoghurt|fromage|beurre|pain|poulet|viande|légume|fruit)\b/i,
];

type NonPantryRule = {
  category: string;
  /** Strong hits → non_pantry when OCR conf is high */
  strong: RegExp;
  /** Weaker / ambiguous hits → uncertain */
  soft?: RegExp;
};

const NON_PANTRY_RULES: NonPantryRule[] = [
  {
    category: "cleaning",
    strong:
      /\b(bleach|disinfectant|disinfectant|detergent|dishwasher\s*tab|washing\s*up\s*liquid|floor\s*cleaner|multi.?purpose\s*cleaner|surface\s*cleaner|toilet\s*cleaner|bathroom\s*cleaner|kitchen\s*cleaner|descaler|antibacterial\s*wipe|cleaning\s*wipe|mr\s*propre|ajax|cif|fairy\s*liquid|javel|nettoyant|lessive|assouplissant)\b/i,
    soft: /\b(cleaner|cleaning|wipe|wipes|sponge|scrub|mop|broom)\b/i,
  },
  {
    category: "laundry",
    strong:
      /\b(laundry|fabric\s*softener|washer\s*pod|tide|persil|ariel|lenor|downy|vanish|stain\s*remover|dryer\s*sheet|peg\b|clothes?\s*peg)\b/i,
    soft: /\b(wash\s*powder|wash\s*liquid|softener)\b/i,
  },
  {
    category: "personal care",
    strong:
      /\b(shampoo|conditioner|body\s*wash|shower\s*gel|toothpaste|toothbrush|mouthwash|deodorant|antiperspirant|razor|shaving|aftershave|makeup|mascara|lipstick|foundation|sunscreen|sun\s*cream|moisturizer|moisturiser|lotion|hand\s*cream|face\s*cream|serum|floss|cotton\s*pad|cotton\s*bud|q.?tip|tampon|pad\s*pack|sanitary|nappy|diaper|wipes\s*baby|baby\s*wipe|soap\s*bar|hand\s*soap|liquid\s*soap|perfume|cologne|deodorant)\b/i,
    soft: /\b(soap|gel\s*douche|dentifrice|crème|cream\s*hand|body\s*lotion)\b/i,
  },
  {
    category: "household",
    strong:
      /\b(bin\s*bags?|garbage\s*bags?|trash\s*bags?|rubbish\s*bags?|cling\s*film|plastic\s*wrap|foil\s*roll|aluminium\s*foil|aluminum\s*foil|baking\s*paper|parchment|kitchen\s*roll|paper\s*towels?|toilet\s*rolls?|toilet\s*paper|tissue|kleenex|napkin|serviette|ziploc|freezer\s*bags?|sandwich\s*bags?|lightbulbs?|light\s*bulbs?|batter(?:y|ies)|duracell|energizer|candle|incense|matches|lighter|air\s*freshener|glade|febreze|insecticide|fly\s*spray|mouse\s*trap)\b/i,
    soft: /\b(bag\s*roll|foil|tissue|batter(?:y|ies)|bulb)\b/i,
  },
  {
    category: "pet non-food",
    strong:
      /\b(cat\s*litter|kitty\s*litter|dog\s*toy|pet\s*shampoo|flea\s*collar|poop\s*bag|puppy\s*pad)\b/i,
  },
  {
    category: "clothing",
    strong:
      /\b(t.?shirt|hoodie|socks?|underwear|bra\b|jeans|trousers|shorts|jacket|coat|scarf|gloves?|hat\b|cap\b|shoes?|sneakers?|slippers?|boots?|trainers?)\b/i,
  },
  {
    category: "electronics",
    strong:
      /\b(usb|hdmi|charger|cable|earphone|earbud|headphone|phone\s*case|screen\s*protector|power\s*bank|sd\s*card|memory\s*card|extension\s*lead|adapter|batter(?:y|ies)\s*aa|aaa\s*batter)\b/i,
  },
  {
    category: "pharmacy",
    strong:
      /\b(paracetamol|ibuprofen|aspirin|plaster|bandage|antiseptic|cough\s*syrup|vitamin\s*d\b|supplement\s*iron|pain\s*relief|nasal\s*spray|eye\s*drop|condom|pregnancy\s*test|thermometer)\b/i,
    soft: /\b(vitamin|supplement|tablet|capsule|medicine|meds)\b/i,
  },
  {
    category: "stationery",
    strong:
      /\b(notebook|biro|pen\b|pencil|stapler|envelope|stamps?|glue\s*stick|scissors|printer\s*paper|a4\s*paper)\b/i,
  },
  {
    category: "tobacco / misc",
    strong: /\b(cigarette|tobacco|vape|e.?cig|lighter\s*fluid|lottery|scratchcard)\b/i,
  },
];

/** Explicit food-safe exceptions that soft rules might wrongly flag */
const FOOD_SAFE_OVERRIDE =
  /\b(soap\s*berries|cocoa\s*butter|shea\s*butter|peanut\s*butter|almond\s*butter|cookie\s*dough|ice\s*cream|cream\s*cheese|sour\s*cream|whipping\s*cream|double\s*cream|single\s*cream|pastry\s*cream|custard\s*cream|sandwich|baguette|pita|wrap\b|spring\s*roll)\b/i;

function normalizeForMatch(name: string): string {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasFoodPositive(text: string): boolean {
  if (FOOD_SAFE_OVERRIDE.test(text)) return true;
  return FOOD_POSITIVE.some((re) => re.test(text));
}

/**
 * Classify whether a receipt line belongs in fridge / freezer / pantry.
 */
export function classifyPantryEligibility(
  name: string,
  opts?: { category?: string | null; ocrConfidence?: number }
): PantryEligibility {
  const text = normalizeForMatch(name);
  if (!text) {
    return { kind: "uncertain", score: 0.4, reason: "Empty name" };
  }

  const cat = (opts?.category || "").toLowerCase();
  const ocr = typeof opts?.ocrConfidence === "number" ? opts.ocrConfidence : 0.75;

  // Category hints from OCR model
  if (
    cat &&
    /clean|laundry|personal|hygiene|household|home|non.?food|electronics|clothing|pharmacy|health|beauty|pet\s*care/i.test(
      cat
    )
  ) {
    if (hasFoodPositive(text)) {
      return { kind: "uncertain", score: 0.55, reason: "Category conflicts with food keywords", category: cat };
    }
    return {
      kind: "non_pantry",
      score: Math.min(0.95, 0.8 + ocr * 0.15),
      reason: `Category: ${cat}`,
      category: cat,
    };
  }

  if (hasFoodPositive(text)) {
    return { kind: "pantry", score: 0.9, reason: "Food / beverage keywords" };
  }

  let bestStrong: { category: string; score: number } | null = null;
  let bestSoft: { category: string; score: number } | null = null;

  for (const rule of NON_PANTRY_RULES) {
    if (rule.strong.test(text)) {
      const score = Math.min(0.98, 0.88 + ocr * 0.1);
      if (!bestStrong || score > bestStrong.score) {
        bestStrong = { category: rule.category, score };
      }
    } else if (rule.soft?.test(text)) {
      const score = 0.55 + ocr * 0.15;
      if (!bestSoft || score > bestSoft.score) {
        bestSoft = { category: rule.category, score };
      }
    }
  }

  if (bestStrong) {
    return {
      kind: "non_pantry",
      score: bestStrong.score,
      reason: bestStrong.category,
      category: bestStrong.category,
    };
  }

  if (bestSoft) {
    return {
      kind: "uncertain",
      score: Math.min(0.75, bestSoft.score),
      reason: `Possibly ${bestSoft.category}`,
      category: bestSoft.category,
    };
  }

  // Default: treat as pantry-compatible grocery line
  return { kind: "pantry", score: 0.65, reason: "No non-food signals" };
}

/**
 * High-confidence non-pantry → auto-exclude (no add, no normal review).
 * Threshold: eligibility score ≥ 0.85 and kind === non_pantry
 * (OCR conf also considered inside classify).
 */
export function shouldAutoExcludeNonPantry(eligibility: PantryEligibility): boolean {
  return eligibility.kind === "non_pantry" && eligibility.score >= 0.85;
}

/** Uncertain → manual review with flag */
export function isPossiblyNonFood(eligibility: PantryEligibility): boolean {
  return eligibility.kind === "uncertain";
}
