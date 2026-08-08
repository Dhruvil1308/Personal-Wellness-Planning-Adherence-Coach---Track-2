import OpenAI from "openai";
import { ZodError, type z } from "zod";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const TEMPERATURE = Number(process.env.LLM_TEMPERATURE ?? 0.6);

/**
 * Token budgets. LLM_MAX_TOKENS from the env is the budget for the short,
 * conversational generations (coach lines, feedback read-backs). A full day
 * plan and an end-of-day summary are structured JSON and need their own,
 * larger ceilings or they get truncated mid-object.
 */
export const MAX_TOKENS = {
  short: Number(process.env.LLM_MAX_TOKENS ?? 200),
  summary: Number(process.env.LLM_MAX_TOKENS_SUMMARY ?? 800),
  plan: Number(process.env.LLM_MAX_TOKENS_PLAN ?? 2600),
};

export class AIUnavailableError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

/** ZodError.message is a JSON blob — flatten it to something readable in logs. */
function describeError(err: unknown): string {
  if (err instanceof ZodError) {
    return `schema mismatch — ${err.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ")}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function extractJSON(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    // Model occasionally wraps the object in prose — grab the outermost braces.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("No JSON object in response");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

type JSONCallOpts<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  temperature?: number;
  /** Retries on transport errors or schema-validation failures. */
  attempts?: number;
};

/** Chat completion constrained to a JSON object and validated against a zod schema. */
export async function completeJSON<T>({
  system,
  user,
  schema,
  maxTokens,
  temperature = TEMPERATURE,
  attempts = 2,
}: JSONCallOpts<T>): Promise<T> {
  const openai = getOpenAI();
  if (!openai) throw new AIUnavailableError("OPENAI_API_KEY is not configured");

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await openai.chat.completions.create({
        model: MODEL,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content:
              i === 0
                ? user
                : `${user}\n\nYour previous reply did not match the required JSON shape. Return ONLY valid JSON matching the schema described above.`,
          },
        ],
      });

      const raw = res.choices[0]?.message?.content ?? "";
      if (res.choices[0]?.finish_reason === "length") {
        throw new Error("Response truncated — token budget too small");
      }
      return schema.parse(extractJSON(raw));
    } catch (err) {
      lastError = err;
      console.warn(
        `[ai] attempt ${i + 1}/${attempts} failed:`,
        describeError(err),
      );
    }
  }
  throw new AIUnavailableError(
    `AI call failed after ${attempts} attempts: ${describeError(lastError)}`,
    lastError,
  );
}

/** Plain-text completion for short supportive copy. */
export async function completeText({
  system,
  user,
  maxTokens = MAX_TOKENS.short,
  temperature = TEMPERATURE,
}: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const openai = getOpenAI();
  if (!openai) throw new AIUnavailableError("OPENAI_API_KEY is not configured");

  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new AIUnavailableError("Empty response from model");
  return text;
}
