/**
 * Next.js runs this once per server process. It is where the reminder-call
 * scheduler is started — the Node runtime only, never the edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startReminderScheduler } = await import("@/lib/voice/scheduler");
  startReminderScheduler();
}
