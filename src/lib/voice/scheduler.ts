import { REMINDER_CONFIG, checkVoiceReadiness } from "@/lib/voice/config";
import { runReminderTick } from "@/lib/services/reminders";

/**
 * In-process scheduler. Started once from `instrumentation.ts` so reminder calls
 * fire while the app is running, with no external cron to set up.
 *
 * `/api/reminders/tick` runs the same pass, so a real deployment can drive it
 * from a proper scheduler instead and leave REMINDER_SCHEDULER_ENABLED unset.
 */

type SchedulerState = {
  timer: NodeJS.Timeout | null;
  running: boolean;
  lastRunAt: Date | null;
  lastError: string | null;
  ticks: number;
  dispatched: number;
};

const globalForScheduler = globalThis as unknown as {
  __wellpathScheduler?: SchedulerState;
};

function state(): SchedulerState {
  if (!globalForScheduler.__wellpathScheduler) {
    globalForScheduler.__wellpathScheduler = {
      timer: null,
      running: false,
      lastRunAt: null,
      lastError: null,
      ticks: 0,
      dispatched: 0,
    };
  }
  return globalForScheduler.__wellpathScheduler;
}

async function tick() {
  const s = state();
  // A slow tick (TTS + a call) must not overlap the next one.
  if (s.running) return;
  s.running = true;
  try {
    const result = await runReminderTick();
    s.lastRunAt = new Date();
    s.ticks++;
    s.dispatched += result.dispatched.length;
    s.lastError = null;
    for (const d of result.dispatched) {
      console.log(`[reminders] ${d.reminderId} -> ${d.status}: ${d.detail}`);
    }
    if (result.expired) console.log(`[reminders] expired ${result.expired} stale reminder(s)`);
  } catch (err) {
    s.lastError = err instanceof Error ? err.message : String(err);
    console.error("[reminders] tick failed:", s.lastError);
  } finally {
    s.running = false;
  }
}

export function startReminderScheduler() {
  const s = state();
  if (s.timer) return; // already running (dev hot reload re-imports this module)

  if (process.env.REMINDER_SCHEDULER_ENABLED === "false") {
    console.log("[reminders] scheduler disabled by REMINDER_SCHEDULER_ENABLED=false");
    return;
  }

  const readiness = checkVoiceReadiness();
  if (!readiness.ready) {
    // Still start the loop: the tunnel URL is often set after the server boots,
    // and each tick re-checks readiness before it dials anything.
    console.log(`[reminders] scheduler started, but calls are on hold — ${readiness.reason}`);
  } else {
    console.log(
      `[reminders] scheduler started, every ${Math.round(REMINDER_CONFIG.tickMs / 1000)}s, calling via ${readiness.baseUrl}`,
    );
  }

  s.timer = setInterval(tick, REMINDER_CONFIG.tickMs);
  // Never hold the process open just for the scheduler.
  s.timer.unref?.();
}

export function schedulerStatus() {
  const s = state();
  return {
    running: Boolean(s.timer),
    busy: s.running,
    lastRunAt: s.lastRunAt,
    lastError: s.lastError,
    ticks: s.ticks,
    dispatched: s.dispatched,
    tickSeconds: Math.round(REMINDER_CONFIG.tickMs / 1000),
  };
}
