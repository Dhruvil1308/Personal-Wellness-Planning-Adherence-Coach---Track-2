import { readReminderAudio } from "@/lib/voice/audio";

export const dynamic = "force-dynamic";

/**
 * Serves the rendered reminder WAV to Vobiz. Public by necessity — the carrier
 * fetches it directly — so it exposes nothing but the audio for a known cuid.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/voice/audio/[id]">) {
  const { id } = await ctx.params;

  const wav = await readReminderAudio(id);
  if (!wav) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(wav), {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(wav.length),
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
    },
  });
}

export async function HEAD(_req: Request, ctx: RouteContext<"/api/voice/audio/[id]">) {
  const { id } = await ctx.params;
  const wav = await readReminderAudio(id);
  if (!wav) return new Response(null, { status: 404 });
  return new Response(null, {
    headers: { "Content-Type": "audio/wav", "Content-Length": String(wav.length) },
  });
}
