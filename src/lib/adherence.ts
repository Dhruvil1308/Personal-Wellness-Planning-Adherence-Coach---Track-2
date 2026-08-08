import { ADHERENCE_WEIGHTS } from "@/lib/constants";
import type { CheckIn, Plan, PlanItem } from "@/generated/prisma/client";

export type PlanWithItems = Plan & {
  items: (PlanItem & { checkIns: CheckIn[] })[];
};

export type ItemProgress = {
  item: PlanItem;
  /** 0..1 — how much of this item actually happened. */
  ratio: number;
  status: "DONE" | "PARTIAL" | "SKIPPED" | "PENDING";
  loggedQty: number | null;
  note: string | null;
  checkInCount: number;
};

export type Adherence = {
  overallPct: number;
  mealPct: number;
  waterPct: number;
  exercisePct: number;
  waterMl: number;
  waterTargetMl: number;
  caloriesConsumed: number;
  calorieTarget: number | null;
  proteinConsumedG: number;
  itemsTotal: number;
  itemsCompleted: number;
  itemsPending: number;
  progress: ItemProgress[];
  completed: ItemProgress[];
  missed: ItemProgress[];
  partial: ItemProgress[];
  pending: ItemProgress[];
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pct = (n: number) => Math.round(clamp01(n) * 1000) / 10;

const STATUS_RATIO: Record<string, number> = {
  DONE: 1,
  PARTIAL: 0.5,
  SKIPPED: 0,
};

function latest(checkIns: CheckIn[]): CheckIn | null {
  if (!checkIns.length) return null;
  return [...checkIns].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
}

function progressFor(item: PlanItem & { checkIns: CheckIn[] }): ItemProgress {
  // Water accumulates: every glass logged counts toward the item's target.
  if (item.type === "WATER") {
    const loggedQty = item.checkIns.reduce((sum, c) => sum + (c.actualQty ?? 0), 0);
    const target = item.targetQty ?? 0;
    const ratio = target > 0 ? clamp01(loggedQty / target) : loggedQty > 0 ? 1 : 0;
    return {
      item,
      ratio,
      status:
        item.checkIns.length === 0
          ? "PENDING"
          : ratio >= 0.999
            ? "DONE"
            : ratio > 0
              ? "PARTIAL"
              : "SKIPPED",
      loggedQty,
      note: latest(item.checkIns)?.note ?? null,
      checkInCount: item.checkIns.length,
    };
  }

  // Meals and exercise: the most recent check-in is the source of truth.
  const last = latest(item.checkIns);
  if (!last) {
    return {
      item,
      ratio: 0,
      status: "PENDING",
      loggedQty: null,
      note: null,
      checkInCount: 0,
    };
  }

  let ratio = STATUS_RATIO[last.status] ?? 0;
  // A logged quantity is more precise than the coarse status bucket.
  if (last.status !== "SKIPPED" && last.actualQty != null && (item.targetQty ?? 0) > 0) {
    ratio = clamp01(last.actualQty / (item.targetQty as number));
  }

  return {
    item,
    ratio,
    status: last.status as ItemProgress["status"],
    loggedQty: last.actualQty ?? null,
    note: last.note ?? null,
    checkInCount: item.checkIns.length,
  };
}

function streamPct(list: ItemProgress[]): number {
  if (!list.length) return 0;
  return pct(list.reduce((s, p) => s + p.ratio, 0) / list.length);
}

/** Adherence computed purely from recorded check-ins — no model involved. */
export function computeAdherence(plan: PlanWithItems): Adherence {
  const progress = plan.items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(progressFor);

  const meals = progress.filter((p) => p.item.type === "MEAL");
  const waters = progress.filter((p) => p.item.type === "WATER");
  const exercises = progress.filter((p) => p.item.type === "EXERCISE");

  const mealPct = streamPct(meals);
  const waterPct = streamPct(waters);
  const exercisePct = streamPct(exercises);

  // Only weight the streams the plan actually contains, then renormalise.
  const parts: [number, number][] = [];
  if (meals.length) parts.push([mealPct, ADHERENCE_WEIGHTS.meal]);
  if (waters.length) parts.push([waterPct, ADHERENCE_WEIGHTS.water]);
  if (exercises.length) parts.push([exercisePct, ADHERENCE_WEIGHTS.exercise]);
  const weightSum = parts.reduce((s, [, w]) => s + w, 0);
  const overallPct = weightSum
    ? Math.round((parts.reduce((s, [v, w]) => s + v * w, 0) / weightSum) * 10) / 10
    : 0;

  const waterMl = Math.round(waters.reduce((s, p) => s + (p.loggedQty ?? 0), 0));
  const waterTargetMl = Math.round(
    waters.reduce((s, p) => s + (p.item.targetQty ?? 0), 0),
  );

  const caloriesConsumed = Math.round(
    meals.reduce((s, p) => s + (p.item.calories ?? 0) * p.ratio, 0),
  );
  const proteinConsumedG = Math.round(
    meals.reduce((s, p) => s + (p.item.proteinG ?? 0) * p.ratio, 0),
  );

  return {
    overallPct,
    mealPct,
    waterPct,
    exercisePct,
    waterMl,
    waterTargetMl,
    caloriesConsumed,
    calorieTarget: plan.calorieTarget,
    proteinConsumedG,
    itemsTotal: progress.length,
    itemsCompleted: progress.filter((p) => p.status === "DONE").length,
    itemsPending: progress.filter((p) => p.status === "PENDING").length,
    progress,
    completed: progress.filter((p) => p.status === "DONE"),
    partial: progress.filter((p) => p.status === "PARTIAL"),
    missed: progress.filter((p) => p.status === "SKIPPED"),
    pending: progress.filter((p) => p.status === "PENDING"),
  };
}

/** Compact, model-friendly rendering of what actually happened. */
export function describeAdherence(a: Adherence): string {
  const line = (p: ItemProgress) => {
    const bits = [`${p.item.type}`, `"${p.item.title}"`, `at ${p.item.scheduledTime}`];
    if (p.item.type === "WATER") {
      bits.push(`logged ${Math.round(p.loggedQty ?? 0)}/${p.item.targetQty ?? 0}ml`);
    } else {
      bits.push(p.status.toLowerCase());
      if (p.loggedQty != null && p.item.targetQty)
        bits.push(`(${p.loggedQty}/${p.item.targetQty}${p.item.unit ?? ""})`);
    }
    if (p.note) bits.push(`— user note: "${p.note}"`);
    return `- ${bits.join(" ")}`;
  };

  return [
    `Overall adherence: ${a.overallPct}% (meals ${a.mealPct}%, hydration ${a.waterPct}%, movement ${a.exercisePct}%)`,
    `Hydration: ${a.waterMl}ml of ${a.waterTargetMl}ml target`,
    `Estimated intake from completed meals: ${a.caloriesConsumed} kcal, ${a.proteinConsumedG}g protein${
      a.calorieTarget ? ` (target ${a.calorieTarget} kcal)` : ""
    }`,
    `Items: ${a.itemsCompleted} done, ${a.partial.length} partial, ${a.missed.length} skipped, ${a.pending.length} never logged, of ${a.itemsTotal} total`,
    "",
    "Item-by-item record:",
    ...a.progress.map(line),
  ].join("\n");
}
