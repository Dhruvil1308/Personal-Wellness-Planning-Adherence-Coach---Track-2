import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Reminder audio lives outside `public/` so Next does not have to be restarted
 * for a new file to be served, and so nothing is exposed without going through
 * the /api/voice/audio route.
 */
const AUDIO_DIR = path.join(process.cwd(), ".reminder-audio");

function safeName(id: string) {
  // Ids are cuids, but this route is reachable from the public internet.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid audio id");
  return `${id}.wav`;
}

export async function saveReminderAudio(id: string, wav: Buffer): Promise<string> {
  await mkdir(AUDIO_DIR, { recursive: true });
  const file = path.join(AUDIO_DIR, safeName(id));
  await writeFile(file, wav);
  return file;
}

export async function readReminderAudio(id: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(AUDIO_DIR, safeName(id)));
  } catch {
    return null;
  }
}

export async function deleteReminderAudio(id: string): Promise<void> {
  try {
    await unlink(path.join(AUDIO_DIR, safeName(id)));
  } catch {
    // already gone
  }
}
