import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { getCurrentUser, setSessionUserId } from "@/lib/session";
import { screenUserText } from "@/lib/ai/guardrails";
import { estimateTargets } from "@/lib/nutrition";
import {
  ACTIVITY_LEVELS,
  AGE_RANGES,
  CUISINES,
  DIET_PREFS,
  EQUIPMENT,
  GOALS,
} from "@/lib/constants";

const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((o) => o.value) as [string, ...string[]];

const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  ageRange: z.enum(AGE_RANGES as unknown as [string, ...string[]]),
  sex: z.enum(["female", "male", "other"]).optional().nullable(),
  heightCm: z.coerce.number().min(90).max(250),
  weightKg: z.coerce.number().min(25).max(300),
  goal: z.enum(values(GOALS)),
  activityLevel: z.enum(values(ACTIVITY_LEVELS)),
  dietaryPreference: z.enum(values(DIET_PREFS)),
  cuisine: z.enum(values(CUISINES)),
  allergies: z.string().max(300).default(""),
  dislikes: z.string().max(300).default(""),
  limitations: z.string().max(500).default(""),
  equipment: z.enum(values(EQUIPMENT)),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/),
  workoutWindowMin: z.coerce.number().int().min(10).max(180),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return ok({ user: null });
    return ok({ user, targets: estimateTargets(user) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = profileSchema.parse(await req.json());

    // Guardrail: a profile note describing an urgent or clinical situation is
    // not something a wellness planner should build around.
    const screening = screenUserText(body.limitations, body.allergies);
    if (screening.urgent) {
      return fail(screening.message!, 422, { guardrail: true, reasons: screening.reasons });
    }

    const existing = await getCurrentUser();
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: body })
      : await prisma.user.create({ data: body });

    await setSessionUserId(user.id);

    return ok({
      user,
      targets: estimateTargets(user),
      notice: screening.flagged ? screening.message : undefined,
    });
  } catch (err) {
    return handleError(err);
  }
}
