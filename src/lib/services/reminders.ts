import { prisma } from "@/lib/db";
import { getPlan } from "@/lib/services/plans";
import { computeAdherence, type PlanWithItems } from "@/lib/adherence";
import {
  checkVoiceReadiness,
  REMINDER_CONFIG,
  TELEPHONY_PATHS,
  voiceUrl,
} from "@/lib/voice/config";
import { buildReminderScript } from "@/lib/voice/script";
import { synthesizeSpeech } from "@/lib/voice/sarvam";
import { saveReminderAudio, deleteReminderAudio } from "@/lib/voice/audio";
import { isDialable, makeCall, toDialFormat } from "@/lib/voice/vobiz";
import { shiftDay } from "@/lib/date";
import type { Reminder, User } from "@/generated/prisma/client";

/**
 * Reminder lifecycle:
 *   sync()      — mirror a day's plan items into SCHEDULED reminder rows
 *   dispatch()  — at the scheduled minute: write the Gujarati line, render the
 *                 audio, then place the call. Audio is always ready before the
 *                 call fires, so the answer webhook never has to wait.
 *   webhooks    — ring / hangup / recording move the row to its final state
 */

/**
 * Scheduled times are wall-clock ("13:00") and are resolved against the
 * server's local timezone — run the server in the user's timezone (IST here).
 */
function instantFor(date: string, time: string, leadMinutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (leadMinutes) dt.setMinutes(dt.getMinutes() - leadMinutes);
  return dt;
}

export type SyncResult = {
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  reminders: Reminder[];
};

/**
 * Makes the reminder rows for `date` match the plan. Items are matched by
 * planItemId, so regenerating a plan replaces its reminders and a rescheduled
 * item moves its call. Rows already dialled are left alone.
 */
export async function syncRemindersForDay(user: User, date: string): Promise<SyncResult> {
  const plan = await getPlan(user.id, date);
  if (!plan) return { created: 0, updated: 0, removed: 0, skipped: 0, reminders: [] };

  const existing = await prisma.reminder.findMany({ where: { userId: user.id, date } });
  const byItem = new Map(existing.map((r) => [r.planItemId, r]));

  const phone = user.phone ?? "";
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const terminal = new Set(["COMPLETED", "FAILED", "ANSWERED", "RINGING", "DISPATCHING"]);

  for (const item of plan.items) {
    const scheduledAt = instantFor(date, item.scheduledTime, REMINDER_CONFIG.leadMinutes);
    const current = byItem.get(item.id);

    if (current) {
      byItem.delete(item.id);
      // Never rewrite a call that has already gone out.
      if (terminal.has(current.status)) {
        skipped++;
        continue;
      }
      if (
        current.scheduledAt.getTime() !== scheduledAt.getTime() ||
        current.toNumber !== phone ||
        current.kind !== item.type ||
        current.language !== user.reminderLanguage
      ) {
        await prisma.reminder.update({
          where: { id: current.id },
          data: {
            scheduledAt,
            toNumber: phone,
            kind: item.type,
            language: user.reminderLanguage,
            // The rendered line is stale once the item moved.
            script: "",
            audioPath: null,
          },
        });
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    await prisma.reminder.create({
      data: {
        userId: user.id,
        planItemId: item.id,
        date,
        scheduledAt,
        kind: item.type,
        toNumber: phone,
        language: user.reminderLanguage,
        script: "",
        status: "SCHEDULED",
      },
    });
    created++;
  }

  // Anything left belongs to an item the plan no longer has. User-scheduled
  // calls have no planItemId and are never touched by a plan re-sync.
  const orphans = [...byItem.values()].filter(
    (r) => r.planItemId !== null && !terminal.has(r.status),
  );
  for (const orphan of orphans) await deleteReminderAudio(orphan.id);
  if (orphans.length) {
    await prisma.reminder.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  }

  const reminders = await prisma.reminder.findMany({
    where: { userId: user.id, date },
    orderBy: { scheduledAt: "asc" },
  });

  return { created, updated, removed: orphans.length, skipped, reminders };
}

/** Writes the spoken line and renders it to a telephony WAV. Places no call. */
async function renderReminderAudio(reminderId: string) {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { user: true, item: { include: { checkIns: true } } },
  });
  if (!reminder) return null;

  const loggedQty =
    reminder.item?.type === "WATER"
      ? reminder.item.checkIns.reduce((s, c) => s + (c.actualQty ?? 0), 0)
      : 0;

  // A user-scheduled call has no plan item, so its own title/note stand in.
  const item = reminder.item ?? {
    type: reminder.kind,
    title: reminder.title ?? "your wellness reminder",
    details: reminder.note ?? "",
    scheduledTime: reminder.scheduledAt.toTimeString().slice(0, 5),
    targetQty: null,
    unit: null,
    slot: null,
  };

  const script = await buildReminderScript({
    user: reminder.user,
    item: item as Parameters<typeof buildReminderScript>[0]["item"],
    loggedQty,
    custom: reminder.item
      ? undefined
      : { title: reminder.title ?? "your reminder", note: reminder.note },
  });

  const { wav, leadSilence } = await synthesizeSpeech({
    text: script.text,
    languageCode: reminder.language || "gu-IN",
  });
  const audioPath = await saveReminderAudio(reminder.id, wav);

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { script: script.text, scriptBy: script.generatedBy, audioPath },
  });

  return { reminder, script, leadSilence, bytes: wav.length };
}

/** Renders the line and audio for listening in the browser — never dials. */
export async function previewReminder(reminderId: string) {
  const rendered = await renderReminderAudio(reminderId);
  if (!rendered) return null;
  return {
    script: rendered.script.text,
    scriptBy: rendered.script.generatedBy,
    language: rendered.reminder.language,
    leadSilenceSeconds: rendered.leadSilence,
    bytes: rendered.bytes,
  };
}

/**
 * A call the user scheduled themselves, not derived from a plan item: any time,
 * any wording. `repeat: "DAILY"` re-arms the row for the next day once the call
 * completes, so "ring me at 09:00 every morning" needs setting up only once.
 */
export async function createCustomReminder(
  user: User,
  input: { date: string; time: string; kind: string; title: string; note?: string; repeat?: string },
): Promise<Reminder> {
  const scheduledAt = instantFor(input.date, input.time, 0);

  return prisma.reminder.create({
    data: {
      userId: user.id,
      planItemId: null,
      date: input.date,
      scheduledAt,
      kind: input.kind,
      title: input.title,
      note: input.note ?? null,
      repeat: input.repeat === "DAILY" ? "DAILY" : "ONCE",
      toNumber: user.phone ?? "",
      language: user.reminderLanguage,
      script: "",
      status: "SCHEDULED",
    },
  });
}

/** Arms tomorrow's copy of a DAILY reminder once today's has been placed. */
async function rollForwardDaily(reminder: Reminder) {
  if (reminder.repeat !== "DAILY" || reminder.planItemId) return;

  const nextDate = shiftDay(reminder.date, 1);
  const already = await prisma.reminder.findFirst({
    where: { userId: reminder.userId, date: nextDate, title: reminder.title, repeat: "DAILY" },
  });
  if (already) return;

  const next = new Date(reminder.scheduledAt);
  next.setDate(next.getDate() + 1);

  await prisma.reminder.create({
    data: {
      userId: reminder.userId,
      planItemId: null,
      date: nextDate,
      scheduledAt: next,
      kind: reminder.kind,
      title: reminder.title,
      note: reminder.note,
      repeat: "DAILY",
      toNumber: reminder.toNumber,
      language: reminder.language,
      script: "",
      status: "SCHEDULED",
    },
  });
}

export type DispatchOutcome = {
  reminderId: string;
  status: string;
  detail: string;
};

/**
 * Renders the audio and places one call. `force` bypasses the due-window and
 * already-checked-in checks so the UI can fire an immediate test call.
 */
export async function dispatchReminder(
  reminderId: string,
  opts: { force?: boolean } = {},
): Promise<DispatchOutcome> {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { user: true, item: { include: { checkIns: true, plan: true } } },
  });
  if (!reminder) return { reminderId, status: "FAILED", detail: "Reminder not found" };

  const fail = async (detail: string, status = "FAILED") => {
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status, failureReason: detail.slice(0, 400) },
    });
    return { reminderId: reminder.id, status, detail };
  };

  // "No call is needed" is decided before "no call is possible": if the user has
  // already done the thing, the state of the telephony config is irrelevant.
  if (!reminder.user.remindersEnabled && !opts.force)
    return fail("Reminder calls are switched off for this profile", "CANCELLED");

  if (!opts.force && REMINDER_CONFIG.skipIfCheckedIn && reminder.item) {
    const plan = await getPlan(reminder.userId, reminder.date);
    if (plan) {
      const adherence = computeAdherence(plan as PlanWithItems);
      const progress = adherence.progress.find((p) => p.item.id === reminder.planItemId);
      if (progress && progress.status === "DONE") {
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: "SKIPPED", failureReason: "Already checked in" },
        });
        return {
          reminderId: reminder.id,
          status: "SKIPPED",
          detail: "Already checked in — no call placed",
        };
      }
    }
  }

  const readiness = checkVoiceReadiness();
  if (!readiness.ready) return fail(readiness.reason ?? "Voice calling is not configured");

  const number = reminder.toNumber || reminder.user.phone || "";
  if (!isDialable(number)) return fail("No valid phone number on the profile");

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { status: "DISPATCHING", attempts: { increment: 1 }, failureReason: null },
  });

  try {
    // 1+2. Write the Gujarati line (using live hydration progress) and render it.
    //      The first two seconds of the file are silence.
    const rendered = await renderReminderAudio(reminder.id);
    if (!rendered) return fail("Could not render the reminder audio");
    const leadSilence = rendered.leadSilence;

    // 3. Only now place the call — the answer webhook has audio waiting.
    //
    // The paths match the Vobiz application's configured Answer/Hangup URLs;
    // `?rid=` pins the exact reminder, and the handlers can still match on the
    // call's own identifiers if Vobiz falls back to the app-level URL.
    const result = await makeCall({
      to: number,
      answerUrl: voiceUrl(`${TELEPHONY_PATHS.answer}?rid=${reminder.id}`),
      ringUrl: voiceUrl(`${TELEPHONY_PATHS.ring}?rid=${reminder.id}`),
      hangupUrl: voiceUrl(`${TELEPHONY_PATHS.hangup}?rid=${reminder.id}`),
      fallbackUrl: voiceUrl(`${TELEPHONY_PATHS.answer}?rid=${reminder.id}`),
      ringTimeout: REMINDER_CONFIG.ringTimeoutSeconds,
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { requestUuid: result.requestUuid ?? null },
    });

    // Set up the next occurrence now, so a daily call keeps going without the
    // user re-adding it every day.
    await rollForwardDaily(reminder).catch((err) =>
      console.error("[reminders] daily roll-forward failed:", err),
    );

    return {
      reminderId: reminder.id,
      status: "DISPATCHING",
      detail: `Calling ${toDialFormat(number)} — ${leadSilence}s pause then the reminder plays, then the call ends itself.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dispatch failed";
    const retryable = reminder.attempts + 1 < REMINDER_CONFIG.maxAttempts;
    return fail(message, retryable ? "SCHEDULED" : "FAILED");
  }
}

export type TickResult = {
  checked: number;
  dispatched: DispatchOutcome[];
  expired: number;
};

/**
 * One scheduler pass: expire anything too old to call politely, then dispatch
 * what is due. Called on an interval and exposed as an endpoint for external cron.
 */
export async function runReminderTick(now = new Date()): Promise<TickResult> {
  const cutoff = new Date(now.getTime() - REMINDER_CONFIG.maxLateMinutes * 60_000);

  const stale = await prisma.reminder.updateMany({
    where: { status: "SCHEDULED", scheduledAt: { lt: cutoff } },
    data: { status: "EXPIRED", failureReason: "Missed its window — not called late" },
  });

  const due = await prisma.reminder.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now, gte: cutoff },
      user: { remindersEnabled: true },
    },
    orderBy: { scheduledAt: "asc" },
    take: 5, // keep one tick from stampeding the carrier
  });

  const dispatched: DispatchOutcome[] = [];
  for (const reminder of due) {
    dispatched.push(await dispatchReminder(reminder.id));
  }

  return { checked: due.length, dispatched, expired: stale.count };
}

export async function cancelReminder(userId: string, reminderId: string) {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder || reminder.userId !== userId) return null;
  await deleteReminderAudio(reminderId);
  return prisma.reminder.update({
    where: { id: reminderId },
    data: { status: "CANCELLED", failureReason: null },
  });
}

export async function rescheduleReminder(userId: string, reminderId: string) {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder || reminder.userId !== userId) return null;
  return prisma.reminder.update({
    where: { id: reminderId },
    data: { status: "SCHEDULED", failureReason: null, attempts: 0, script: "", audioPath: null },
  });
}
