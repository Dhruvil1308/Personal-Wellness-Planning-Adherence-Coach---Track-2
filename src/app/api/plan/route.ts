import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { ensurePlan, getPlan } from "@/lib/services/plans";
import { getGateStatus, PlanLockedError } from "@/lib/services/planGate";
import { syncRemindersForDay } from "@/lib/services/reminders";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { isValidDayKey, today } from "@/lib/date";

const generateSchema = z.object({
  date: z.string().refine(isValidDayKey, "date must be YYYY-MM-DD").optional(),
  force: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();

    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? today();
    if (!isValidDayKey(date)) return fail("Invalid date", 422);

    const plan = await getPlan(user.id, date);
    const gate = await getGateStatus(user.id, date);
    if (!plan) return ok({ plan: null, adherence: null, date, gate });

    return ok({
      date,
      plan,
      gate,
      adherence: computeAdherence(plan as PlanWithItems),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Generates the plan for a day. `force: true` regenerates and clears check-ins. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = generateSchema.parse(
      await req.json().catch(() => ({}) as Record<string, unknown>),
    );
    const date = body.date ?? today();

    let result;
    try {
      result = await ensurePlan(user, date, { force: body.force });
    } catch (err) {
      // 423 Locked: the previous day did not clear the adherence threshold.
      if (err instanceof PlanLockedError) {
        return NextResponse.json(
          { error: err.gate.message, locked: true, gate: err.gate },
          { status: 423 },
        );
      }
      throw err;
    }

    // A new plan means new times, so the reminder calls follow it. Failing to
    // schedule a call must never fail the plan request.
    let reminderSync: Awaited<ReturnType<typeof syncRemindersForDay>> | null = null;
    if (result.created && user.phone) {
      reminderSync = await syncRemindersForDay(user, date).catch((err) => {
        console.error("[reminders] sync after plan generation failed:", err);
        return null;
      });
    }

    return ok({
      date,
      plan: result.plan,
      created: result.created,
      generatedBy: result.generatedBy,
      gate: result.gate ?? (await getGateStatus(user.id, date)),
      fallbackReason: result.fallbackReason,
      adherence: computeAdherence(result.plan as PlanWithItems),
      reminders: reminderSync
        ? { created: reminderSync.created, updated: reminderSync.updated, removed: reminderSync.removed }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
