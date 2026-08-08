import type { AIPlan } from "@/lib/ai/schemas";
import type { User } from "@/generated/prisma/client";

/**
 * A hard safety net over anything that reaches a plate. The prompt already
 * forbids allergens, but a language model is not a guarantee — a missed
 * allergen is the one failure in a wellness app that actually hurts someone,
 * so the output is checked deterministically before it is stored.
 */

/** Common aliases so "peanuts" also catches "groundnut" and "peanut butter". */
const ALIASES: Record<string, string[]> = {
  peanut: ["peanut", "peanuts", "groundnut", "groundnuts", "moongphali"],
  milk: ["milk", "dairy", "curd", "yoghurt", "yogurt", "paneer", "cheese", "butter", "ghee", "cream"],
  dairy: ["milk", "dairy", "curd", "yoghurt", "yogurt", "paneer", "cheese", "butter", "ghee", "cream"],
  lactose: ["milk", "dairy", "curd", "yoghurt", "yogurt", "paneer", "cheese", "cream"],
  gluten: ["gluten", "wheat", "roti", "chapati", "bread", "toast", "pasta", "seitan", "atta", "maida"],
  wheat: ["wheat", "roti", "chapati", "bread", "toast", "pasta", "atta", "maida"],
  soy: ["soy", "soya", "tofu", "edamame", "tempeh"],
  egg: ["egg", "eggs", "omelette", "omelet", "bhurji"],
  nut: ["nut", "nuts", "almond", "cashew", "walnut", "pistachio", "hazelnut"],
  treenut: ["almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan"],
  shellfish: ["shellfish", "prawn", "prawns", "shrimp", "crab", "lobster"],
  fish: ["fish", "salmon", "tuna", "mackerel", "pomfret", "rohu"],
  sesame: ["sesame", "til", "tahini"],
  mustard: ["mustard", "sarson"],
};

export function allergenTerms(user: User): string[] {
  const stated = user.allergies
    .split(/[,;/]|\band\b/i)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 2);

  const terms = new Set<string>();
  for (const raw of stated) {
    terms.add(raw);
    // Match the alias group by stem so "peanuts" finds the "peanut" group.
    for (const [key, list] of Object.entries(ALIASES)) {
      if (raw.includes(key) || key.includes(raw.replace(/s$/, ""))) {
        list.forEach((t) => terms.add(t));
      }
    }
  }
  return [...terms];
}

const wordish = (term: string) =>
  new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|es)?([^a-z]|$)`, "i");

export function findAllergenHits(
  texts: string[],
  terms: string[],
): { text: string; term: string }[] {
  const hits: { text: string; term: string }[] = [];
  for (const text of texts) {
    for (const term of terms) {
      if (wordish(term).test(text)) hits.push({ text, term });
    }
  }
  return hits;
}

/** Returns the offending (item title, allergen) pairs in an AI plan, if any. */
export function auditPlanForAllergens(plan: AIPlan, user: User) {
  const terms = allergenTerms(user);
  if (!terms.length) return [];

  return plan.items
    .filter((i) => i.type === "MEAL")
    .flatMap((i) => {
      const hits = findAllergenHits([`${i.title} ${i.details}`], terms);
      return hits.map((h) => ({ title: i.title, term: h.term }));
    });
}
