import { z } from "zod";
import { fail, handleError, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { ensurePlan, getPlan } from "@/lib/services/plans";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import { isValidDayKey, today } from "@/lib/date";

const generateSchema = z.object({
  date: z.string().refine(isValidDayKey, "date must be YYYY-MM-DD").optional(),
  force: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("No profile yet", 404);

    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? today();
    if (!isValidDayKey(date)) return fail("Invalid date", 422);

    const plan = await getPlan(user.id, date);
    if (!plan) return ok({ plan: null, adherence: null, date });

    return ok({
      date,
      plan,
      adherence: computeAdherence(plan as PlanWithItems),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Generates the plan for a day. `force: true` regenerates and clears check-ins. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Create a profile first", 404);

    const body = generateSchema.parse(
      await req.json().catch(() => ({}) as Record<string, unknown>),
    );
    const date = body.date ?? today();

    const result = await ensurePlan(user, date, { force: body.force });

    return ok({
      date,
      plan: result.plan,
      created: result.created,
      generatedBy: result.generatedBy,
      fallbackReason: result.fallbackReason,
      adherence: computeAdherence(result.plan as PlanWithItems),
    });
  } catch (err) {
    return handleError(err);
  }
}
