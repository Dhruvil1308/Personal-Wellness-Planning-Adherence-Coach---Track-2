import { prependSilence } from "@/lib/voice/wav";

/**
 * Sarvam AI voice services.
 *  - Bulbul v3 for Gujarati text-to-speech, synthesised straight to 8 kHz mono
 *    WAV, which is the native telephony format (no transcoding in the path).
 *  - Saaras v3 for speech-to-text, used only when response capture is enabled.
 */

const TTS_URL = "https://api.sarvam.ai/text-to-speech";
const STT_URL = "https://api.sarvam.ai/speech-to-text";

/** Telephony audio is 8 kHz mono; anything else gets resampled by the carrier. */
export const TELEPHONY_SAMPLE_RATE = 8000;

/** Seconds of silence prepended so the agent starts speaking after the pickup settles. */
export const LEAD_SILENCE_SECONDS = Number(
  process.env.REMINDER_LEAD_SILENCE_SECONDS ?? 2,
);

export class SarvamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SarvamError";
  }
}

function apiKey(): string {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new SarvamError("SARVAM_API_KEY is not configured");
  return key;
}

/** Bulbul v3 caps a single request at 2500 characters. */
const MAX_TTS_CHARS = 2400;

export type SynthesisResult = {
  wav: Buffer;
  /** Seconds of silence actually prepended. */
  leadSilence: number;
};

/**
 * Synthesises `text` and returns a telephony-ready WAV whose first
 * `LEAD_SILENCE_SECONDS` are silence — see `wav.ts` for why the pause lives in
 * the audio rather than in the call flow.
 */
export async function synthesizeSpeech(opts: {
  text: string;
  languageCode?: string;
  speaker?: string;
  pace?: number;
  leadSilenceSeconds?: number;
}): Promise<SynthesisResult> {
  const text = opts.text.trim().slice(0, MAX_TTS_CHARS);
  if (!text) throw new SarvamError("Nothing to synthesise");

  const lead = opts.leadSilenceSeconds ?? LEAD_SILENCE_SECONDS;

  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      language_code: opts.languageCode ?? "gu-IN",
      // Sarvam expects the speaker name lowercased.
      speaker: (opts.speaker ?? process.env.SARVAM_TTS_SPEAKER ?? "priya").toLowerCase(),
      model: process.env.SARVAM_TTS_MODEL ?? "bulbul:v3",
      // Slightly under normal pace: a reminder heard once on a phone line has to
      // land the first time.
      pace: opts.pace ?? Number(process.env.SARVAM_TTS_PACE ?? 0.95),
      speech_sample_rate: TELEPHONY_SAMPLE_RATE,
    }),
  });

  if (!res.ok) {
    throw new SarvamError(
      `Sarvam TTS failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      res.status,
    );
  }

  const json = (await res.json()) as { audios?: string[] };
  const b64 = json.audios?.[0];
  if (!b64) throw new SarvamError("Sarvam TTS returned no audio");

  return { wav: prependSilence(Buffer.from(b64, "base64"), lead), leadSilence: lead };
}

export type TranscriptionResult = {
  transcript: string;
  languageCode?: string;
};

/**
 * Saaras v3 transcription. `mode: "transcribe"` keeps the reply in the spoken
 * language; `"translate"` returns English.
 */
export async function transcribeAudio(opts: {
  audio: Buffer;
  filename?: string;
  contentType?: string;
  mode?: "transcribe" | "translate";
  languageCode?: string;
}): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(opts.audio)], { type: opts.contentType ?? "audio/wav" }),
    opts.filename ?? "response.wav",
  );
  form.append("model", process.env.SARVAM_STT_MODEL ?? "saaras:v3");
  form.append("mode", opts.mode ?? "transcribe");
  if (opts.languageCode) form.append("language_code", opts.languageCode);

  const res = await fetch(STT_URL, {
    method: "POST",
    headers: { "api-subscription-key": apiKey() },
    body: form,
  });

  if (!res.ok) {
    throw new SarvamError(
      `Sarvam STT failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      res.status,
    );
  }

  const json = (await res.json()) as {
    transcript?: string;
    language_code?: string;
  };
  return { transcript: json.transcript ?? "", languageCode: json.language_code };
}
