import { completeJSON, MAX_TOKENS } from "@/lib/ai/client";
import { SAFETY_PREAMBLE } from "@/lib/ai/guardrails";
import { type AISummary, summarySchema } from "@/lib/ai/schemas";
import { describeAdherence, type Adherence } from "@/lib/adherence";
import { prettyDay } from "@/lib/date";
import type { Feedback, User } from "@/generated/prisma/client";

const SYSTEM = `${SAFETY_PREAMBLE}

You write an end-of-day wellness recap.

HARD RULE: use ONLY the recorded data you are given. Never invent a meal, a workout, a number or a feeling that is not in the record. If something was never logged, say it was not logged — do not assume it was skipped on purpose or that it was done.

Write 3-5 sentences that:
- Open with what actually got done, using the real numbers.
- Name the pattern in the misses (a time of day, a specific item, a stream), not just the count.
- Point at one concrete thing to change tomorrow.
- Stay warm and non-judgemental. No shame, no "you failed", no medical claims.

Reply with ONLY a JSON object:
{
  "summaryText": string,
  "wins": string[],          // 1-3 short specifics that went well
  "gaps": string[],          // 1-3 short specifics that slipped, phrased neutrally
  "focusTomorrow": string    // one sentence, one concrete change
}`;

function deterministicSummary(
  user: User,
  date: string,
  a: Adherence,
): AISummary {
  const wins: string[] = [];
  const gaps: string[] = [];

  if (a.mealPct >= 70) wins.push(`Meals ${a.mealPct}% on plan`);
  if (a.waterPct >= 70) wins.push(`Hydration ${a.waterMl}ml of ${a.waterTargetMl}ml`);
  if (a.exercisePct >= 70) wins.push(`Movement ${a.exercisePct}% complete`);
  if (!wins.length && a.itemsCompleted > 0)
    wins.push(`${a.itemsCompleted} check-in${a.itemsCompleted === 1 ? "" : "s"} logged`);

  for (const p of [...a.missed, ...a.pending].slice(0, 3)) {
    gaps.push(`${p.item.title} at ${p.item.scheduledTime} was ${p.status === "SKIPPED" ? "skipped" : "never logged"}`);
  }
  if (a.waterPct < 70)
    gaps.push(`Hydration finished at ${a.waterMl}ml of ${a.waterTargetMl}ml`);

  const firstGap = [...a.missed, ...a.pending][0];

  return {
    summaryText: `${user.name}, you completed ${a.overallPct}% of ${prettyDay(date)}'s plan — meals ${a.mealPct}%, hydration ${a.waterPct}%, movement ${a.exercisePct}%. ${
      a.itemsCompleted
    } of ${a.itemsTotal} items were logged as done${
      a.missed.length + a.pending.length
        ? `, and ${a.missed.length + a.pending.length} went unlogged or skipped`
        : ""
    }. Tomorrow's plan will use exactly this record to adjust.`,
    wins: wins.slice(0, 3),
    gaps: gaps.slice(0, 3),
    focusTomorrow: firstGap
      ? `Tomorrow, "${firstGap.item.title}" moves to a slot that fits you better — that one item is the whole focus.`
      : "Keep the same rhythm tomorrow; it is clearly working.",
  };
}

export async function generateSummary(opts: {
  user: User;
  date: string;
  adherence: Adherence;
  feedback: Feedback | null;
  focus: string | null;
}): Promise<{ summary: AISummary; generatedBy: "ai" | "fallback" }> {
  const { user, date, adherence, feedback, focus } = opts;

  const userPrompt = [
    `Write the end-of-day recap for ${user.name} on ${prettyDay(date)} (${date}).`,
    focus ? `The day's stated focus was: "${focus}".` : null,
    "",
    "## RECORDED DATA (the only source of truth)",
    describeAdherence(adherence),
    "",
    feedback
      ? `## USER FEEDBACK\nEnergy ${feedback.energy}/5, plan difficulty ${feedback.difficulty}/5, hunger ${feedback.hunger}/5${
          feedback.mood ? `, mood "${feedback.mood}"` : ""
        }${feedback.notes ? `\nNotes: "${feedback.notes}"` : ""}`
      : "## USER FEEDBACK\nNone given today.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const summary = await completeJSON({
      system: SYSTEM,
      user: userPrompt,
      schema: summarySchema,
      maxTokens: MAX_TOKENS.summary,
    });
    return { summary, generatedBy: "ai" };
  } catch {
    return { summary: deterministicSummary(user, date, adherence), generatedBy: "fallback" };
  }
}
