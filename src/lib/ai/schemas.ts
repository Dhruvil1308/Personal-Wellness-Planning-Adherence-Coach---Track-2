import { z } from "zod";
import { ITEM_TYPES } from "@/lib/constants";

/**
 * Models write times loosely — "8:00 AM", "13:00-13:30", "Throughout the day".
 * Parse what we can and fall back to a sensible slot default rather than
 * throwing the whole plan away over a formatting quirk.
 */
export function parseTimeLoose(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();

  const hm = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (hm) {
    let h = Number(hm[1]);
    const m = Number(hm[2]);
    const mer = hm[3]?.toLowerCase().replace(/\./g, "");
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const hOnly = s.match(/^(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i);
  if (hOnly) {
    let h = Number(hOnly[1]);
    const mer = hOnly[2].toLowerCase().replace(/\./g, "");
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    if (h > 23) return null;
    return `${String(h).padStart(2, "0")}:00`;
  }

  return null;
}

const SLOT_DEFAULT_TIME: Record<string, string> = {
  breakfast: "08:00",
  "mid-morning": "10:30",
  snack: "17:00",
  lunch: "13:00",
  dinner: "20:00",
  hydration: "07:00",
  movement: "18:00",
};

const TYPE_DEFAULT_TIME: Record<string, string> = {
  MEAL: "13:00",
  WATER: "07:00",
  EXERCISE: "18:00",
};

const rawItemSchema = z.object({
  type: z.enum(ITEM_TYPES),
  slot: z.string().max(40).optional().nullable(),
  title: z.string().min(1).max(120),
  details: z.string().max(500).default(""),
  scheduledTime: z.string(),
  targetQty: z.number().nonnegative().optional().nullable(),
  unit: z.string().max(16).optional().nullable(),
  calories: z.number().int().nonnegative().optional().nullable(),
  proteinG: z.number().int().nonnegative().optional().nullable(),
  why: z.string().max(400).default(""),
});

export const planItemSchema = rawItemSchema.transform((it) => ({
  ...it,
  scheduledTime:
    parseTimeLoose(it.scheduledTime) ??
    SLOT_DEFAULT_TIME[(it.slot ?? "").toLowerCase()] ??
    TYPE_DEFAULT_TIME[it.type],
}));

export const planSchema = z.object({
  focus: z.string().max(140),
  rationale: z.string().min(1).max(1200),
  adjustmentNote: z.string().max(800).optional().nullable(),
  coachMessage: z.string().max(500),
  hydrationTargetMl: z.number().int().min(1000).max(5000),
  calorieTarget: z.number().int().min(1200).max(4500).optional().nullable(),
  proteinTargetG: z.number().int().min(20).max(300).optional().nullable(),
  items: z.array(planItemSchema).min(4).max(16),
});

export type AIPlan = z.infer<typeof planSchema>;
export type AIPlanItem = AIPlan["items"][number];

export const summarySchema = z.object({
  summaryText: z.string().min(1).max(1200),
  wins: z.array(z.string().max(180)).max(5).default([]),
  gaps: z.array(z.string().max(180)).max(5).default([]),
  focusTomorrow: z.string().max(300).default(""),
});

export type AISummary = z.infer<typeof summarySchema>;
