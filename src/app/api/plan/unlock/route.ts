import { z } from "zod";
import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { getGateStatus, listUnlocks, unlockDay } from "@/lib/services/planGate";
import { isValidDayKey, today } from "@/lib/date";

const bodySchema = z.object({
  date: z.string().refine(isValidDayKey, "date must be YYYY-MM-DD").optional(),
  reason: z.string().trim().max(300).default(""),
});

/** The audit trail of every gate override on this account. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const date = new URL(req.url).searchParams.get("date");
    if (date && !isValidDayKey(date)) return fail("Invalid date", 422);

    return ok({
      unlocks: await listUnlocks(user.id),
      gate: date ? await getGateStatus(user.id, date) : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Manually opens the gate for one day.
 *
 * The gate is deliberately strict, and strictness without a release is a
 * deadlock — a locked day has no plan, so its score can never rise. This is the
 * documented way out, and every use is recorded with the score that was missed.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const date = body.date ?? today();

    const { gate, created } = await unlockDay(user.id, date, body.reason);
    return ok({ date, gate, created });
  } catch (err) {
    return handleError(err);
  }
}
