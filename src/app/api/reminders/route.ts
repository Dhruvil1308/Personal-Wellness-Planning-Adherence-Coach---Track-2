import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { syncRemindersForDay } from "@/lib/services/reminders";
import { checkVoiceReadiness } from "@/lib/voice/config";
import { schedulerStatus } from "@/lib/voice/scheduler";
import { isDialable } from "@/lib/voice/vobiz";
import { isValidDayKey, today } from "@/lib/date";

const settingsSchema = z.object({
  date: z.string().refine(isValidDayKey).optional(),
  phone: z.string().trim().max(20).optional(),
  remindersEnabled: z.boolean().optional(),
  reminderLanguage: z.string().max(10).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();

    const date = new URL(req.url).searchParams.get("date") ?? today();
    if (!isValidDayKey(date)) return fail("Invalid date", 422);

    const reminders = await prisma.reminder.findMany({
      where: { userId: user.id, date },
      orderBy: { scheduledAt: "asc" },
      include: { item: { select: { title: true, type: true, scheduledTime: true, slot: true } } },
    });

    return ok({
      date,
      reminders,
      settings: {
        phone: user.phone,
        remindersEnabled: user.remindersEnabled,
        reminderLanguage: user.reminderLanguage,
      },
      readiness: checkVoiceReadiness(),
      scheduler: schedulerStatus(),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Saves the call settings and re-syncs the day's reminders to the plan. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = settingsSchema.parse(await req.json().catch(() => ({})));
    const date = body.date ?? today();

    if (body.phone !== undefined && body.phone !== "" && !isDialable(body.phone)) {
      return fail(
        "That does not look like a dialable number. Use +91XXXXXXXXXX or a 10-digit Indian mobile.",
        422,
      );
    }
    if (body.remindersEnabled && !(body.phone ?? user.phone)) {
      return fail("Add a phone number before switching reminder calls on", 422);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
        ...(body.remindersEnabled !== undefined
          ? { remindersEnabled: body.remindersEnabled }
          : {}),
        ...(body.reminderLanguage ? { reminderLanguage: body.reminderLanguage } : {}),
      },
    });

    const sync = await syncRemindersForDay(updated, date);

    return ok({
      date,
      settings: {
        phone: updated.phone,
        remindersEnabled: updated.remindersEnabled,
        reminderLanguage: updated.reminderLanguage,
      },
      sync: { created: sync.created, updated: sync.updated, removed: sync.removed },
      reminders: sync.reminders,
      readiness: checkVoiceReadiness(),
    });
  } catch (err) {
    return handleError(err);
  }
}
