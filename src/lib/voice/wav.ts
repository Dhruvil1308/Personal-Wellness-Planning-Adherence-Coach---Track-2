/**
 * Minimal WAV utilities.
 *
 * Vobiz's XML verb set has no documented `Wait`, so the "answer, then pause two
 * seconds before speaking" behaviour is baked into the audio file itself: we
 * splice N seconds of PCM silence in front of the synthesised speech. That also
 * makes the pause exact rather than dependent on telephony timing.
 */

export type WavInfo = {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  pcm: Buffer;
};

export function parseWav(buf: Buffer): WavInfo {
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a RIFF/WAVE file");
  }

  let offset = 12;
  let fmt: Omit<WavInfo, "pcm"> | null = null;
  let pcm: Buffer | null = null;

  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const start = offset + 8;

    if (id === "fmt ") {
      fmt = {
        audioFormat: buf.readUInt16LE(start),
        channels: buf.readUInt16LE(start + 2),
        sampleRate: buf.readUInt32LE(start + 4),
        bitsPerSample: buf.readUInt16LE(start + 14),
      };
    } else if (id === "data") {
      pcm = buf.subarray(start, Math.min(start + size, buf.length));
    }

    // Chunks are word-aligned: an odd size is followed by a pad byte.
    offset = start + size + (size % 2);
  }

  if (!fmt || !pcm) throw new Error("WAV is missing a fmt or data chunk");
  return { ...fmt, pcm };
}

/** Rebuilds a canonical 44-byte-header WAV around the given PCM. */
export function buildWav(info: Omit<WavInfo, "pcm">, pcm: Buffer): Buffer {
  const byteRate = (info.sampleRate * info.channels * info.bitsPerSample) / 8;
  const blockAlign = (info.channels * info.bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(info.audioFormat, 20);
  header.writeUInt16LE(info.channels, 22);
  header.writeUInt32LE(info.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(info.bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export function silencePcm(info: Omit<WavInfo, "pcm">, seconds: number): Buffer {
  const bytes =
    Math.round(info.sampleRate * seconds) * info.channels * (info.bitsPerSample / 8);
  // 16-bit PCM silence is 0x0000; 8-bit unsigned PCM silence is 0x80.
  const fill = info.bitsPerSample === 8 ? 0x80 : 0x00;
  return Buffer.alloc(bytes, fill);
}

/** Returns a new WAV with `seconds` of leading silence. */
export function prependSilence(wav: Buffer, seconds: number): Buffer {
  if (seconds <= 0) return wav;
  const info = parseWav(wav);
  const { pcm, ...fmt } = info;
  return buildWav(fmt, Buffer.concat([silencePcm(fmt, seconds), pcm]));
}

export function durationSeconds(wav: Buffer): number {
  const info = parseWav(wav);
  const bytesPerSecond =
    (info.sampleRate * info.channels * info.bitsPerSample) / 8;
  return bytesPerSecond ? info.pcm.length / bytesPerSecond : 0;
}
