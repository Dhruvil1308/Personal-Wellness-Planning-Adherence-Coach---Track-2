import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { screenUserText } from "@/lib/ai/guardrails";
import { isValidDayKey, today } from "@/lib/date";

const feedbackSchema = z.object({
  date: z.string().refine(isValidDayKey).optional(),
  energy: z.coerce.number().int().min(1).max(5),
  difficulty: z.coerce.number().int().min(1).max(5),
  hunger: z.coerce.number().int().min(1).max(5),
  mood: z.string().max(40).optional().nullable(),
  notes: z.string().max(600).default(""),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = feedbackSchema.parse(await req.json());
    const date = body.date ?? today();

    const plan = await prisma.plan.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    if (!plan) return fail("No plan exists for that day", 404);

    const screening = screenUserText(body.notes);
    if (screening.urgent) {
      return fail(screening.message!, 422, { guardrail: true, reasons: screening.reasons });
    }

    const data = {
      userId: user.id,
      planId: plan.id,
      date,
      energy: body.energy,
      difficulty: body.difficulty,
      hunger: body.hunger,
      mood: body.mood ?? null,
      notes: body.notes ?? "",
    };

    const feedback = await prisma.feedback.upsert({
      where: { planId: plan.id },
      create: data,
      update: data,
    });

    return ok({ feedback, notice: screening.flagged ? screening.message : undefined });
  } catch (err) {
    return handleError(err);
  }
}
