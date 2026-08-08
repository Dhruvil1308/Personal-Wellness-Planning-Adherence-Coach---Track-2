import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import {
  cancelReminder,
  dispatchReminder,
  previewReminder,
  rescheduleReminder,
} from "@/lib/services/reminders";

const actionSchema = z.object({
  action: z.enum(["call-now", "cancel", "reschedule", "preview"]),
});

/** Per-reminder actions: place the call now, cancel it, or put it back. */
export async function POST(req: Request, ctx: RouteContext<"/api/reminders/[id]">) {
  try {
    const user = await requireUser();

    const { id } = await ctx.params;
    const { action } = actionSchema.parse(await req.json());

    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder || reminder.userId !== user.id) return fail("Reminder not found", 404);

    if (action === "cancel") {
      return ok({ reminder: await cancelReminder(user.id, id) });
    }

    if (action === "reschedule") {
      return ok({ reminder: await rescheduleReminder(user.id, id) });
    }

    // Renders the Gujarati line and its audio without dialling, so the voice can
    // be heard in the browser before any call is placed (and with no tunnel).
    if (action === "preview") {
      const preview = await previewReminder(id);
      if (!preview) return fail("Could not build the preview", 502);
      return ok({ ...preview, audioUrl: `/api/voice/audio/${id}` });
    }

    // call-now bypasses the schedule and the already-checked-in skip.
    const outcome = await dispatchReminder(id, { force: true });
    const updated = await prisma.reminder.findUnique({ where: { id } });

    if (outcome.status === "FAILED") return fail(outcome.detail, 502, { reminder: updated });

    return ok({ outcome, reminder: updated });
  } catch (err) {
    return handleError(err);
  }
}
