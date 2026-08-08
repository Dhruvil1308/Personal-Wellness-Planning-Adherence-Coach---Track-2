import { prisma } from "@/lib/db";
import { hangupXml, reminderXml, XML_CONTENT_TYPE } from "@/lib/voice/vobiz";
import { callbackOrigin, REMINDER_CONFIG, TELEPHONY_PATHS } from "@/lib/voice/config";
import { readReminderAudio } from "@/lib/voice/audio";
import { pick, readCallbackParams } from "@/lib/voice/callback";
import { rememberCallIdentifiers, resolveReminder } from "@/lib/voice/resolve";

export const dynamic = "force-dynamic";

/**
 * The Answer URL configured on the Vobiz application. Vobiz hits it the moment
 * the call is answered and plays back whatever XML it returns.
 *
 * The audio already exists (the dispatcher renders it before dialling) and its
 * first two seconds are silence, so the agent starts speaking two seconds after
 * pickup. `<Hangup/>` ends the call once the line finishes.
 *
 * Every failure path still returns valid XML — a malformed response would leave
 * the caller on dead air until the carrier timed the call out.
 */
async function respond(req: Request) {
  try {
    const params = await readCallbackParams(req);
    const reminder = await resolveReminder(req, params);

    if (!reminder) {
      console.error(
        `[voice] answer: could not match a reminder (CallUUID=${pick(params, "CallUUID") ?? "?"}, To=${pick(params, "To") ?? "?"})`,
      );
      return xml(hangupXml());
    }

    if (!(await readReminderAudio(reminder.id))) {
      console.error(`[voice] answer ${reminder.id}: audio missing — hanging up`);
      return xml(hangupXml());
    }

    await rememberCallIdentifiers(reminder.id, params);
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: "ANSWERED", answeredAt: new Date() },
    });

    // Built from the origin the carrier used to reach us, so the audio URL is
    // reachable by construction even if NGROK_DOMAIN drifts.
    const origin = callbackOrigin(req);
    console.log(`[voice] answer ${reminder.id}: playing reminder via ${origin}`);

    return xml(
      reminderXml({
        audioUrl: `${origin}${TELEPHONY_PATHS.audio}/${reminder.id}`,
        recordAction: REMINDER_CONFIG.captureResponse
          ? `${origin}${TELEPHONY_PATHS.recording}?rid=${reminder.id}`
          : undefined,
      }),
    );
  } catch (err) {
    console.error("[voice] answer failed:", err);
    return xml(hangupXml());
  }
}

function xml(body: string) {
  return new Response(body, { headers: { "Content-Type": XML_CONTENT_TYPE } });
}

export async function POST(req: Request) {
  return respond(req);
}

// Vobiz can be configured to GET the answer URL; support both.
export async function GET(req: Request) {
  return respond(req);
}
