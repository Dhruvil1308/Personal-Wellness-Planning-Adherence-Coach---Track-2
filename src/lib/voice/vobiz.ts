/**
 * Vobiz voice API client (Plivo-shaped: auth headers, an answer URL that must
 * return XML, and ring/hangup callbacks posted back as form data).
 */

const API_BASE = process.env.VOBIZ_API_BASE ?? "https://api.vobiz.ai";

export class VobizError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "VobizError";
  }
}

function credentials() {
  const authId = process.env.VOBIZ_AUTH_ID;
  const authToken = process.env.VOBIZ_AUTH_TOKEN;
  const from = process.env.VOBIZ_PHONE_NUMBER;
  if (!authId || !authToken) throw new VobizError("VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN are not configured");
  if (!from) throw new VobizError("VOBIZ_PHONE_NUMBER is not configured");
  return { authId, authToken, from };
}

/**
 * Vobiz's own call log shows destinations as bare digits with the country code
 * (`919824100246`), so `+`, spaces and separators are stripped. A 10-digit
 * Indian number is given the 91 prefix; a leading 0 is dropped.
 */
export function toDialFormat(raw: string, defaultCountryCode = "91"): string {
  let n = raw.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) return n.slice(1);
  n = n.replace(/^0+/, "");
  if (n.length === 10) return defaultCountryCode + n;
  return n;
}

/** Accepts +91XXXXXXXXXX or a 10-digit Indian mobile. */
export function isDialable(raw: string): boolean {
  const n = toDialFormat(raw);
  return /^\d{10,15}$/.test(n);
}

export type MakeCallResult = {
  apiId?: string;
  requestUuid?: string;
  message?: string;
};

export async function makeCall(opts: {
  to: string;
  answerUrl: string;
  hangupUrl?: string;
  ringUrl?: string;
  fallbackUrl?: string;
  /** Seconds to keep ringing before giving up. */
  ringTimeout?: number;
}): Promise<MakeCallResult> {
  const { authId, authToken, from } = credentials();

  const body: Record<string, string | number> = {
    from,
    to: toDialFormat(opts.to),
    answer_url: opts.answerUrl,
    answer_method: "POST",
  };
  if (opts.hangupUrl) {
    body.hangup_url = opts.hangupUrl;
    body.hangup_method = "POST";
  }
  if (opts.ringUrl) {
    body.ring_url = opts.ringUrl;
    body.ring_method = "POST";
  }
  if (opts.fallbackUrl) {
    body.fallback_url = opts.fallbackUrl;
    body.fallback_method = "POST";
  }
  if (opts.ringTimeout) body.ring_timeout = opts.ringTimeout;

  const res = await fetch(`${API_BASE}/api/v1/Account/${authId}/Call/`, {
    method: "POST",
    headers: {
      "X-Auth-ID": authId,
      "X-Auth-Token": authToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new VobizError(`Vobiz call failed (${res.status}): ${text.slice(0, 300)}`, res.status);
  }

  try {
    const json = JSON.parse(text) as {
      api_id?: string;
      request_uuid?: string;
      message?: string;
    };
    return { apiId: json.api_id, requestUuid: json.request_uuid, message: json.message };
  } catch {
    return { message: text.slice(0, 200) };
  }
}

// ---------------------------------------------------------------------------
// Voice XML
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The reminder flow: play the pre-rendered Gujarati audio (whose first two
 * seconds are silence, so the agent starts speaking two seconds after pickup),
 * then hang up on its own.
 *
 * Optionally records a short spoken reply first, which the recording callback
 * transcribes with Saaras.
 */
export function reminderXml(opts: {
  audioUrl: string;
  recordAction?: string;
  recordMaxSeconds?: number;
}): string {
  const parts = [`  <Play>${escapeXml(opts.audioUrl)}</Play>`];

  if (opts.recordAction) {
    parts.push(
      `  <Record action="${escapeXml(opts.recordAction)}" method="POST" ` +
        `maxLength="${opts.recordMaxSeconds ?? 6}" timeout="3" ` +
        `finishOnKey="#" playBeep="true" redirect="false" />`,
    );
  }

  // Explicit hangup so the call always ends itself once the reminder is done.
  parts.push("  <Hangup/>");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${parts.join("\n")}\n</Response>`;
}

/** Used when audio could not be produced — ends the call without dead air. */
export function hangupXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Hangup/>\n</Response>`;
}

export const XML_CONTENT_TYPE = "application/xml; charset=utf-8";
