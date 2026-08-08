import type { AIPlan, AIPlanItem } from "@/lib/ai/schemas";
import type { PriorDay } from "@/lib/ai/planner";
import { allergenTerms, findAllergenHits } from "@/lib/ai/allergens";
import { estimateTargets } from "@/lib/nutrition";
import type { User } from "@/generated/prisma/client";

/**
 * Deterministic rule-based planner. It runs only when the model call fails
 * (missing key, outage, rate limit, or an unsafe response) so a demo or a real
 * day never dead-ends without a plan. It applies the same adjustment logic the
 * prompt asks for, just with fixed rules instead of language understanding.
 */

type MealOption = {
  title: string;
  details: string;
  /** Diets this option is valid for. */
  diets: string[];
};

type SlotSpec = {
  slot: string;
  time: string;
  share: number; // fraction of the day's energy target
  proteinShare: number;
  options: MealOption[];
};

const ALL = ["vegetarian", "vegan", "eggetarian", "non_veg", "jain"];
const VEG_OK = ["vegetarian", "eggetarian", "non_veg", "jain"];

/**
 * Options are ordered from most to least commonly acceptable; the planner walks
 * the list and takes the first that clears the user's diet, allergies and
 * dislikes. The last entry in every slot is a deliberately plain staple so a
 * heavily restricted profile still gets something.
 */
const SLOTS: SlotSpec[] = [
  {
    slot: "breakfast",
    time: "08:00",
    share: 0.25,
    proteinShare: 0.2,
    options: [
      { title: "Moong dal chilla with mint chutney", details: "2 chillas from soaked moong dal, side of chutney", diets: ALL },
      { title: "Vegetable poha with peanuts", details: "1.5 cups poha with onion, peas, carrot and roasted peanuts", diets: ALL },
      { title: "Two-egg omelette with toast", details: "2 eggs with onion and spinach, 2 slices whole-wheat toast", diets: ["eggetarian", "non_veg"] },
      { title: "Oats with soy milk, banana and chia", details: "50g oats, 250ml soy milk, 1 banana, 1 tsp chia", diets: ALL },
      { title: "Steamed idli with sambar", details: "3 idli with a bowl of sambar", diets: ALL },
      { title: "Fruit bowl with roasted seeds", details: "Papaya, banana and apple with 1 tbsp pumpkin seeds", diets: ALL },
    ],
  },
  {
    slot: "lunch",
    time: "13:00",
    share: 0.35,
    proteinShare: 0.32,
    options: [
      { title: "Rajma with brown rice and salad", details: "1 cup rajma, 3/4 cup brown rice, cucumber-tomato salad", diets: ALL },
      { title: "Chana masala with jeera rice", details: "1 cup chickpea curry, 3/4 cup rice, side salad", diets: ALL },
      { title: "Grilled chicken with rice and salad", details: "150g grilled chicken, 3/4 cup rice, cucumber salad", diets: ["non_veg"] },
      { title: "Moong dal with lauki sabzi and rice", details: "1 cup moong dal, bottle-gourd sabzi, 3/4 cup rice", diets: ALL },
      { title: "Vegetable khichdi", details: "1.5 cups khichdi with mixed vegetables", diets: ALL },
    ],
  },
  {
    slot: "snack",
    time: "17:00",
    share: 0.15,
    proteinShare: 0.18,
    options: [
      { title: "Roasted chana with a fruit", details: "30g roasted chana and an apple or orange", diets: ALL },
      { title: "Curd with roasted makhana", details: "150g curd, 25g makhana", diets: VEG_OK },
      { title: "Sprouts chaat", details: "1 cup mixed sprouts with onion, tomato and lemon", diets: ALL },
      { title: "A fruit and a glass of water", details: "One seasonal fruit, plus 250ml water", diets: ALL },
    ],
  },
  {
    slot: "dinner",
    time: "20:00",
    share: 0.25,
    proteinShare: 0.3,
    options: [
      { title: "Paneer bhurji with 2 rotis", details: "100g paneer scrambled with peppers, 2 whole-wheat rotis", diets: VEG_OK },
      { title: "Tofu stir-fry with brown rice", details: "150g tofu, mixed vegetables, 3/4 cup brown rice", diets: ALL },
      { title: "Fish curry with 2 rotis", details: "150g fish curry, 2 rotis, sautéed beans", diets: ["non_veg"] },
      { title: "Mixed dal with steamed rice and greens", details: "1 cup dal, 3/4 cup rice, stir-fried spinach", diets: ALL },
      { title: "Vegetable soup with steamed rice", details: "Large bowl of mixed vegetable soup with 3/4 cup rice", diets: ALL },
    ],
  },
];

type MoveTemplate = { title: string; details: string; minutes: number; time: string };

const MOVEMENT: Record<string, MoveTemplate[]> = {
  none: [
    { title: "Brisk walk", details: "Steady pace where talking is possible but effortful", minutes: 30, time: "07:00" },
    { title: "Bodyweight circuit", details: "Squats, incline push-ups, glute bridges, plank — 3 rounds", minutes: 20, time: "18:30" },
  ],
  bands: [
    { title: "Band strength circuit", details: "Band rows, presses, squats and pull-aparts — 3 rounds", minutes: 25, time: "07:00" },
    { title: "Evening walk", details: "Easy pace to wind down", minutes: 25, time: "19:00" },
  ],
  dumbbells: [
    { title: "Dumbbell full-body session", details: "Goblet squats, rows, presses, RDLs — 3 sets each", minutes: 30, time: "07:00" },
    { title: "Post-dinner walk", details: "Gentle 20-minute walk", minutes: 20, time: "20:45" },
  ],
  full_gym: [
    { title: "Gym strength session", details: "Compound lifts plus accessories, moderate load", minutes: 40, time: "07:00" },
    { title: "Treadmill or cycle cool-down", details: "Easy zone-2 effort", minutes: 15, time: "07:45" },
  ],
};

const LOW_IMPACT: MoveTemplate[] = [
  { title: "Gentle mobility flow", details: "Seated and standing mobility, no impact, stop at any discomfort", minutes: 15, time: "07:30" },
  { title: "Easy walk", details: "Flat ground, comfortable pace", minutes: 20, time: "18:30" },
];

function hasLimitation(user: User) {
  return user.limitations.trim().length > 2;
}

function clampTime(t: string, wake: string, sleep: string) {
  if (t < wake) return wake;
  if (t > sleep) return sleep;
  return t;
}

function shiftMinutes(time: string, delta: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + delta));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Picks the first option in a slot that clears the diet, every allergen term
 * and every stated dislike. `rotate` shifts the starting point so consecutive
 * days differ without ever returning an unsafe option.
 */
function pickOption(spec: SlotSpec, user: User, rotate: number): MealOption | null {
  const banned = [
    ...allergenTerms(user),
    ...user.dislikes
      .split(/[,;/]|\band\b/i)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 2),
  ];

  const valid = spec.options.filter((o) => o.diets.includes(user.dietaryPreference));
  if (!valid.length) return null;

  for (let i = 0; i < valid.length; i++) {
    const o = valid[(rotate + i) % valid.length];
    if (!findAllergenHits([`${o.title} ${o.details}`], banned).length) return o;
  }
  return null;
}

export function buildFallbackPlan(opts: { user: User; prior: PriorDay[] }): AIPlan {
  const { user, prior } = opts;
  const targets = estimateTargets(user);
  const last = prior[0];

  const adherence = last?.adherence.overallPct ?? null;
  const easeOff = adherence != null && adherence < 60;
  const progress = adherence != null && adherence > 85;
  const feltHard = (last?.feedback?.difficulty ?? 0) >= 4;

  const kcal = targets.calorieTarget;
  const protein = targets.proteinTargetG;
  const rotate = prior.length;
  const changes: string[] = [];

  // Any meal slot skipped or never logged yesterday moves earlier and lighter —
  // the usual cause is a slot that does not fit the real day.
  const skippedSlots = new Set(
    [...(last?.adherence.missed ?? []), ...(last?.adherence.pending ?? [])]
      .filter((p) => p.item.type === "MEAL")
      .map((p) => (p.item.slot ?? "").toLowerCase()),
  );

  const mealItems: AIPlanItem[] = SLOTS.filter(
    (s) => !((easeOff || feltHard) && s.slot === "snack"),
  )
    .map((spec): AIPlanItem | null => {
      const option = pickOption(spec, user, rotate);
      if (!option) return null; // nothing in this slot clears the restrictions

      const shifted = skippedSlots.has(spec.slot);
      if (shifted)
        changes.push(`moved ${spec.slot} earlier and lighter — it went unlogged yesterday`);

      return {
        type: "MEAL" as const,
        slot: spec.slot,
        title: option.title,
        details: shifted ? `${option.details} — keep the portion light today` : option.details,
        scheduledTime: clampTime(
          shifted ? shiftMinutes(spec.time, -30) : spec.time,
          user.wakeTime,
          user.sleepTime,
        ),
        targetQty: 1,
        unit: "serving",
        calories: Math.round((kcal * spec.share) / 5) * 5,
        proteinG: Math.round(protein * spec.proteinShare),
        why: shifted
          ? `You did not log ${spec.slot} yesterday, so it is earlier and smaller to make it easier to hit.`
          : `Fits your ${user.dietaryPreference.replace("_", "-")} preference${
              user.allergies.trim() ? `, avoids ${user.allergies.trim()}` : ""
            }, and covers about ${Math.round(spec.share * 100)}% of today's energy target.`,
      };
    })
    .filter((i): i is AIPlanItem => i !== null);

  // Movement: limitation-aware first, then scaled by yesterday's adherence.
  const baseMoves = hasLimitation(user) ? LOW_IMPACT : (MOVEMENT[user.equipment] ?? MOVEMENT.none);
  const exerciseMissed = [
    ...(last?.adherence.missed ?? []),
    ...(last?.adherence.pending ?? []),
  ].some((p) => p.item.type === "EXERCISE");

  if (easeOff) changes.push("dropped to a single movement block while consistency rebuilds");
  if (progress) changes.push("added five minutes to your session since you cleared yesterday's plan");

  const moves = baseMoves.slice(0, easeOff || feltHard ? 1 : 2).map((m) => {
    let time = m.time;
    let minutes = m.minutes;
    if (easeOff || feltHard) minutes = Math.max(10, Math.round(minutes * 0.65));
    if (progress) minutes += 5;
    if (exerciseMissed && time < "12:00") {
      time = "18:30";
      changes.push("moved your session to the evening — the morning slot was missed");
    }
    return { ...m, minutes, time: clampTime(time, user.wakeTime, user.sleepTime) };
  });

  const exerciseItems: AIPlanItem[] = moves.map((m) => ({
    type: "EXERCISE" as const,
    slot: "movement",
    title: m.title,
    details: m.details,
    scheduledTime: m.time,
    targetQty: Math.min(m.minutes, user.workoutWindowMin || m.minutes),
    unit: "min",
    calories: null,
    proteinG: null,
    why: hasLimitation(user)
      ? `Kept low-impact because you noted: ${user.limitations}. Stop if anything hurts.`
      : `Matches the ${user.workoutWindowMin} minutes you have and the equipment you listed.`,
  }));

  const hydrationTargetMl =
    last && last.adherence.waterPct < 60
      ? Math.max(1800, targets.hydrationTargetMl - 300)
      : targets.hydrationTargetMl;
  if (hydrationTargetMl !== targets.hydrationTargetMl)
    changes.push("lowered the hydration target so it is reachable, then we build back up");

  const waterItem: AIPlanItem = {
    type: "WATER",
    slot: "hydration",
    title: `Drink ${hydrationTargetMl} ml of water`,
    details: `About ${Math.round(hydrationTargetMl / 250)} glasses across the day — log each one as you go.`,
    scheduledTime: user.wakeTime,
    targetQty: hydrationTargetMl,
    unit: "ml",
    calories: null,
    proteinG: null,
    why: `Roughly 33 ml per kg of body weight, adjusted for a ${user.activityLevel} activity level.`,
  };

  const items = [...mealItems, ...exerciseItems, waterItem].sort((a, b) =>
    a.scheduledTime.localeCompare(b.scheduledTime),
  );

  const focus = easeOff
    ? "Rebuild the streak with a lighter day"
    : progress
      ? "Small step up on a plan you are already hitting"
      : "Steady, sustainable routine";

  return {
    focus,
    rationale: [
      `Built around your goal of ${user.goal.replace("_", " ")} at a ${user.activityLevel} activity level, with a ${user.dietaryPreference.replace("_", "-")} plan of about ${kcal} kcal and ${protein} g of protein.`,
      user.allergies.trim()
        ? `Every meal was checked against your stated allergies (${user.allergies.trim()}) before it was included.`
        : "",
      hasLimitation(user)
        ? `Movement is low-impact because you noted: ${user.limitations}. Please confirm anything new with a qualified professional.`
        : `Movement fits the ${user.workoutWindowMin} minutes and equipment you listed.`,
      "This is general wellness guidance, not medical advice.",
    ]
      .filter(Boolean)
      .join(" "),
    adjustmentNote: last
      ? `Yesterday you finished ${last.adherence.overallPct}% of the plan. Today ${
          changes.length ? [...new Set(changes)].join("; ") : "keeps the same structure since it is working"
        }.`
      : null,
    coachMessage: last
      ? `${user.name}, ${last.adherence.overallPct >= 70 ? "you are building real momentum" : "one lighter day is all it takes to get moving again"}. Aim for the next single check-in, not the whole day.`
      : `Welcome, ${user.name}. Start with one check-in today — consistency beats intensity every time.`,
    hydrationTargetMl,
    calorieTarget: kcal,
    proteinTargetG: protein,
    items,
  };
}
