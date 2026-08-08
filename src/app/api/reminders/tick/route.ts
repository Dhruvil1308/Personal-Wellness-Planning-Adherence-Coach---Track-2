import { handleError, ok } from "@/lib/api";
import { runReminderTick } from "@/lib/services/reminders";
import { schedulerStatus } from "@/lib/voice/scheduler";
import { checkVoiceReadiness } from "@/lib/voice/config";

export const dynamic = "force-dynamic";

/**
 * The same pass the in-process scheduler runs, exposed so a real deployment can
 * drive reminders from an external cron (and so the flow can be tested by hand).
 */
export async function POST() {
  try {
    return ok({
      ...(await runReminderTick()),
      scheduler: schedulerStatus(),
      readiness: checkVoiceReadiness(),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function GET() {
  return ok({ scheduler: schedulerStatus(), readiness: checkVoiceReadiness() });
}
