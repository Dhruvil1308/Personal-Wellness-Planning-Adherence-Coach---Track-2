import { prisma } from "@/lib/db";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { generatePlan, type PriorDay } from "@/lib/ai/planner";
import { generateSummary } from "@/lib/ai/summarizer";
import { yesterdayOf } from "@/lib/date";
import type { User } from "@/generated/prisma/client";

const withItems = {
  items: {
    include: { checkIns: true },
    orderBy: { sortOrder: "asc" },
  },
} as const;

export async function getPlan(userId: string, date: string) {
  return prisma.plan.findUnique({
    where: { userId_date: { userId, date } },
    include: { ...withItems, summary: true, feedback: true },
  });
}

/**
 * The last `limit` days that have a plan, most recent first, each with its
 * computed adherence, feedback and summary. This is the evidence the planner
 * reasons over.
 */
export async function loadPriorDays(
  userId: string,
  beforeDate: string,
  limit = 3,
): Promise<PriorDay[]> {
  const plans = await prisma.plan.findMany({
    where: { userId, date: { lt: beforeDate } },
    orderBy: { date: "desc" },
    take: limit,
    include: { ...withItems, feedback: true, summary: true },
  });

  return plans.map((plan) => ({
    date: plan.date,
    focus: plan.focus,
    adherence: computeAdherence(plan as PlanWithItems),
    feedback: plan.feedback,
    summaryText: plan.summary?.summaryText ?? null,
  }));
}

export type EnsurePlanResult = {
  plan: NonNullable<Awaited<ReturnType<typeof getPlan>>>;
  created: boolean;
  generatedBy: "ai" | "fallback";
  fallbackReason?: string;
};

/** Creates the plan for `date` if it does not exist. `force` regenerates it. */
export async function ensurePlan(
  user: User,
  date: string,
  opts: { force?: boolean } = {},
): Promise<EnsurePlanResult> {
  const existing = await getPlan(user.id, date);
  if (existing && !opts.force) {
    return {
      plan: existing,
      created: false,
      generatedBy: existing.generatedBy as "ai" | "fallback",
    };
  }

  const prior = await loadPriorDays(user.id, date, 3);
  const { plan: ai, generatedBy, fallbackReason } = await generatePlan({
    user,
    date,
    prior,
  });

  // Replacing a plan drops its items and their check-ins by cascade, which is
  // the intended behaviour for an explicit regenerate.
  if (existing) await prisma.plan.delete({ where: { id: existing.id } });

  await prisma.plan.create({
    data: {
      userId: user.id,
      date,
      rationale: ai.rationale,
      adjustmentNote: ai.adjustmentNote ?? null,
      coachMessage: ai.coachMessage,
      hydrationTargetMl: ai.hydrationTargetMl,
      calorieTarget: ai.calorieTarget ?? null,
      proteinTargetG: ai.proteinTargetG ?? null,
      focus: ai.focus,
      generatedBy,
      items: {
        create: ai.items.map((it, i) => ({
          type: it.type,
          slot: it.slot ?? null,
          title: it.title,
          details: it.details ?? "",
          scheduledTime: it.scheduledTime,
          targetQty: it.targetQty ?? null,
          unit: it.unit ?? null,
          calories: it.calories ?? null,
          proteinG: it.proteinG ?? null,
          why: it.why ?? "",
          sortOrder: i,
        })),
      },
    },
  });

  const plan = await getPlan(user.id, date);
  return { plan: plan!, created: true, generatedBy, fallbackReason };
}

/** Builds (or rebuilds) the end-of-day summary from recorded check-ins. */
export async function buildDailySummary(user: User, date: string) {
  const plan = await getPlan(user.id, date);
  if (!plan) return null;

  const adherence = computeAdherence(plan as PlanWithItems);
  const { summary, generatedBy } = await generateSummary({
    user,
    date,
    adherence,
    feedback: plan.feedback,
    focus: plan.focus,
  });

  const data = {
    userId: user.id,
    planId: plan.id,
    date,
    adherencePct: adherence.overallPct,
    mealPct: adherence.mealPct,
    waterPct: adherence.waterPct,
    exercisePct: adherence.exercisePct,
    waterMl: adherence.waterMl,
    caloriesConsumed: adherence.caloriesConsumed,
    itemsCompleted: adherence.itemsCompleted,
    itemsTotal: adherence.itemsTotal,
    summaryText: summary.summaryText,
    wins: JSON.stringify(summary.wins),
    gaps: JSON.stringify(summary.gaps),
    focusTomorrow: summary.focusTomorrow,
  };

  const saved = await prisma.dailySummary.upsert({
    where: { planId: plan.id },
    create: data,
    update: data,
  });

  return { summary: saved, adherence, generatedBy };
}

/** Convenience for "what does tomorrow look like" — used by the adjust demo. */
export async function nextPlanFor(user: User, date: string) {
  return ensurePlan(user, date, { force: true });
}

export function previousDayOf(date: string) {
  return yesterdayOf(date);
}
