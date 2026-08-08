import { prisma } from "@/lib/db";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { prettyDay, today } from "@/lib/date";

/**
 * The adherence gate.
 *
 * RULE: the next day's plan cannot be generated until the most recent planned
 * day reaches PLAN_UNLOCK_THRESHOLD (default 70%). Below it, that day is locked.
 *
 * Why an override exists. Taken literally the rule deadlocks: a locked day has
 * no plan, a day with no plan has nothing to check in on, so adherence can never
 * climb back over the line and the account is bricked after one bad day. The
 * override in `PlanUnlock` is the only way out, and it is recorded — a judge or
 * a coach can see every time the gate was bypassed and what the score was.
 *
 * Gating is enforced in `ensurePlan`, not in the route, so every path that could
 * create a plan (API, scheduler, demo tooling) passes through it.
 */

export const PLAN_UNLOCK_THRESHOLD = (() => {
  const raw = Number(process.env.PLAN_UNLOCK_THRESHOLD ?? 70);
  if (!Number.isFinite(raw)) return 70;
  return Math.min(100, Math.max(0, raw));
})();

export type GateStatus = {
  /** Can a plan be generated for this date right now? */
  unlocked: boolean;
  thresholdPct: number;
  /** The day whose score decides the gate; null for a user's very first plan. */
  blockedByDate: string | null;
  blockedByLabel: string | null;
  achievedPct: number | null;
  shortfallPct: number | null;
  /** Set when the gate is open only because of an explicit override. */
  overridden: boolean;
  overrideReason?: string;
  /** Why it is open or closed, in one sentence fit for the UI. */
  message: string;
  reason:
    | "FIRST_PLAN"
    | "THRESHOLD_MET"
    | "OVERRIDDEN"
    | "PLAN_EXISTS"
    | "BELOW_THRESHOLD";
};

export class PlanLockedError extends Error {
  readonly status = 423;
  constructor(readonly gate: GateStatus) {
    super(gate.message);
    this.name = "PlanLockedError";
  }
}

/**
 * The gating day is the most recent day *before* `date` that actually has a
 * plan — not simply `date - 1`. Using the previous calendar day would let a
 * locked day be skipped over: wait a day, and the gate finds nothing to judge.
 */
async function gatingPlan(userId: string, date: string) {
  return prisma.plan.findFirst({
    where: { userId, date: { lt: date } },
    orderBy: { date: "desc" },
    include: { items: { include: { checkIns: true }, orderBy: { sortOrder: "asc" } } },
  });
}

export async function getGateStatus(
  userId: string,
  date: string,
): Promise<GateStatus> {
  const base = {
    thresholdPct: PLAN_UNLOCK_THRESHOLD,
    overridden: false,
  };

  // Today and the past are never locked: you must always be able to log the day
  // you are living in, and re-locking history would erase the record the gate
  // itself depends on.
  //
  // A FUTURE day is gated even when a plan row already exists. Without this, a
  // day generated ahead of time — before the previous day was finished — would
  // stay open forever and the rule could be skipped just by pre-generating.
  const existing = await prisma.plan.findUnique({
    where: { userId_date: { userId, date } },
    select: { id: true },
  });
  if (existing && date <= today()) {
    return {
      ...base,
      unlocked: true,
      blockedByDate: null,
      blockedByLabel: null,
      achievedPct: null,
      shortfallPct: null,
      reason: "PLAN_EXISTS",
      message: "This day already has a plan.",
    };
  }

  const previous = await gatingPlan(userId, date);
  if (!previous) {
    return {
      ...base,
      unlocked: true,
      blockedByDate: null,
      blockedByLabel: null,
      achievedPct: null,
      shortfallPct: null,
      reason: "FIRST_PLAN",
      message: "First plan — nothing to complete yet.",
    };
  }

  const achievedPct = computeAdherence(previous as PlanWithItems).overallPct;
  const shortfallPct = Math.round((PLAN_UNLOCK_THRESHOLD - achievedPct) * 10) / 10;
  const label = prettyDay(previous.date);

  if (achievedPct >= PLAN_UNLOCK_THRESHOLD) {
    return {
      ...base,
      unlocked: true,
      blockedByDate: previous.date,
      blockedByLabel: label,
      achievedPct,
      shortfallPct: 0,
      reason: "THRESHOLD_MET",
      message: `${label} finished at ${achievedPct}% — at or above the ${PLAN_UNLOCK_THRESHOLD}% required, so this day is unlocked.`,
    };
  }

  const override = await prisma.planUnlock.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (override) {
    return {
      ...base,
      unlocked: true,
      overridden: true,
      overrideReason: override.reason || undefined,
      blockedByDate: previous.date,
      blockedByLabel: label,
      achievedPct,
      shortfallPct,
      reason: "OVERRIDDEN",
      message: `${label} finished at ${achievedPct}%, below the ${PLAN_UNLOCK_THRESHOLD}% required. This day was unlocked manually.`,
    };
  }

  return {
    ...base,
    unlocked: false,
    blockedByDate: previous.date,
    blockedByLabel: label,
    achievedPct,
    shortfallPct,
    reason: "BELOW_THRESHOLD",
    message: `${label} finished at ${achievedPct}% of its plan. ${PLAN_UNLOCK_THRESHOLD}% is required before the next plan is generated — ${shortfallPct} percentage points short.`,
  };
}

/** Throws `PlanLockedError` unless the gate is open for `date`. */
export async function assertPlanUnlocked(userId: string, date: string) {
  const gate = await getGateStatus(userId, date);
  if (!gate.unlocked) throw new PlanLockedError(gate);
  return gate;
}

export async function unlockDay(userId: string, date: string, reason: string) {
  const gate = await getGateStatus(userId, date);
  if (gate.unlocked && gate.reason !== "OVERRIDDEN") return { gate, created: false };

  await prisma.planUnlock.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      blockedByDate: gate.blockedByDate ?? "",
      blockedByPct: gate.achievedPct ?? 0,
      thresholdPct: gate.thresholdPct,
      reason: reason.slice(0, 300),
    },
    update: { reason: reason.slice(0, 300) },
  });

  return { gate: await getGateStatus(userId, date), created: true };
}

export async function listUnlocks(userId: string) {
  return prisma.planUnlock.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 30,
  });
}
