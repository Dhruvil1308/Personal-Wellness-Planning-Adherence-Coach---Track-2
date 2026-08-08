import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { buildDailySummary } from "@/lib/services/plans";
import { isValidDayKey, today } from "@/lib/date";

const bodySchema = z.object({
  date: z.string().refine(isValidDayKey).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Create a profile first", 404);

    const date = new URL(req.url).searchParams.get("date") ?? today();
    if (!isValidDayKey(date)) return fail("Invalid date", 422);

    const summary = await prisma.dailySummary.findFirst({
      where: { userId: user.id, date },
    });
    return ok({ summary });
  } catch (err) {
    return handleError(err);
  }
}

/** Builds the end-of-day summary from the recorded check-ins for that day. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Create a profile first", 404);

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const date = body.date ?? today();

    const result = await buildDailySummary(user, date);
    if (!result) return fail("No plan exists for that day", 404);

    return ok({
      summary: result.summary,
      adherence: result.adherence,
      generatedBy: result.generatedBy,
    });
  } catch (err) {
    return handleError(err);
  }
}
