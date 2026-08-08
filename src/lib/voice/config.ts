/**
 * Reminder-call configuration and the readiness check.
 *
 * The hard constraint: Vobiz fetches the answer URL and the audio file from the
 * public internet, so `PUBLIC_BASE_URL` must be an https URL that reaches this
 * server. On a laptop that means a tunnel (ngrok / cloudflared). The app refuses
 * to dial rather than firing a call that would connect to dead air.
 */

export const REMINDER_CONFIG = {
  /** How often the scheduler looks for due reminders. */
  tickMs: Number(process.env.REMINDER_TICK_MS ?? 30_000),
  /** Fire this many minutes before the item's scheduled time. */
  leadMinutes: Number(process.env.REMINDER_LEAD_MINUTES ?? 0),
  /** A reminder later than this is expired rather than called at the wrong hour. */
  maxLateMinutes: Number(process.env.REMINDER_MAX_LATE_MINUTES ?? 30),
  /** Retries on a dispatch failure. */
  maxAttempts: Number(process.env.REMINDER_MAX_ATTEMPTS ?? 2),
  ringTimeoutSeconds: Number(process.env.REMINDER_RING_TIMEOUT ?? 30),
  /** Ask for a short spoken reply and transcribe it with Saaras. Off by default:
   *  the specified flow is remind-then-hang-up. */
  captureResponse: process.env.REMINDER_CAPTURE_RESPONSE === "true",
  /** Skip the call when the item has already been checked in. */
  skipIfCheckedIn: process.env.REMINDER_SKIP_IF_CHECKED_IN !== "false",
};

/**
 * Paths the Vobiz application is configured with. They are fixed rather than
 * per-reminder because the console holds one Answer URL for the whole app; the
 * reminder id rides along as `?rid=` and, when Vobiz uses the app-level URL with
 * no query, the handlers fall back to matching on the call's own identifiers.
 */
export const TELEPHONY_PATHS = {
  answer: "/telephony/answer",
  hangup: "/telephony/hangup",
  ring: "/telephony/ring",
  recording: "/telephony/recording",
  audio: "/telephony/audio",
} as const;

function clean(value: string | undefined): string | null {
  const raw = value?.trim().replace(/\/+$/, "");
  return raw || null;
}

function isLocal(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(url);
}

/** Where the app listens locally, e.g. http://localhost:8787. */
export function localBaseUrl(): string {
  const port = process.env.VOICE_PORT ?? process.env.PORT ?? "3000";
  return clean(process.env.PUBLIC_BASE_URL) ?? `http://localhost:${port}`;
}

/**
 * The origin Vobiz must be able to reach.
 *
 * NGROK_DOMAIN wins, because PUBLIC_BASE_URL is normally the local bind address
 * that the tunnel forwards to — pointing the carrier at that would be dead air.
 */
export function publicBaseUrl(): string | null {
  const tunnel = clean(process.env.NGROK_DOMAIN) ?? clean(process.env.TUNNEL_URL);
  if (tunnel) return tunnel.startsWith("http") ? tunnel : `https://${tunnel}`;

  const configured = clean(process.env.PUBLIC_BASE_URL);
  if (configured && !isLocal(configured)) return configured;

  return null;
}

export type VoiceReadiness = {
  ready: boolean;
  /** Present when not ready — a single actionable sentence. */
  reason?: string;
  baseUrl: string | null;
  hasVobiz: boolean;
  hasSarvam: boolean;
  reachable: boolean;
};

/** Everything that must be true before a call can be placed. */
export function checkVoiceReadiness(): VoiceReadiness {
  const baseUrl = publicBaseUrl();
  const hasVobiz = Boolean(
    process.env.VOBIZ_AUTH_ID && process.env.VOBIZ_AUTH_TOKEN && process.env.VOBIZ_PHONE_NUMBER,
  );
  const hasSarvam = Boolean(process.env.SARVAM_API_KEY);

  const isHttps = !!baseUrl && baseUrl.startsWith("https://");
  const reachable = !!baseUrl && !isLocal(baseUrl) && isHttps;

  let reason: string | undefined;
  if (!hasSarvam) reason = "SARVAM_API_KEY is not set, so no reminder audio can be generated.";
  else if (!hasVobiz)
    reason = "VOBIZ_AUTH_ID, VOBIZ_AUTH_TOKEN or VOBIZ_PHONE_NUMBER is not set, so no call can be placed.";
  else if (!baseUrl)
    reason =
      `NGROK_DOMAIN is not set. Vobiz has to reach this server over the public internet — run \`npm run tunnel\` and set NGROK_DOMAIN to the https domain it serves (PUBLIC_BASE_URL stays the local address, ${localBaseUrl()}).`;
  else if (!isHttps)
    reason = `NGROK_DOMAIN is ${baseUrl}; it must be https — Vobiz only fetches over TLS.`;

  return { ready: !reason, reason, baseUrl, hasVobiz, hasSarvam, reachable };
}

export function voiceUrl(path: string): string {
  const base = publicBaseUrl();
  if (!base) throw new Error("PUBLIC_BASE_URL is not configured");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Origin for URLs handed back inside a webhook response.
 *
 * Prefers the origin the carrier actually used to reach us — if Vobiz got here,
 * that host is reachable by definition, which keeps the call working even when
 * PUBLIC_BASE_URL is stale (a restarted tunnel) or was never set. Falls back to
 * the configured value.
 */
export function callbackOrigin(req: Request): string {
  const headers = req.headers;
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  const forwardedProto = headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const proto = forwardedProto ?? (forwardedHost.startsWith("localhost") ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }

  const configured = publicBaseUrl();
  if (configured) return configured;

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export const REMINDER_STATUSES = [
  "SCHEDULED",
  "DISPATCHING",
  "RINGING",
  "ANSWERED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "SKIPPED",
  "EXPIRED",
] as const;

export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
