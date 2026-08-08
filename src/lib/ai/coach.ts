import { completeText, MAX_TOKENS } from "@/lib/ai/client";
import { REFERRAL_LINE, SAFETY_PREAMBLE, screenUserText } from "@/lib/ai/guardrails";
import { describeAdherence, type Adherence } from "@/lib/adherence";
import type { User } from "@/generated/prisma/client";

const SYSTEM = `${SAFETY_PREAMBLE}

You are replying in a check-in chat. Keep it to 2-4 short sentences.
- Ground what you say in the recorded numbers you are given.
- Acknowledge the real situation before encouraging. Never open with empty praise.
- Offer at most ONE small, concrete next action.
- Never shame a missed task. Missing something is data, not a moral failure.
- No diagnosis, no medication, no supplements, no calorie extremes.`;

export async function coachReply(opts: {
  user: User;
  adherence: Adherence | null;
  history: { role: string; content: string }[];
  message: string;
}): Promise<{ reply: string; blocked: boolean; generatedBy: "ai" | "fallback" }> {
  const { user, adherence, history, message } = opts;

  const screening = screenUserText(message);
  if (screening.urgent) {
    return { reply: screening.message!, blocked: true, generatedBy: "fallback" };
  }

  const context = [
    `User: ${user.name}, goal ${user.goal.replace("_", " ")}.`,
    adherence
      ? `Today's record so far:\n${describeAdherence(adherence)}`
      : "No plan recorded for today yet.",
    screening.flagged
      ? `\nNOTE: the message touched on ${screening.reasons.join(", ")}. Stay general, and include this line verbatim at the end: "${REFERRAL_LINE}"`
      : "",
    "",
    ...history.slice(-6).map((m) => `${m.role === "coach" ? "Coach" : "User"}: ${m.content}`),
    `User: ${message}`,
  ].join("\n");

  try {
    const reply = await completeText({
      system: SYSTEM,
      user: context,
      maxTokens: Math.max(MAX_TOKENS.short, 160),
    });
    return { reply, blocked: false, generatedBy: "ai" };
  } catch {
    const done = adherence?.itemsCompleted ?? 0;
    return {
      reply: adherence
        ? `You have logged ${done} of ${adherence.itemsTotal} items today (${adherence.overallPct}%). Pick the single closest one on your list and do just that — the rest of the day gets easier after one check-in.`
        : `Generate today's plan and log one item — starting is the whole trick. This is general wellness support, not medical advice.`,
      blocked: false,
      generatedBy: "fallback",
    };
  }
}
