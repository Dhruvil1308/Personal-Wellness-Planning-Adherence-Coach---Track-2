import { prisma } from "@/lib/db";
import { pick, readCallbackParams } from "@/lib/voice/callback";
import { transcribeAudio } from "@/lib/voice/sarvam";
import { hangupXml, XML_CONTENT_TYPE } from "@/lib/voice/vobiz";
import { resolveReminder } from "@/lib/voice/resolve";

export const dynamic = "force-dynamic";

/**
 * Only reached when REMINDER_CAPTURE_RESPONSE=true. The default flow is
 * remind-then-hang-up; with capture on, the caller's short reply is fetched and
 * transcribed with Saaras, stored against the reminder, and attached to the plan
 * item as a check-in note the planner will read.
 */
export async function POST(req: Request) {
  // Answer with valid XML no matter what, so the call still ends cleanly.
  const xml = new Response(hangupXml(), { headers: { "Content-Type": XML_CONTENT_TYPE } });

  try {
    const params = await readCallbackParams(req);
    const reminder = await resolveReminder(req, params);
    const url = pick(params, "RecordUrl", "RecordingUrl", "record_url", "recording_url");
    if (!reminder || !url) return xml;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Recording fetch failed (${res.status})`);
    const audio = Buffer.from(await res.arrayBuffer());

    const { transcript } = await transcribeAudio({
      audio,
      contentType: res.headers.get("content-type") ?? "audio/wav",
      mode: "transcribe",
      languageCode: reminder.language ?? "gu-IN",
    });

    if (transcript.trim()) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { transcript: transcript.slice(0, 500) },
      });

      if (reminder.planItemId) {
        await prisma.checkIn.create({
          data: {
            planItemId: reminder.planItemId,
            status: "PARTIAL",
            note: `Said on the reminder call: "${transcript.slice(0, 200)}"`,
          },
        });
      }
    }
  } catch (err) {
    console.error("[voice] recording:", err instanceof Error ? err.message : err);
  }

  return xml;
}
