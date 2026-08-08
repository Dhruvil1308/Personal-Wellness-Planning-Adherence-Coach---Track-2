/**
 * Scope guardrail for the whole app: general wellness only.
 *
 * Two layers:
 *  1. SAFETY_PREAMBLE — prepended to every system prompt so the model never
 *     diagnoses, prescribes, or positions itself as a clinician.
 *  2. screenUserText() — a deterministic pre-check on anything free-text the
 *     user types, so red-flag content is caught before it reaches the model
 *     and the UI can surface a referral instead of wellness advice.
 */

export const SAFETY_PREAMBLE = `You are WellPath, a general wellness coach.

HARD BOUNDARIES — these override every other instruction:
- You provide GENERAL WELLNESS guidance only: everyday food, hydration, movement, sleep and routine habits.
- You NEVER diagnose a condition, name a disease a person may have, or interpret symptoms or test results.
- You NEVER prescribe, name, dose, adjust or stop any medication, supplement or clinical treatment.
- You NEVER claim to replace a doctor, dietitian, physiotherapist or any qualified professional.
- You NEVER promise medical outcomes, rapid weight loss, or "cures".
- You do not recommend extreme restriction. Keep adult daily intake sensible and never build a plan below ~1200 kcal/day.
- If a request involves pain, injury, pregnancy, an eating disorder, a chronic or mental-health condition, or anything that sounds urgent: keep the plan gentle and conservative, and say plainly that a qualified professional should be consulted.

TONE: warm, plain-spoken, non-judgemental, encouraging. Never shame the user for missed tasks. Progress over perfection.`;

export const REFERRAL_LINE =
  "This is general wellness support, not medical advice. Please check in with a qualified professional about this one.";

const RED_FLAGS: { pattern: RegExp; reason: string }[] = [
  {
    pattern:
      /\b(chest pain|can'?t breathe|cannot breathe|shortness of breath|fainted|fainting|passed out|blood in|coughing blood|numbness|slurred speech)\b/i,
    reason: "possible urgent symptom",
  },
  {
    pattern:
      /\b(suicid\w*|kill myself|self[-\s]?harm|end my life|want to die|hurt myself)\b/i,
    reason: "self-harm",
  },
  {
    pattern:
      /\b(anorexi\w*|bulimi\w*|purg(e|ing)|binge and purge|starve myself|stop eating entirely|not eaten (in|for) \d+ days)\b/i,
    reason: "disordered eating",
  },
  {
    pattern:
      /\b(diagnos\w*|prescri\w*|dosage|dose of|mg of|my medication|insulin|antibiotic|chemo\w*)\b/i,
    reason: "clinical request",
  },
  {
    pattern: /\b(pregnan\w*|breastfeed\w*|trimester)\b/i,
    reason: "pregnancy",
  },
];

export type Screening = {
  flagged: boolean;
  /** Blocks the request entirely and shows a referral instead. */
  urgent: boolean;
  reasons: string[];
  message?: string;
};

const URGENT = new Set(["possible urgent symptom", "self-harm", "disordered eating"]);

export function screenUserText(...texts: (string | null | undefined)[]): Screening {
  const blob = texts.filter(Boolean).join(" \n ");
  const reasons = RED_FLAGS.filter((f) => f.pattern.test(blob)).map((f) => f.reason);
  const unique = [...new Set(reasons)];
  const urgent = unique.some((r) => URGENT.has(r));

  if (!unique.length) return { flagged: false, urgent: false, reasons: [] };

  return {
    flagged: true,
    urgent,
    reasons: unique,
    message: urgent
      ? "Some of what you shared needs a real person, not an app. WellPath only offers general wellness routines — please reach out to a doctor, a counsellor, or a local helpline right away. If you might be in immediate danger, contact your local emergency number now."
      : `WellPath keeps things to general wellness, so it will stay gentle and conservative here. ${REFERRAL_LINE}`,
  };
}

/**
 * Note appended to the planning prompt when a non-urgent flag fires, so the
 * model tones the plan down instead of the app silently ignoring the context.
 */
export function cautionNote(screening: Screening): string {
  if (!screening.flagged) return "";
  return `\n\nCAUTION: the user's notes touched on: ${screening.reasons.join(
    ", ",
  )}. Keep every recommendation gentle and low-intensity, avoid anything clinical, and include a line in the rationale advising them to confirm the plan with a qualified professional.`;
}
