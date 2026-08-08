import { prisma } from "@/lib/db";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { lastNDays, prettyDay } from "@/lib/date";

export type TrendPoint = {
  date: string;
  label: string;
  hasPlan: boolean;
  overallPct: number;
  mealPct: number;
  waterPct: number;
  exercisePct: number;
  waterMl: number;
  waterTargetMl: number;
  caloriesConsumed: number;
  calorieTarget: number | null;
  itemsCompleted: number;
  itemsTotal: number;
};

export type StreamBreakdown = {
  meal: number;
  water: number;
  exercise: number;
};

export type Insights = {
  trend: TrendPoint[];
  daysWithPlan: number;
  averageAdherence: number;
  streamAverages: StreamBreakdown;
  currentStreak: number;
  bestDay: TrendPoint | null;
  /** Items that were skipped or never logged, ranked by how often. */
  troubleSpots: { title: string; type: string; time: string; misses: number }[];
};

export async function getInsights(
  userId: string,
  endDate: string,
  days = 14,
): Promise<Insights> {
  const dates = lastNDays(endDate, days);

  const plans = await prisma.plan.findMany({
    where: { userId, date: { in: dates } },
    include: { items: { include: { checkIns: true }, orderBy: { sortOrder: "asc" } } },
  });
  const byDate = new Map(plans.map((p) => [p.date, p]));

  const trend: TrendPoint[] = dates.map((date) => {
    const plan = byDate.get(date);
    if (!plan) {
      return {
        date,
        label: prettyDay(date),
        hasPlan: false,
        overallPct: 0,
        mealPct: 0,
        waterPct: 0,
        exercisePct: 0,
        waterMl: 0,
        waterTargetMl: 0,
        caloriesConsumed: 0,
        calorieTarget: null,
        itemsCompleted: 0,
        itemsTotal: 0,
      };
    }
    const a = computeAdherence(plan as PlanWithItems);
    return {
      date,
      label: prettyDay(date),
      hasPlan: true,
      overallPct: a.overallPct,
      mealPct: a.mealPct,
      waterPct: a.waterPct,
      exercisePct: a.exercisePct,
      waterMl: a.waterMl,
      waterTargetMl: a.waterTargetMl,
      caloriesConsumed: a.caloriesConsumed,
      calorieTarget: a.calorieTarget,
      itemsCompleted: a.itemsCompleted,
      itemsTotal: a.itemsTotal,
    };
  });

  const active = trend.filter((t) => t.hasPlan);
  const avg = (pick: (t: TrendPoint) => number) =>
    active.length
      ? Math.round((active.reduce((s, t) => s + pick(t), 0) / active.length) * 10) / 10
      : 0;

  // A "kept" day is 70%+ adherence; the streak counts backwards from the end.
  let streak = 0;
  for (let i = trend.length - 1; i >= 0; i--) {
    if (!trend[i].hasPlan) break;
    if (trend[i].overallPct >= 70) streak++;
    else break;
  }

  const misses = new Map<string, { title: string; type: string; time: string; misses: number }>();
  for (const plan of plans) {
    const a = computeAdherence(plan as PlanWithItems);
    for (const p of [...a.missed, ...a.pending]) {
      const key = `${p.item.type}|${p.item.title}`;
      const row = misses.get(key) ?? {
        title: p.item.title,
        type: p.item.type,
        time: p.item.scheduledTime,
        misses: 0,
      };
      row.misses++;
      misses.set(key, row);
    }
  }

  return {
    trend,
    daysWithPlan: active.length,
    averageAdherence: avg((t) => t.overallPct),
    streamAverages: {
      meal: avg((t) => t.mealPct),
      water: avg((t) => t.waterPct),
      exercise: avg((t) => t.exercisePct),
    },
    currentStreak: streak,
    bestDay: active.length
      ? active.reduce((best, t) => (t.overallPct > best.overallPct ? t : best))
      : null,
    troubleSpots: [...misses.values()].sort((a, b) => b.misses - a.misses).slice(0, 5),
  };
}
