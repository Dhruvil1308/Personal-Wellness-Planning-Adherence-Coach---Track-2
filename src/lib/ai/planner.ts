import { completeJSON, MAX_TOKENS } from "@/lib/ai/client";
import { cautionNote, SAFETY_PREAMBLE, screenUserText } from "@/lib/ai/guardrails";
import { type AIPlan, planSchema } from "@/lib/ai/schemas";
import { buildFallbackPlan } from "@/lib/ai/fallback";
import { allergenTerms, auditPlanForAllergens } from "@/lib/ai/allergens";
import { describeAdherence, type Adherence } from "@/lib/adherence";
import { estimateTargets } from "@/lib/nutrition";
import { labelFor, ACTIVITY_LEVELS, CUISINES, DIET_PREFS, EQUIPMENT, GOALS } from "@/lib/constants";
import { prettyDay } from "@/lib/date";
import type { Feedback, User } from "@/generated/prisma/client";

export type PriorDay = {
  date: string;
  focus: string | null;
  adherence: Adherence;
  feedback: Feedback | null;
  summaryText: string | null;
};

export type PlanGenerationResult = {
  plan: AIPlan;
  generatedBy: "ai" | "fallback";
  /** Populated when the model call failed and the rule-based planner ran. */
  fallbackReason?: string;
};

function profileBlock(user: User): string {
  const t = estimateTargets(user);
  return [
    `Name: ${user.name}`,
    `Age range: ${user.ageRange}`,
    `Height: ${user.heightCm} cm, Weight: ${user.weightKg} kg (BMI ${t.bmi}, ${t.bmiBand})`,
    user.sex ? `Sex: ${user.sex}` : null,
    `Goal: ${labelFor(GOALS, user.goal)}`,
    `Activity level: ${labelFor(ACTIVITY_LEVELS, user.activityLevel)}`,
    `Diet: ${labelFor(DIET_PREFS, user.dietaryPreference)} | Cuisine preference: ${labelFor(CUISINES, user.cuisine)}`,
    `Allergies / must avoid: ${user.allergies || "none stated"}`,
    `Dislikes: ${user.dislikes || "none stated"}`,
    `Physical limitations / notes: ${user.limitations || "none stated"}`,
    `Equipment available: ${labelFor(EQUIPMENT, user.equipment)}`,
    `Wakes ${user.wakeTime}, sleeps ${user.sleepTime}, has about ${user.workoutWindowMin} min/day for movement`,
    "",
    "Non-clinical reference estimates (guidance only, stay close to these):",
    `- Estimated maintenance energy: ~${t.maintenanceKcal} kcal/day`,
    `- Suggested daily energy target: ~${t.calorieTarget} kcal`,
    `- Suggested protein: ~${t.proteinTargetG} g`,
    `- Suggested hydration: ~${t.hydrationTargetMl} ml`,
  ]
    .filter(Boolean)
    .join("\n");
}

function historyBlock(prior: PriorDay[]): string {
  if (!prior.length) {
    return "This is the user's FIRST plan. There is no history yet — build a sustainable starting routine and say so in the rationale.";
  }

  const blocks = prior.map((d) => {
    const fb = d.feedback
      ? `Feedback: energy ${d.feedback.energy}/5, plan difficulty ${d.feedback.difficulty}/5, hunger ${d.feedback.hunger}/5${
          d.feedback.mood ? `, mood "${d.feedback.mood}"` : ""
        }${d.feedback.notes ? `, notes: "${d.feedback.notes}"` : ""}`
      : "Feedback: none given";

    return [
      `### ${prettyDay(d.date)} (${d.date})${d.focus ? ` — focus was "${d.focus}"` : ""}`,
      describeAdherence(d.adherence),
      fb,
      d.summaryText ? `End-of-day summary: ${d.summaryText}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const avg =
    Math.round(
      (prior.reduce((s, d) => s + d.adherence.overallPct, 0) / prior.length) * 10,
    ) / 10;

  return [
    `RECORDED HISTORY (most recent day first). Rolling average adherence: ${avg}%.`,
    "",
    ...blocks,
  ].join("\n\n");
}

const SYSTEM = `${SAFETY_PREAMBLE}

You build one day of a personalised wellness routine and you EXPLAIN every choice.

Rules for the plan you produce:
1. Respect the profile absolutely: never include an allergen or a food excluded by the stated diet. Never prescribe movement the stated limitations rule out.
2. Schedule everything inside the user's waking hours and around their stated routine.
3. Include 3-5 MEAL items (main meals plus snacks), 1 WATER item for the whole day's hydration target, and 1-3 EXERCISE items that fit the available time and equipment.
4. Meals must be realistic, named dishes from the user's cuisine preference — not "a balanced lunch". Give a portion in the details.
5. Every item needs a "why": one specific sentence tying it to this person's goal, schedule, preference or recorded behaviour. Generic filler is a failure.
6. The WATER item's targetQty must equal hydrationTargetMl, with unit "ml". EXERCISE targetQty is minutes with unit "min". MEAL targetQty is 1 with unit "serving".
7. Meal calories should roughly sum to the calorie target (within ~10%).

ADJUSTING FROM HISTORY — this is the most important part when history exists:
- Read the item-by-item record. Anything skipped or never logged is a signal about this person's real life, not a failure to scold.
- A repeatedly missed item MUST change: move its time, shrink it, swap it for something easier, or replace it. Do not re-issue an identical item that was missed.
- Low adherence (<60%) => reduce the load: fewer items, shorter sessions, simpler meals. High adherence (>85%) => add a small progression.
- Use the feedback: high difficulty => ease off. Low energy => check meal timing and hydration. High hunger => more protein/fibre and better-spaced meals.
- "adjustmentNote" must name the SPECIFIC changes and the evidence: e.g. "Moved your workout from 06:30 to 19:00 — you skipped it on both mornings but logged the evening walk." Never leave it vague. Only omit it when there is no history at all.

Reply with ONLY a JSON object of this exact shape:
{
  "focus": string,
  "rationale": string,
  "adjustmentNote": string | null,
  "coachMessage": string,
  "hydrationTargetMl": integer,
  "calorieTarget": integer,
  "proteinTargetG": integer,
  "items": [
    {
      "type": "MEAL" | "WATER" | "EXERCISE",
      "slot": string,
      "title": string,
      "details": string,
      "scheduledTime": "HH:MM",
      "targetQty": number,
      "unit": string,
      "calories": integer | null,
      "proteinG": integer | null,
      "why": string
    }
  ]
}`;

export async function generatePlan(opts: {
  user: User;
  date: string;
  prior: PriorDay[];
}): Promise<PlanGenerationResult> {
  const { user, date, prior } = opts;

  const screening = screenUserText(
    user.limitations,
    user.allergies,
    ...prior.map((p) => p.feedback?.notes),
  );

  const userPrompt = [
    `Build the wellness plan for ${prettyDay(date)} (${date}).`,
    "",
    "## USER PROFILE",
    profileBlock(user),
    "",
    "## HISTORY",
    historyBlock(prior),
    cautionNote(screening),
  ].join("\n");

  try {
    let plan = await completeJSON({
      system: SYSTEM,
      user: userPrompt,
      schema: planSchema,
      maxTokens: MAX_TOKENS.plan,
    });

    // Deterministic allergen gate. The prompt forbids allergens, but a model is
    // not a guarantee, and this is the one mistake that can actually hurt.
    let hits = auditPlanForAllergens(plan, user);
    if (hits.length) {
      console.warn(
        "[ai] allergen violation, regenerating:",
        hits.map((h) => `${h.title} → ${h.term}`).join(", "),
      );
      plan = await completeJSON({
        system: SYSTEM,
        user: `${userPrompt}\n\nYOUR PREVIOUS PLAN WAS REJECTED. It contained ${hits
          .map((h) => `"${h.title}" (contains ${h.term})`)
          .join(" and ")}, which the user cannot eat. Rebuild the plan with completely different meals that contain none of: ${allergenTerms(
          user,
        ).join(", ")}.`,
        schema: planSchema,
        maxTokens: MAX_TOKENS.plan,
        attempts: 1,
      });
      hits = auditPlanForAllergens(plan, user);
      if (hits.length) throw new Error("Model kept returning an allergen after a retry");
    }

    return { plan: normalise(plan), generatedBy: "ai" };
  } catch (err) {
    // The demo must never dead-end on a model outage or a bad key.
    const reason = err instanceof Error ? err.message : "unknown error";
    return {
      plan: buildFallbackPlan({ user, prior }),
      generatedBy: "fallback",
      fallbackReason: reason,
    };
  }
}

/** Sorts items by time and repairs the small things models get wrong. */
function normalise(plan: AIPlan): AIPlan {
  const items = plan.items
    .map((it) => {
      if (it.type === "WATER") {
        return {
          ...it,
          unit: "ml",
          targetQty: it.targetQty && it.targetQty > 0 ? it.targetQty : plan.hydrationTargetMl,
        };
      }
      if (it.type === "EXERCISE") {
        return { ...it, unit: "min", targetQty: it.targetQty && it.targetQty > 0 ? it.targetQty : 20 };
      }
      return { ...it, unit: it.unit ?? "serving", targetQty: it.targetQty ?? 1 };
    })
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  // Collapse duplicate water rows into the single daily hydration item.
  const waters = items.filter((i) => i.type === "WATER");
  const rest = items.filter((i) => i.type !== "WATER");
  const water = waters.length
    ? { ...waters[0], targetQty: plan.hydrationTargetMl }
    : null;

  return {
    ...plan,
    items: [...rest, ...(water ? [water] : [])].sort((a, b) =>
      a.scheduledTime.localeCompare(b.scheduledTime),
    ),
  };
}
