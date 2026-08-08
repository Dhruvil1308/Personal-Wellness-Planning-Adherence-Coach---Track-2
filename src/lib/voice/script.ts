import { completeText } from "@/lib/ai/client";
import { SAFETY_PREAMBLE } from "@/lib/ai/guardrails";
import type { PlanItem, User } from "@/generated/prisma/client";

/**
 * Builds the line the voice agent speaks. It is generated at dispatch time, not
 * at scheduling time, so it can reflect the user's live progress ("you're at
 * 750 of 2700 ml") rather than restating the plan.
 *
 * Gujarati is the default and the AI writes it directly — translating from
 * English produces stilted phone copy. A deterministic Gujarati template backs
 * it up so a model outage never means a silent call.
 */

/**
 * A fixed line every WATER reminder has to say, word for word — "drink water,
 * your throat is drying up". It applies to hydration only; meals and movement
 * are unaffected.
 *
 * Written in Gujarati to match the rest of the agent. To have the agent say the
 * Hindi/Hinglish wording instead, set WATER_REMINDER_LINE in .env.local, e.g.
 *   WATER_REMINDER_LINE=पानी पी लो, आपका गला सूख रहा है।
 */
export const WATER_SIGNATURE_LINE =
  process.env.WATER_REMINDER_LINE?.trim() || "પાણી પી લો, તમારું ગળું સુકાઈ રહ્યું છે.";

export type ScriptContext = {
  user: User;
  item: Pick<PlanItem, "type" | "title" | "details" | "scheduledTime" | "targetQty" | "unit" | "slot">;
  /** For WATER: millilitres already logged today. */
  loggedQty?: number;
  /**
   * Set for a call the user scheduled themselves. Those have no plan item and
   * therefore no target or progress, so the numeric blocks below do not apply —
   * their own wording is the subject of the call instead.
   */
  custom?: { title: string; note?: string | null };
};

const SYSTEM = `${SAFETY_PREAMBLE}

You write ONE spoken reminder that a voice agent will read out on a phone call.

RULES:
- Write in GUJARATI script only (ગુજરાતી). No English words, no transliteration, no Devanagari.
- 2 to 3 short sentences. It must read aloud in under 20 seconds.
- Greet the person by name once, say what the reminder is for, and end with one warm line.
- Speak plainly, the way a caring friend would on the phone. No lists, no markdown, no emoji, no quotation marks.
- Never mention medicine, diagnosis, symptoms, weight or calories. This is a friendly nudge, nothing clinical.

FACTUAL ACCURACY — the call is worthless if it says something untrue:
- State ONLY what the FACTS block says. Do not invent a place, a piece of equipment, an ingredient, a duration or a quantity that is not listed there.
- Never say a target is already met unless the FACTS block says it is met.
- Follow the SAY line exactly — it tells you what this specific call is for.
- If the FACTS block contains a MUST SAY VERBATIM line, reproduce that sentence character for character, unchanged, as part of your reply.

Output ONLY the Gujarati sentence(s). No preamble, no explanation, no quotes.`;

const isWater = (ctx: ScriptContext) => ctx.item.type === "WATER";

/** Ignores spacing and sentence-ending punctuation when comparing two lines. */
function loosely(text: string): string {
  return text.replace(/[\s।.!,]/g, "");
}

/**
 * Water calls must carry `WATER_SIGNATURE_LINE`. The prompt asks for it, but a
 * model is not a guarantee, so a missing line is prepended rather than lost.
 */
function enforceWaterLine(text: string, ctx: ScriptContext): string {
  if (!isWater(ctx)) return text;
  if (loosely(text).includes(loosely(WATER_SIGNATURE_LINE))) return text;
  return `${WATER_SIGNATURE_LINE} ${text.trim()}`.trim();
}

function gujaratiTemplate(ctx: ScriptContext): string {
  const { user, item } = ctx;
  const name = user.name;

  if (ctx.custom) {
    return isWater(ctx)
      ? `નમસ્તે ${name}. ${WATER_SIGNATURE_LINE} તમે યાદ કરાવવાનું કહ્યું હતું — ${ctx.custom.title}.`
      : `નમસ્તે ${name}. તમે યાદ કરાવવાનું કહ્યું હતું — ${ctx.custom.title}. હવે તેનો સમય થઈ ગયો છે, થોડી વાર કાઢીને કરી લેજો.`;
  }

  if (item.type === "WATER") {
    const target = Math.round(item.targetQty ?? 0);
    const logged = Math.round(ctx.loggedQty ?? 0);
    const left = Math.max(0, target - logged);
    return left > 0
      ? `નમસ્તે ${name}. ${WATER_SIGNATURE_LINE} અત્યાર સુધી તમે ${logged} મિલીલીટર પાણી પીધું છે, અને આજના લક્ષ્ય માટે ${left} મિલીલીટર બાકી છે.`
      : `નમસ્તે ${name}. ${WATER_SIGNATURE_LINE} તમે આજનું પાણીનું લક્ષ્ય પૂરું કરી લીધું છે, ખૂબ સરસ.`;
  }

  if (item.type === "EXERCISE") {
    const minutes = Math.round(item.targetQty ?? 0);
    return `નમસ્તે ${name}. તમારી કસરતનો સમય થઈ ગયો છે. આજે ${minutes} મિનિટ હળવી કસરત કરવાની છે. ધીરે ધીરે શરૂ કરજો અને શરીરને સાંભળજો.`;
  }

  const slot = item.slot?.toLowerCase() ?? "";
  const meal =
    slot.includes("break") ? "નાસ્તાનો"
    : slot.includes("lunch") ? "બપોરના ભોજનનો"
    : slot.includes("dinner") ? "રાત્રિ ભોજનનો"
    : slot.includes("snack") ? "હળવા નાસ્તાનો"
    : "ભોજનનો";

  return `નમસ્તે ${name}. તમારો ${meal} સમય થઈ ગયો છે. આજના પ્લાનમાં ${item.title} છે. થોડો સમય કાઢીને શાંતિથી જમી લેજો.`;
}

/**
 * Facts plus an explicit instruction. An earlier, looser version let the model
 * read "logged 0 ml, 2700 ml remaining" and congratulate the user for finishing
 * — so the state is now stated as a conclusion, not as numbers to interpret.
 */
function contextBlock(ctx: ScriptContext): string {
  const { item } = ctx;

  // Hydration calls always carry the fixed line, whether they came from the plan
  // or the user scheduled them with "Water" chosen.
  const mustSay = isWater(ctx)
    ? `\nMUST SAY VERBATIM: "${WATER_SIGNATURE_LINE}"\nReproduce that sentence exactly, character for character, somewhere in your reply. Build the rest of the reminder around it.`
    : "";

  // A user-scheduled call: their wording is the whole subject. There is no
  // target and no progress, so nothing numeric may be mentioned.
  if (ctx.custom) {
    return [
      "FACTS",
      `- Reminder type: a reminder this person set for themselves.`,
      `- What they asked to be reminded about: ${ctx.custom.title}`,
      ctx.custom.note ? `- Their extra note: ${ctx.custom.note}` : "- Extra note: none.",
      "- There is NO target, NO quantity and NO progress figure for this reminder.",
      "",
      "SAY: Tell them it is time for the thing they asked to be reminded about, in their own terms, and end warmly. Do NOT mention any number, quantity, target, millilitres or minutes.",
      mustSay,
    ].join("\n");
  }

  if (item.type === "WATER") {
    const target = Math.round(item.targetQty ?? 0);
    const logged = Math.round(ctx.loggedQty ?? 0);
    const remaining = Math.max(0, target - logged);
    const met = remaining === 0 && target > 0;

    return [
      "FACTS",
      `- Reminder type: drinking water.`,
      `- Today's target: ${target} millilitres.`,
      `- Already drunk today: ${logged} millilitres.`,
      `- Still to drink: ${remaining} millilitres.`,
      `- Target met? ${met ? "YES" : "NO — the target is NOT met yet"}.`,
      "",
      met
        ? "SAY: Congratulate them for finishing today's water target and encourage them to keep it up. Do NOT ask them to drink more."
        : `SAY: Tell them it is time to drink water, that ${remaining} millilitres are still left for today, and ask them to drink a glass right now. Do NOT say the target is complete.`,
      mustSay,
    ].join("\n");
  }

  if (item.type === "EXERCISE") {
    const minutes = Math.round(item.targetQty ?? 0);
    return [
      "FACTS",
      `- Reminder type: physical activity.`,
      `- Activity name: ${item.title}.`,
      `- Duration: ${minutes} minutes.`,
      item.details ? `- Description: ${item.details}` : "- Description: none given.",
      "- Location and equipment: NOT specified. Do not mention a gym, a park or any equipment.",
      "",
      `SAY: Tell them it is time for their ${minutes} minute activity, name the activity, and encourage them to start gently.`,
    ].join("\n");
  }

  const slot = item.slot ?? "meal";
  return [
    "FACTS",
    `- Reminder type: a meal.`,
    `- Meal slot: ${slot}.`,
    `- Dish planned: ${item.title}.`,
    item.details ? `- Details: ${item.details}` : "- Details: none given.",
    "",
    `SAY: Tell them it is time for their ${slot}, name the planned dish, and warmly ask them to eat it now. Do not add ingredients or cooking steps that are not listed.`,
  ].join("\n");
}

export type ReminderScript = {
  text: string;
  generatedBy: "ai" | "template";
};

/** Gujarati by default; any other language code falls back to the AI only. */
export async function buildReminderScript(ctx: ScriptContext): Promise<ReminderScript> {
  const language = ctx.user.reminderLanguage || "gu-IN";

  try {
    const text = await completeText({
      system: SYSTEM,
      user: [
        `Person's name: ${ctx.user.name}`,
        `Scheduled time: ${ctx.item.scheduledTime}`,
        "",
        contextBlock(ctx),
        "",
        "Write the spoken Gujarati reminder now.",
      ].join("\n"),
      // Enough for 3 Gujarati sentences; Gujarati script is token-dense.
      maxTokens: Math.max(Number(process.env.LLM_MAX_TOKENS ?? 200), 220),
      temperature: 0.7,
    });

    const cleaned = text.replace(/^["'\s]+|["'\s]+$/g, "");
    // A reply with no Gujarati characters means the model drifted to English —
    // the template is better than a wrong-language phone call.
    if (cleaned && /[઀-૿]/.test(cleaned)) {
      return { text: enforceWaterLine(cleaned, ctx), generatedBy: "ai" };
    }
    if (cleaned && language !== "gu-IN") {
      return { text: enforceWaterLine(cleaned, ctx), generatedBy: "ai" };
    }
  } catch {
    // fall through to the template
  }

  return { text: enforceWaterLine(gujaratiTemplate(ctx), ctx), generatedBy: "template" };
}

export { gujaratiTemplate };
