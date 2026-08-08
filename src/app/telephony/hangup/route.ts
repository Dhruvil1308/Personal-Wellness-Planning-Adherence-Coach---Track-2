import { prisma } from "@/lib/db";
import { pick, readCallbackParams } from "@/lib/voice/callback";
import { deleteReminderAudio } from "@/lib/voice/audio";
import { resolveReminder } from "@/lib/voice/resolve";

export const dynamic = "force-dynamic";

/**
 * The Hangup URL configured on the Vobiz application — the final state of the
 * call. Answered and played through is COMPLETED; anything else (no answer,
 * busy, rejected) is recorded with the carrier's own hangup cause so the UI can
 * say why rather than just "failed".
 */
export async function POST(req: Request) {
  try {
    const params = await readCallbackParams(req);
    const reminder = await resolveReminder(req, params);
    if (!reminder) return new Response(null, { status: 204 });

    const callStatus = (pick(params, "CallStatus", "call_status") ?? "").toLowerCase();
    const hangupCause = pick(params, "HangupCauseName", "hangup_cause_name", "HangupCause");
    const durationRaw = pick(params, "Duration", "CallDuration", "call_duration", "BillDuration");
    const answerTime = pick(params, "AnswerTime", "answer_time");

    const answered = Boolean(answerTime) || reminder.status === "ANSWERED";
    const completed = answered && (callStatus === "completed" || callStatus === "");

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: completed ? "COMPLETED" : "FAILED",
        completedAt: new Date(),
        durationSec: durationRaw ? Math.round(Number(durationRaw)) || null : null,
        callUuid: pick(params, "CallUUID", "call_uuid") ?? reminder.callUuid,
        failureReason: completed
          ? null
          : (hangupCause ?? callStatus ?? "Call did not connect").slice(0, 200),
      },
    });

    // The spoken line is kept on the row; the audio file has served its purpose.
    await deleteReminderAudio(reminder.id);

    console.log(
      `[voice] hangup ${reminder.id}: ${completed ? "COMPLETED" : "FAILED"}${hangupCause ? ` (${hangupCause})` : ""}`,
    );
  } catch (err) {
    console.error("[voice] hangup failed:", err);
  }

  return new Response(null, { status: 204 });
}

export async function GET(req: Request) {
  return POST(req);
}
