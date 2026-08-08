import { z } from "zod";
import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { createCustomReminder } from "@/lib/services/reminders";
import { checkVoiceReadiness } from "@/lib/voice/config";
import { screenUserText } from "@/lib/ai/guardrails";
import { ITEM_TYPES } from "@/lib/constants";
import { isValidDayKey, today } from "@/lib/date";

const customSchema = z.object({
  date: z.string().refine(isValidDayKey).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "time must be HH:MM"),
  kind: z.enum([...ITEM_TYPES, "CUSTOM"]),
  title: z.string().trim().min(1).max(80),
  note: z.string().trim().max(300).optional().default(""),
  repeat: z.enum(["ONCE", "DAILY"]).optional().default("ONCE"),
});

/** Schedules a call at a time the user picks, independent of the plan. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = customSchema.parse(await req.json());
    const date = body.date ?? today();

    if (!user.phone) {
      return fail("Add your mobile number before scheduling a call", 422);
    }

    // Whatever gets spoken on a call goes through the same wellness guardrail
    // as everything else the app says.
    const screening = screenUserText(body.title, body.note);
    if (screening.urgent) {
      return fail(screening.message!, 422, { guardrail: true, reasons: screening.reasons });
    }

    const reminder = await createCustomReminder(user, {
      date,
      time: body.time,
      kind: body.kind,
      title: body.title,
      note: body.note,
      repeat: body.repeat,
    });

    return ok(
      {
        reminder,
        readiness: checkVoiceReadiness(),
        notice: screening.flagged ? screening.message : undefined,
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
